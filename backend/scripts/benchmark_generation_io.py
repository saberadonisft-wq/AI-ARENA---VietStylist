"""Compare storage/cache paths with fixed local assets and simulated network RTT.

No .env, provider, live database, or cloud storage is used. Baseline functions
are loaded from the specified Git revision, not copied approximations.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]


def baseline_function(ref, relative_path, name, namespace, class_name=None):
    source = subprocess.check_output(["git", "show", f"{ref}:{relative_path}"], cwd=ROOT).decode("utf-8")
    tree = ast.parse(source)
    nodes = next(node.body for node in tree.body if isinstance(node, ast.ClassDef) and node.name == class_name) if class_name else tree.body
    function = next(node for node in nodes if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name)
    function.decorator_list = []
    scope = dict(namespace)
    exec(compile(ast.Module(body=[function], type_ignores=[]), f"{ref}:{relative_path}", "exec"), scope)
    return scope[name]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-ref", default="5921da2e0df1331b4bcb63112b6bc122d1442e3c")
    parser.add_argument("--iterations", type=int, default=3)
    parser.add_argument("--latency-ms", type=float, default=40)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not 1 <= args.iterations <= 30 or not 0 <= args.latency_ms <= 1000:
        parser.error("Use 1..30 iterations and 0..1000 ms simulated latency")

    with tempfile.TemporaryDirectory(prefix="vietstylist-generation-benchmark-") as temporary:
        os.environ.update({
            "VIETSTYLIST_IGNORE_DOTENV": "1", "ENVIRONMENT": "test", "DEBUG": "false",
            "DATABASE_URL": "sqlite:///" + str(Path(temporary) / "test.db"), "SUPABASE_DATABASE_URL": "",
            "LOCAL_MEDIA_DIR": str(Path(temporary) / "media"), "LOCAL_MEDIA_ENABLED": "true",
            "GEMINI_API_KEY": "", "R2_ACCOUNT_ID": "", "R2_ACCESS_KEY_ID": "", "R2_SECRET_ACCESS_KEY": "",
        })
        sys.path.insert(0, str(ROOT / "backend"))
        from app.core.database import init_database
        from app.core.config import settings
        from app.modules.media import service as media
        from app.modules.catalog import studio_images as studio
        init_database()
        storage = media.r2_client
        objects, operations = {}, Counter()

        def tick(operation):
            operations[operation] += 1
            time.sleep(args.latency_ms / 1000)

        def put(bucket, key, data, mime):
            tick("put")
            objects[bucket, key] = data

        def read(bucket, key, limit):
            tick("get")
            data = objects[bucket, key]
            assert len(data) <= limit
            return data

        def head(bucket, key):
            tick("head")
            return {"size_bytes": len(objects[bucket, key])}

        def delete(bucket, key):
            tick("delete")
            objects.pop((bucket, key), None)
            return True

        assets = sorted((ROOT / "frontend/public/images/heritage").glob("*.jpg"))[:3]
        if not assets:
            raise RuntimeError("No local representative image assets found")
        samples = []
        with ExitStack() as stack:
            stack.enter_context(patch.object(type(storage), "is_configured", property(lambda _: True)))
            stack.enter_context(patch.object(storage, "require_available", lambda: None))
            for name, function in (("put_object", put), ("read_object", read), ("verify_object_exists", head), ("delete_object", delete)):
                stack.enter_context(patch.object(storage, name, function))
            stack.enter_context(patch.object(storage, "generate_upload_url", lambda *args: {
                "upload_url": "https://example.invalid", "method": "PUT", "storage_type": "r2", "expires_in": 900,
            }))
            before = baseline_function(args.baseline_ref, "backend/app/modules/media/service.py", "ingest_generated_image", vars(media), "MediaService")
            for asset in assets:
                source = asset.read_bytes()
                outputs, times, counts = {}, {}, {}
                for label, ingest in (("before", before), ("after", media.MediaService.ingest_generated_image)):
                    elapsed = []
                    for _ in range(args.iterations):
                        operations.clear()
                        started = time.perf_counter()
                        result = ingest("benchmark-owner", source, "image/jpeg")
                        # Both paths still validate the stored final object.
                        assert media.MediaService.probe_image(media.MediaRepository.get_media_by_id(result.id))
                        elapsed.append((time.perf_counter() - started) * 1000)
                        outputs[label] = objects[result.bucket, result.object_key]
                        counts[label] = dict(operations)
                    times[label] = round(statistics.median(elapsed), 2)
                assert outputs["before"] == outputs["after"], "Encoded image bytes changed"
                samples.append({
                    "asset": asset.name, "input_bytes": len(source), "median_ms": times,
                    "storage_operations": counts, "output_bytes_identical": True,
                    "output_sha256": hashlib.sha256(outputs["after"]).hexdigest(),
                })

        cache = Path(settings.LOCAL_MEDIA_DIR) / "studio-cutouts"
        cache.mkdir(parents=True, exist_ok=True)
        cached_bytes = b"already-generated-cache-entry"
        (cache / "warm.png").write_bytes(cached_bytes)
        timings = {}
        with patch.object(studio, "_published_studio_source", lambda _: ({}, {}, "warm")):
            before = baseline_function(args.baseline_ref, "backend/app/modules/catalog/studio_images.py", "get_studio_image", vars(studio))
            for label, getter in (("before", before), ("after", studio.get_studio_image)):
                studio._processing.acquire()
                release = threading.Timer(0.2, studio._processing.release)
                release.start()
                try:
                    start = time.perf_counter()
                    assert getter("cached-item") == cached_bytes
                    timings[label] = round((time.perf_counter() - start) * 1000, 2)
                finally:
                    release.join()

        report = {
            "baseline_ref": args.baseline_ref, "iterations_per_asset": args.iterations,
            "simulated_storage_rtt_ms": args.latency_ms, "storage": samples,
            "warm_cache_with_200ms_unrelated_lock_ms": timings,
            "scope": "Controlled local I/O only; not real R2 or Gemini end-to-end latency. Same encoded output bytes on the listed images.",
        }
        encoded = json.dumps(report, ensure_ascii=False, indent=2)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(encoded + "\n", encoding="utf-8")
        print(encoded)


if __name__ == "__main__":
    main()
