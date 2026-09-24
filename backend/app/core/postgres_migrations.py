"""Explicit, transactional PostgreSQL schema installation. Never imports or seeds data."""
import hashlib
import json
from importlib.resources import files

import psycopg
from psycopg import sql

from app.core.config import settings
from app.core.postgres import connection_kwargs, configure_connection

VERSION = "pg_001_runtime_schema"


def schema_source():
    return files("app.data").joinpath("postgres_schema.sql").read_text(encoding="utf-8")


def schema_manifest():
    return json.loads(files("app.data").joinpath("postgres_schema.json").read_text(encoding="utf-8"))


def schema_checksum():
    return hashlib.sha256(schema_source().encode()).hexdigest()


def verify_postgres_schema(conn):
    try:
        with conn.transaction():
            markers = conn.execute("SELECT version,checksum FROM schema_migrations").fetchall()
            if {r["version"]: r["checksum"] for r in markers} != {VERSION: schema_checksum()}:
                return False
            columns = conn.execute("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=%s ORDER BY table_name,ordinal_position", (settings.DATABASE_SCHEMA,)).fetchall()
            actual = {}
            for row in columns:
                actual.setdefault(row["table_name"], []).append(row["column_name"])
            expected = schema_manifest()
            if any(actual.get(table) != names for table, names in expected["columns"].items()):
                return False
            protected = conn.execute("SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=%s AND c.relkind='r'", (settings.DATABASE_SCHEMA,)).fetchall()
            if {r["relname"] for r in protected if r["relrowsecurity"]} != set(expected["columns"]):
                return False
            indexes = conn.execute("SELECT indexname FROM pg_indexes WHERE schemaname=%s", (settings.DATABASE_SCHEMA,)).fetchall()
            if not set(expected["indexes"]) <= {r["indexname"] for r in indexes}:
                return False
            triggers = conn.execute("SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema=%s", (settings.DATABASE_SCHEMA,)).fetchall()
            return {"dataset_snapshots_v3_immutable", "dataset_contents_v3_immutable"} <= {r["trigger_name"] for r in triggers}
    except psycopg.Error:
        return False


def migrate_postgres(*, dry_run=False, check=False):
    if not settings.is_postgres():
        raise ValueError("PostgreSQL connection required")
    schema = sql.Identifier(settings.DATABASE_SCHEMA)
    with psycopg.connect(**connection_kwargs()) as conn:
        configure_connection(conn)
        if check:
            return {"database": "postgresql", "schema": settings.DATABASE_SCHEMA,
                    "schema_ready": verify_postgres_schema(conn)}
        with conn.transaction(force_rollback=dry_run):
            conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (settings.DATABASE_SCHEMA + ':migration',))
            conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(schema))
            conn.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC").format(schema))
            for role in ("anon", "authenticated"):
                if conn.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone():
                    conn.execute(sql.SQL("REVOKE ALL ON SCHEMA {} FROM {}").format(schema, sql.Identifier(role)))
            tables = conn.execute("SELECT tablename FROM pg_tables WHERE schemaname=%s", (settings.DATABASE_SCHEMA,)).fetchall()
            if tables:
                if not verify_postgres_schema(conn):
                    raise RuntimeError("Existing application schema is incompatible; no tables were replaced.")
                return {"database": "postgresql", "schema": settings.DATABASE_SCHEMA,
                        "schema_ready": True, "created_tables": 0, "seeded_rows": 0, "dry_run": dry_run}
            conn.execute(schema_source(), prepare=False)
            conn.execute("INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)",
                         (VERSION, "PostgreSQL runtime schema without seed", schema_checksum()))
            if not verify_postgres_schema(conn):
                raise RuntimeError("PostgreSQL schema verification failed; transaction rolled back.")
            return {"database": "postgresql", "schema": settings.DATABASE_SCHEMA,
                    "schema_ready": True, "created_tables": len(schema_manifest()["columns"]),
                    "seeded_rows": 0, "dry_run": dry_run}
