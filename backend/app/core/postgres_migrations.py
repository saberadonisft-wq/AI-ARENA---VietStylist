"""Explicit, transactional PostgreSQL schema installation. Never imports or seeds data."""
import hashlib
import json
from importlib.resources import files

import psycopg
from psycopg import sql

from app.core.config import settings
from app.core.postgres import connection_kwargs, configure_connection

VERSION = "pg_001_runtime_schema"
STORY_IMAGES_VERSION = "pg_002_heritage_images"
STORY_IMAGES_SQL = "ALTER TABLE heritage_articles ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]'"
COMMUNITY_VERSION = 'pg_003_lookbook_community'


def community_source():
    return files('app.data').joinpath('lookbook_community.sql').read_text(encoding='utf-8')


def community_manifest():
    return {
        'lookbook_posts': ['id','owner_id','outfit_version_id','cover_media_id','title','search_title','description','visibility','moderation_status','moderation_reason','revision','is_deleted','request_key','request_hash','created_at','updated_at','published_at'],
        'lookbook_post_shares': ['id','post_id','token_hash','token_prefix','expires_at','created_at','revoked_at'],
        'lookbook_favorites': ['user_id','post_id','created_at'],
        'lookbook_reports': ['id','post_id','reporter_id','reason','details','status','created_at','resolved_at'],
        'lookbook_public_profiles': ['owner_id','bio'],
    }


def install_community(conn):
    conn.execute(community_source(), prepare=False)
    for table in community_manifest():
        conn.execute(sql.SQL('ALTER TABLE {} ENABLE ROW LEVEL SECURITY').format(sql.Identifier(table)))
        conn.execute(sql.SQL('REVOKE ALL ON {} FROM PUBLIC').format(sql.Identifier(table)))
        for role in ('anon', 'authenticated'):
            if conn.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', (role,)).fetchone():
                conn.execute(sql.SQL('REVOKE ALL ON {} FROM {}').format(sql.Identifier(table), sql.Identifier(role)))
    conn.execute('INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)',
                 (COMMUNITY_VERSION, 'Lookbook community and strict private sharing', hashlib.sha256(community_source().encode()).hexdigest()))


def schema_source():
    return files("app.data").joinpath("postgres_schema.sql").read_text(encoding="utf-8")


def schema_manifest():
    return json.loads(files("app.data").joinpath("postgres_schema.json").read_text(encoding="utf-8"))


def schema_checksum():
    return hashlib.sha256(schema_source().encode()).hexdigest()


def verify_postgres_schema(conn, *, with_story_images=True, with_community=True):
    try:
        with conn.transaction():
            markers = conn.execute("SELECT version,checksum FROM schema_migrations").fetchall()
            expected_markers = {VERSION: schema_checksum()}
            if with_story_images:
                expected_markers[STORY_IMAGES_VERSION] = hashlib.sha256(STORY_IMAGES_SQL.encode()).hexdigest()
            if with_community:
                expected_markers[COMMUNITY_VERSION] = hashlib.sha256(community_source().encode()).hexdigest()
            if {r["version"]: r["checksum"] for r in markers} != expected_markers:
                return False
            columns = conn.execute("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=%s ORDER BY table_name,ordinal_position", (settings.DATABASE_SCHEMA,)).fetchall()
            actual = {}
            for row in columns:
                actual.setdefault(row["table_name"], []).append(row["column_name"])
            expected = schema_manifest()
            if with_story_images:
                expected["columns"]["heritage_articles"].append("images_json")
            if with_community:
                expected['columns'].update(community_manifest())
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
                if verify_postgres_schema(conn, with_story_images=False, with_community=False):
                    conn.execute(STORY_IMAGES_SQL)
                    conn.execute("INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)",
                                 (STORY_IMAGES_VERSION, "Heritage story illustrations", hashlib.sha256(STORY_IMAGES_SQL.encode()).hexdigest()))
                if verify_postgres_schema(conn, with_community=False):
                    install_community(conn)
                if not verify_postgres_schema(conn):
                    raise RuntimeError("Existing application schema is incompatible; no tables were replaced.")
                return {"database": "postgresql", "schema": settings.DATABASE_SCHEMA,
                        "schema_ready": True, "created_tables": 0, "seeded_rows": 0, "dry_run": dry_run}
            conn.execute(schema_source(), prepare=False)
            conn.execute(STORY_IMAGES_SQL)
            conn.execute("INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)",
                         (STORY_IMAGES_VERSION, "Heritage story illustrations", hashlib.sha256(STORY_IMAGES_SQL.encode()).hexdigest()))
            conn.execute("INSERT INTO schema_migrations(version,description,checksum) VALUES(%s,%s,%s)",
                         (VERSION, "PostgreSQL runtime schema without seed", schema_checksum()))
            install_community(conn)
            if not verify_postgres_schema(conn):
                raise RuntimeError("PostgreSQL schema verification failed; transaction rolled back.")
            return {"database": "postgresql", "schema": settings.DATABASE_SCHEMA,
                    "schema_ready": True, "created_tables": len(schema_manifest()["columns"]),
                    "seeded_rows": 0, "dry_run": dry_run}
