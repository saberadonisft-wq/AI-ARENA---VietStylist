"""Measure a fixed V3 read workload against a disposable SQLite database.

This is a local benchmark artifact. It never reads the repository database and
prints machine-readable timings so before/after runs can be compared.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from contextlib import ExitStack
import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import statistics
import sys
import tempfile
import time


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    index = (len(ordered) - 1) * fraction
    low, high = int(index), min(int(index) + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


def measure(call, count: int, warmup: int = 5) -> dict[str, float | int]:
    samples: list[float] = []
    payloads: list[int] = []
    for _ in range(warmup):
        response = call()
        if response.status_code != 200:
            raise RuntimeError(f"benchmark warmup failed: {response.status_code}")
    for _ in range(count):
        start = time.perf_counter()
        response = call()
        elapsed = (time.perf_counter() - start) * 1000
        if response.status_code != 200:
            raise RuntimeError(f"benchmark request failed: {response.status_code} {response.text[:300]}")
        samples.append(elapsed)
        payloads.append(len(response.content))
    return {
        "count": len(samples),
        "p50_ms": round(statistics.median(samples), 3),
        "p95_ms": round(percentile(samples, 0.95), 3),
        "max_ms": round(max(samples), 3),
        "mean_ms": round(statistics.mean(samples), 3),
        "payload_bytes_p50": int(statistics.median(payloads)),
        "payload_bytes_max": max(payloads),
    }


def measure_raw(call, count: int, warmup: int = 5) -> dict[str, float | int]:
    samples: list[float] = []
    for _ in range(warmup):
        call()
    for _ in range(count):
        start = time.perf_counter()
        call()
        samples.append((time.perf_counter() - start) * 1000)
    return {
        "count": len(samples),
        "p50_ms": round(statistics.median(samples), 3),
        "p95_ms": round(percentile(samples, 0.95), 3),
        "max_ms": round(max(samples), 3),
        "mean_ms": round(statistics.mean(samples), 3),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iterations", type=int, default=30)
    parser.add_argument("--entities", type=int, default=5000)
    parser.add_argument("--clients", type=int, default=10)
    parser.add_argument("--drop-v3-indexes", action="store_true", help="Run the pre-index comparison on the same schema")
    args = parser.parse_args()
    if args.iterations < 5 or args.entities < 100 or args.clients < 1:
        raise SystemExit("iterations>=5, entities>=100 and clients>=1 are required")

    with tempfile.TemporaryDirectory(prefix="vietstylist-v3-benchmark-") as directory:
        db_path = Path(directory) / "benchmark.db"
        os.environ.update({
            "VIETSTYLIST_IGNORE_DOTENV": "1", "DATABASE_URL": f"sqlite:///{db_path}",
            "ENVIRONMENT": "test", "DEBUG": "false", "LOCAL_MEDIA_ENABLED": "false",
            "JWT_SIGNING_SECRET": "benchmark-secret-012345678901234567890123456789",
            "AUTH_MODE": "local", "JWT_ISSUER": "viet-phuc-remix", "JWT_AUDIENCE": "viet-phuc-remix-api",
            "R2_ACCOUNT_ID": "", "R2_ACCESS_KEY_ID": "", "R2_SECRET_ACCESS_KEY": "",
            "GEMINI_API_KEY": "", "GOOGLE_CLIENT_ID": "", "SUPABASE_SERVICE_ROLE_KEY": "", "SUPABASE_ANON_KEY": "",
            "API_PUBLIC_ORIGIN": "http://127.0.0.1:4199", "FRONTEND_PUBLIC_ORIGIN": "http://127.0.0.1:3199",
            "CORS_ORIGINS": "[\"http://127.0.0.1:3199\"]",
        })
        backend_dir = Path(__file__).resolve().parents[1]
        sys.path.insert(0, str(backend_dir))
        from fastapi.testclient import TestClient
        from app.core.database import Database, init_database
        from app.main import app
        init_database()

        entities = [(f"bench_period_{i:05d}", "period" if i % 2 == 0 else "region", json.dumps({"name_vi": f"Mục {i}"}, ensure_ascii=False)) for i in range(args.entities)]
        entities.append(("bench_garment", "garment", json.dumps({"name_vi": "Áo kiểm thử"}, ensure_ascii=False)))
        Database.execute_many(
            "INSERT INTO entity_registry(id,entity_type,identity_json,status,version,extensions_json) VALUES(?,?,?,'published',1,'{}')",
            entities,
        )
        if args.drop_v3_indexes:
            for name in (
                "idx_entity_status_type_id_v3", "idx_attrval_entity_key_id_v3",
                "idx_rel_subject_type_id_v3", "idx_assertion_subject_status_v3",
            ):
                Database.execute(f"DROP INDEX IF EXISTS {name}")

        with ExitStack() as stack:
            clients = [stack.enter_context(TestClient(app)) for _ in range(args.clients)]

            def request(path: str, method: str = "GET", body=None, client=None):
                return (client or clients[0]).request(method, path, json=body)

            list_path = f"/api/v3/entities?entity_type=period&limit=200&offset={args.entities // 4}"
            education_path = "/api/v3/entities/bench_garment/education"
            bundle_path = "/api/v3/composer/bundles/bench_garment"
            validate_body = {"dataset_version": "dev", "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "bench_garment"}]}
            plans = {
                "list_entities": Database.fetch_all("EXPLAIN QUERY PLAN SELECT * FROM entity_registry WHERE status='published' AND entity_type=? ORDER BY id LIMIT ? OFFSET ?", ("period", 200, args.entities // 2)),
                "attribute_values": Database.fetch_all("EXPLAIN QUERY PLAN SELECT * FROM attribute_values WHERE entity_id=? ORDER BY attribute_key,id", ("bench_garment",)),
                "relations": Database.fetch_all("EXPLAIN QUERY PLAN SELECT * FROM entity_relations WHERE subject_id=? ORDER BY relation_type,id", ("bench_garment",)),
            }
            workloads = {
                "list_entities": lambda client=None: request(list_path, client=client),
                "education": lambda client=None: request(education_path, client=client),
                "composer_bundle": lambda client=None: request(bundle_path, client=client),
                "validate_outfit": lambda client=None: request("/api/v3/outfits/validate", "POST", validate_body, client),
            }
            raw_workloads = {
                "list_entities": lambda: Database.fetch_all("SELECT * FROM entity_registry WHERE status='published' AND entity_type=? ORDER BY id LIMIT ? OFFSET ?", ("period", 200, args.entities // 4)),
                "attribute_values": lambda: Database.fetch_all("SELECT * FROM attribute_values WHERE entity_id=? ORDER BY attribute_key,id", ("bench_garment",)),
                "relations": lambda: Database.fetch_all("SELECT * FROM entity_relations WHERE subject_id=? ORDER BY relation_type,id", ("bench_garment",)),
            }
            sequential = {name: measure(call, args.iterations) for name, call in workloads.items()}
            raw_sequential = {name: measure_raw(call, args.iterations) for name, call in raw_workloads.items()}
            concurrent: dict[str, dict[str, float | int]] = {}
            for name, call in workloads.items():
                start = time.perf_counter()
                with ThreadPoolExecutor(max_workers=args.clients) as pool:
                    def timed_call(client):
                        request_start = time.perf_counter()
                        response = call(client)
                        return response, (time.perf_counter() - request_start) * 1000

                    futures = [pool.submit(timed_call, clients[index]) for index in range(args.clients)]
                    results = [future.result() for future in futures]
                responses = [result[0] for result in results]
                response_times = [result[1] for result in results]
                elapsed = (time.perf_counter() - start) * 1000
                if any(response.status_code != 200 for response in responses):
                    raise RuntimeError(f"concurrent benchmark request failed for {name}")
                concurrent[name] = {
                    "clients": args.clients, "wall_ms": round(elapsed, 3),
                    "response_p50_ms": round(statistics.median(response_times), 3),
                    "response_p95_ms": round(percentile(response_times, 0.95), 3),
                    "max_response_ms": round(max(response_times), 3),
                }
            print(json.dumps({
                "schema": 1, "workload": {"entities": args.entities, "iterations": args.iterations, "clients": args.clients, "database": "temporary_sqlite"},
                "indexes": not args.drop_v3_indexes, "query_plans": plans, "raw_sequential": raw_sequential, "sequential": sequential, "concurrent": concurrent,
            }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
