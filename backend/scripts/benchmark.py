"""Isolated, offline ASGI benchmark. Can import another checkout with --backend-root."""

import argparse
import asyncio
from collections import Counter
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import secrets
import sqlite3
import sys
import tempfile
import threading
import time


def percentile(values, p):
    return (
        sorted(values)[min(len(values) - 1, int((len(values) - 1) * p))]
        if values
        else None
    )


def summary(values):
    return {
        "count": len(values),
        "p50_ms": percentile(values, 0.5),
        "p95_ms": percentile(values, 0.95),
        "p99_ms": percentile(values, 0.99),
        "max_ms": max(values) if values else None,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--backend-root", type=Path, default=Path(__file__).resolve().parents[1]
    )
    parser.add_argument("--label", default="working-tree")
    parser.add_argument("--soak-seconds", type=int, default=0)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    import psutil
    import httpx

    root = args.backend_root.resolve()
    digest=hashlib.sha256()
    for path in sorted((root/"app").rglob("*.py")):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    source_sha256=digest.hexdigest()
    sys.path.insert(0, str(root))
    original_cwd = Path.cwd()
    with tempfile.TemporaryDirectory(prefix="vietstylist-benchmark-") as temporary:
        os.chdir(temporary)  # Do not read a checkout's .env, including older releases.
        os.environ.update(
            {
                "VIETSTYLIST_IGNORE_DOTENV": "1",
                "ENVIRONMENT": "test",
                "DEBUG": "false",
                "DATABASE_URL": "sqlite:///" + str(Path(temporary) / "benchmark.db"),
                "LOCAL_MEDIA_DIR": str(Path(temporary) / "media"),
                "LOCAL_MEDIA_ENABLED": "true",
                "JWT_SIGNING_SECRET": secrets.token_urlsafe(48),
                "SUPABASE_JWT_SECRET": secrets.token_urlsafe(48),
                "JWT_ISSUER": "viet-phuc-remix",
                "JWT_AUDIENCE": "viet-phuc-remix-api",
                "R2_ACCOUNT_ID": "",
                "R2_ACCESS_KEY_ID": "",
                "R2_SECRET_ACCESS_KEY": "",
                "R2_BUCKET_PUBLIC": "viet-phuc-public",
                "R2_BUCKET_PRIVATE": "viet-phuc-private",
                "GEMINI_API_KEY": "",
                "GOOGLE_CLIENT_ID": "",
            }
        )

        # Deny every real external transport, independently of app/test fixtures.
        def deny(*args, **kwargs):
            raise RuntimeError("Outbound transport disabled by benchmark")

        async def deny_async(*args, **kwargs):
            raise RuntimeError("Outbound transport disabled by benchmark")

        httpx.HTTPTransport.handle_request = deny
        httpx.AsyncHTTPTransport.handle_async_request = deny_async
        import botocore.endpoint

        botocore.endpoint.Endpoint.make_request = deny
        from app.core import database
        from app.core.database import Database
        from app.core.security import create_access_token
        from app.main import app
        from app.modules.catalog.service import CatalogService
        from app.modules.lookbooks.service import LookbookService
        from app.infrastructure.r2.client import r2_client

        database.init_database()
        # Identical synthetic data and seed across before/after runs.
        with database.get_db_connection() as conn:
            for i in range(1000):
                item = f"bench_item_{i}"
                conn.execute(
                    "INSERT INTO items(id,garment_type_id,name,slot,gender,era,is_published) VALUES(?,'ngu_than',?,'outerwear','unisex','nguyen',1)",
                    (item, f"Benchmark {i}"),
                )
                for j in range(2):
                    conn.execute(
                        "INSERT INTO item_variants(id,item_id,color_name,hex_color,is_default) VALUES(?,?,'Red','#FF0000',?)",
                        (f"bench_variant_{i}_{j}", item, int(j == 0)),
                    )
                conn.execute(
                    "INSERT INTO asset_layers(id,item_id,slot,layer_type,z_index) VALUES(?,?,'outerwear','svg',1)",
                    (f"bench_layer_{i}", item),
                )
            for user in range(100):
                owner = f"bench_user_{user}"
                conn.execute(
                    "INSERT INTO accounts(id,email,display_name,is_active) VALUES(?,?,?,1)",
                    (owner, owner + "@example.invalid", owner),
                )
                conn.execute(
                    "INSERT INTO user_roles(id,user_id,role) VALUES(?,?,'user')",
                    (owner, owner),
                )
                for j in range(20):
                    outfit = f"bench_outfit_{user}_{j}"
                    conn.execute(
                        "INSERT INTO outfits(id,owner_id,title) VALUES(?,?,'Benchmark')",
                        (outfit, owner),
                    )
                    conn.execute(
                        "INSERT INTO outfit_versions(id,outfit_id,version_number,snapshot_json) VALUES(?,?,1,?)",
                        (
                            outfit + "_v",
                            outfit,
                            json.dumps({"schemaVersion": 1, "items": []}),
                        ),
                    )
                for j in range(5):
                    lb = f"bench_lb_{user}_{j}"
                    conn.execute(
                        "INSERT INTO lookbooks(id,owner_id,title,visibility) VALUES(?,?,'Benchmark','private')",
                        (lb, owner),
                    )
                    for k in range(4):
                        conn.execute(
                            "INSERT INTO lookbook_entries(id,lookbook_id,outfit_version_id,sort_order) VALUES(?,?,?,?)",
                            (lb + f"_{k}", lb, f"bench_outfit_{user}_{j*4+k}_v", k),
                        )
            conn.commit()
        counts = Counter()
        lock = threading.Lock()
        original_connect = sqlite3.connect

        class MeasuredConnection(sqlite3.Connection):
            def __init__(self, *a, **kw):
                super().__init__(*a, **kw)
                self._closed = False
                with lock:
                    counts["opened"] += 1
                    counts["active"] += 1
                    counts["peak_active"] = max(counts["peak_active"], counts["active"])
                self.set_trace_callback(self.trace)

            def trace(self, statement):
                with lock:
                    counts["statements"] += 1
                    if statement.lstrip().upper().startswith("SELECT"):
                        counts["selects"] += 1

            def close(self):
                if not self._closed:
                    super().close()
                    self._closed = True
                    with lock:
                        counts["active"] -= 1

        sqlite3.connect = lambda *a, **kw: original_connect(
            *a, **{**kw, "factory": MeasuredConnection}
        )
        query_counts = {}
        for name, call in [
            ("catalog_50", lambda: CatalogService.list_items(limit=50)),
            (
                "lookbooks_5",
                lambda: LookbookService.list_user_lookbooks("bench_user_0"),
            ),
        ]:
            before = counts["selects"]
            call()
            query_counts[name] = counts["selects"] - before
        tokens = {
            i: {"Authorization": "Bearer " + create_access_token(f"bench_user_{i}")}
            for i in range(100)
        }
        raw = {
            "reads": [],
            "writes": [],
            "health_during_storage": [],
            "event_loop_lag": [],
            "soak_rss": [],
        }
        statuses = Counter()
        process = psutil.Process()
        started = time.perf_counter()
        cpu_start = sum(process.cpu_times()[:2])

        async def run():
            transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://benchmark"
            ) as client:

                async def request(kind, index):
                    t = time.perf_counter()
                    if kind == "reads":
                        response = await client.get(
                            (
                                "/api/catalog/items?limit=50"
                                if index % 2 == 0
                                else "/api/lookbooks"
                            ),
                            headers=tokens[index % 100],
                        )
                    else:
                        response = await client.post(
                            "/api/outfits",
                            headers=tokens[index % 100],
                            json={"title": "Benchmark", "snapshot": {"items": []}},
                        )
                    raw[kind].append((time.perf_counter() - t) * 1000)
                    statuses[str(response.status_code)] += 1

                for _ in range(3):
                    for kind in ("reads", "writes"):
                        for batch in range(20):
                            await asyncio.gather(
                                *(request(kind, batch * 10 + j) for j in range(10))
                            )
                # A fixed 2s synchronous provider delay on the same ASGI event loop.
                original_upload = r2_client.generate_upload_url
                storage_class = type(r2_client)
                descriptor = storage_class.__dict__.get("is_configured")
                if isinstance(descriptor, property):
                    storage_class.is_configured = property(lambda self: True)
                else:
                    original_configured = r2_client.is_configured
                    r2_client.is_configured = True

                def slow_upload(*a, **kw):
                    time.sleep(2)
                    return {
                        "upload_url": "https://fake.invalid/upload",
                        "method": "PUT",
                        "expires_in": 900,
                        "storage_type": "r2",
                    }

                r2_client.generate_upload_url = slow_upload
                tasks = [
                    asyncio.create_task(
                        client.post(
                            "/api/media/uploads",
                            headers=tokens[i],
                            json={"filename": "p.png"},
                        )
                    )
                    for i in range(3)
                ]
                for _ in range(30):
                    tick = time.perf_counter()
                    await asyncio.sleep(0.02)
                    raw["event_loop_lag"].append(
                        max(0, (time.perf_counter() - tick - 0.02) * 1000)
                    )
                    t = time.perf_counter()
                    response = await client.get("/health")
                    raw["health_during_storage"].append(
                        (time.perf_counter() - t) * 1000
                    )
                    statuses[str(response.status_code)] += 1
                for response in await asyncio.gather(*tasks):
                    statuses[str(response.status_code)] += 1
                r2_client.generate_upload_url = original_upload
                if isinstance(descriptor, property):
                    storage_class.is_configured = descriptor
                else:
                    r2_client.is_configured = original_configured
                soak_start = time.perf_counter()
                sample_at = 0
                while time.perf_counter() - soak_start < args.soak_seconds:
                    await asyncio.gather(*(request("reads", j) for j in range(10)))
                    elapsed = time.perf_counter() - soak_start
                    if elapsed >= sample_at:
                        raw["soak_rss"].append(
                            {
                                "seconds": elapsed,
                                "rss_bytes": process.memory_info().rss,
                                "active_connections": counts["active"],
                                "handles": (
                                    process.num_handles()
                                    if hasattr(process, "num_handles")
                                    else process.num_fds()
                                ),
                            }
                        )
                        sample_at += 10
                    await asyncio.sleep(0.5)

        try:
            asyncio.run(run())
        finally:
            sqlite3.connect = original_connect
        duration = time.perf_counter() - started
        stats = {k: summary(v) for k, v in raw.items() if k != "soak_rss"}
        stats["reads_first_3_rounds"] = summary(raw["reads"][:600])
        soak = raw["soak_rss"]
        warm = [s for s in soak if s["seconds"] >= 60]
        growth = (
            (warm[-1]["rss_bytes"] - warm[0]["rss_bytes"]) if len(warm) > 1 else None
        )
        gates = {
            "no_server_errors": not any(int(k) >= 500 for k in statuses),
            "no_rejected_requests": not any(int(k) >= 400 for k in statuses),
            "catalog_queries_at_most_3": query_counts["catalog_50"] <= 3,
            "lookbook_queries_at_most_2": query_counts["lookbooks_5"] <= 2,
            "read_p95_under_300ms": stats["reads"]["p95_ms"] <= 300,
            "write_p95_under_600ms": stats["writes"]["p95_ms"] <= 600,
            "health_p95_under_200ms": stats["health_during_storage"]["p95_ms"] <= 200,
            "event_loop_max_under_200ms": stats["event_loop_lag"]["max_ms"] <= 200,
            "connections_closed": counts["active"] == 0,
            "soak_growth_under_32MiB": (
                growth <= 32 * 1024 * 1024 if growth is not None else None
            ),
        }
        report = {
            "label": args.label,
            "app_source_sha256": source_sha256,
            "python": sys.version,
            "platform": platform.platform(),
            "dependencies": {
                p: importlib.metadata.version(p)
                for p in (
                    "fastapi",
                    "starlette",
                    "pydantic",
                    "httpx",
                    "boto3",
                    "pillow",
                    "psutil",
                )
            },
            "dataset": {
                "items": 1000,
                "users": 100,
                "outfits_per_user": 20,
                "lookbooks_per_user": 5,
                "entries_per_lookbook": 4,
                "concurrency": 10,
                "rounds": 3,
            },
            "elapsed_seconds": duration,
            "cpu_seconds": sum(process.cpu_times()[:2]) - cpu_start,
            "requests_per_second": sum(statuses.values()) / duration,
            "status_counts": dict(statuses),
            "query_counts": query_counts,
            "connections": dict(counts),
            "latency": stats,
            "soak_seconds": args.soak_seconds,
            "rss_growth_after_60s": growth,
            "gates": gates,
            "raw": raw,
        }
        os.chdir(original_cwd)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(
            json.dumps(
                {
                    "output": str(args.output),
                    "gates": gates,
                    "latency": stats,
                    "rss_growth_after_60s": growth,
                }
            )
        )
        return 0 if all(value is not False for value in gates.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
