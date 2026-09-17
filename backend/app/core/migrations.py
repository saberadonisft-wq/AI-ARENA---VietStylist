"""Versioned SQLite migrations. No production startup writes or silent repairs."""

import hashlib
import inspect
import sqlite3


def preflight(conn):
    tables = {
        r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    duplicates = []
    if "solution_forms" in tables:
        duplicates = [
            dict(r)
            for r in conn.execute(
                "SELECT owner_id, COUNT(*) AS count, GROUP_CONCAT(id) AS ids FROM solution_forms GROUP BY owner_id HAVING COUNT(*) > 1"
            )
        ]
    invalid_references = []
    if {"lookbook_entries", "lookbooks", "outfits", "outfit_versions"} <= tables:
        invalid_references = [
            dict(r)
            for r in conn.execute(
                "SELECT e.id, e.lookbook_id, e.outfit_version_id FROM lookbook_entries e JOIN lookbooks l ON l.id=e.lookbook_id JOIN outfit_versions v ON v.id=e.outfit_version_id JOIN outfits o ON o.id=v.outfit_id WHERE l.owner_id != o.owner_id OR o.is_deleted != 0"
            )
        ]
    return {
        "duplicate_solution_forms": duplicates,
        "quarantined_lookbook_entries": invalid_references,
    }


def initial(conn):
    from app.core.database import SQLITE_INIT_DDL, split_sql_statements

    for statement in split_sql_statements(SQLITE_INIT_DDL):
        conn.execute(statement)


def blog(conn):
    columns = {r[1] for r in conn.execute("PRAGMA table_info(heritage_articles)")}
    for name, kind in [
        ("author_id", "TEXT"),
        ("author_name", "TEXT"),
        ("author_role", "TEXT DEFAULT 'stylist'"),
        ("cover_image_url", "TEXT"),
        ("category", "TEXT DEFAULT 'Điển tích Cổ phục'"),
        ("era", "TEXT DEFAULT 'Triều Nguyễn'"),
        ("related_garment_id", "TEXT"),
        ("read_time_minutes", "INTEGER DEFAULT 5"),
        ("likes_count", "INTEGER DEFAULT 0"),
    ]:
        if name not in columns:
            conn.execute(f"ALTER TABLE heritage_articles ADD COLUMN {name} {kind}")


def forms(conn):
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_solution_forms_owner ON solution_forms(owner_id)"
    )


def indexes(conn):
    for name, target in [
        ("outfits_owner", "outfits(owner_id, is_deleted, updated_at)"),
        ("outfit_versions_outfit", "outfit_versions(outfit_id, version_number)"),
        ("media_owner_status", "media_assets(owner_id, status)"),
        ("lookbooks_owner", "lookbooks(owner_id, updated_at)"),
        ("lookbook_entries_lb", "lookbook_entries(lookbook_id, sort_order)"),
        ("items_slot_pub", "items(slot, is_published)"),
        ("items_gender_pub", "items(gender, is_published)"),
        ("item_variants_item", "item_variants(item_id, is_default)"),
        ("asset_layers_item", "asset_layers(item_id, z_index)"),
        ("articles_status_era", "heritage_articles(status, era, category)"),
    ]:
        conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{name} ON {target}")


def media_lifecycle(conn):
    columns = {r[1] for r in conn.execute("PRAGMA table_info(media_assets)")}
    for name, kind in [
        ("staging_bucket", "TEXT"),
        ("staging_key", "TEXT"),
        ("upload_expires_at", "INTEGER"),
        ("operation_token", "TEXT"),
        ("lease_until", "INTEGER"),
        ("upload_consumed", "INTEGER NOT NULL DEFAULT 0"),
    ]:
        if name not in columns:
            conn.execute(f"ALTER TABLE media_assets ADD COLUMN {name} {kind}")
    # Old pending sessions cannot be validated against the new immutable-key contract.
    conn.execute(
        "UPDATE media_assets SET status='deleting' WHERE status='pending' AND staging_key IS NULL"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS media_objects (media_id TEXT NOT NULL REFERENCES media_assets(id), bucket TEXT NOT NULL, object_key TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY(bucket,object_key))"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_media_objects_media ON media_objects(media_id)"
    )
    conn.execute(
        "INSERT OR IGNORE INTO media_objects SELECT id,bucket,object_key,'legacy' FROM media_assets"
    )
    for table in ("media_assets", "lookbooks"):
        for event in ("INSERT", "UPDATE OF visibility"):
            suffix = "insert" if event == "INSERT" else "update"
            conn.execute(
                f"CREATE TRIGGER IF NOT EXISTS {table}_visibility_{suffix} BEFORE {event} ON {table} WHEN NEW.visibility IS NULL OR NEW.visibility NOT IN ('public','private','unlisted') BEGIN SELECT RAISE(ABORT,'invalid visibility'); END"
            )
    conn.execute(
        "CREATE VIEW IF NOT EXISTS quarantined_lookbook_entries AS SELECT e.* FROM lookbook_entries e JOIN lookbooks l ON l.id=e.lookbook_id JOIN outfit_versions v ON v.id=e.outfit_version_id JOIN outfits o ON o.id=v.outfit_id WHERE l.owner_id != o.owner_id OR o.is_deleted != 0"
    )


def operational_guards(conn):
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rate_limits (key_hash TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL)"
    )
    schema = conn.execute(
        "SELECT sql FROM sqlite_master WHERE name='user_roles'"
    ).fetchone()[0]
    if "'stylist'" not in schema:
        conn.execute(
            "CREATE TABLE user_roles_updated(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','editor','user','stylist')),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,role))"
        )
        conn.execute(
            "INSERT INTO user_roles_updated SELECT id,user_id,role,created_at FROM user_roles"
        )
        conn.execute("DROP TABLE user_roles")
        conn.execute("ALTER TABLE user_roles_updated RENAME TO user_roles")


def cleanup_schedule(conn):
    columns = {r[1] for r in conn.execute("PRAGMA table_info(media_assets)")}
    if "next_reconcile_at" not in columns:
        conn.execute(
            "ALTER TABLE media_assets ADD COLUMN next_reconcile_at INTEGER NOT NULL DEFAULT 0"
        )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_media_reconcile ON media_assets(next_reconcile_at,status)"
    )


MIGRATIONS = [
    ("001_initial_schema", initial),
    ("002_add_blog_articles_fields", blog),
    ("003_solution_forms_unique_owner", forms),
    ("004_performance_indexes", indexes),
    ("005_media_lifecycle", media_lifecycle),
    ("006_operational_guards", operational_guards),
    ("007_cleanup_schedule", cleanup_schedule),
]


def checksum(fn):
    source = inspect.getsource(fn)
    if fn is initial:
        from app.core.database import SQLITE_INIT_DDL

        source += SQLITE_INIT_DDL
    return hashlib.sha256(source.encode()).hexdigest()


def run_migrations(conn, before=None):
    try:
        conn.execute("BEGIN IMMEDIATE")
        if before:
            before(conn)
        report = preflight(conn)
        if report["duplicate_solution_forms"]:
            raise RuntimeError(
                "Migration preflight blocked: duplicate solution_forms owners; run scripts/migrate.py --dry-run and explicitly reconcile copies before applying. No data changed."
            )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, description TEXT NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, checksum TEXT)"
        )
        if "checksum" not in {
            r[1] for r in conn.execute("PRAGMA table_info(schema_migrations)")
        }:
            conn.execute("ALTER TABLE schema_migrations ADD COLUMN checksum TEXT")
        applied = {
            r["version"]: r["checksum"]
            for r in conn.execute("SELECT version,checksum FROM schema_migrations")
        }
        if set(applied) - {v for v, _ in MIGRATIONS}:
            raise RuntimeError(
                "Unknown migration version; use the matching application release"
            )
        for version, fn in MIGRATIONS:
            digest = checksum(fn)
            if version in applied and applied[version]:
                if applied[version] != digest:
                    raise RuntimeError(f"Migration checksum mismatch: {version}")
                continue
            # Legacy markers had no checksum: replay idempotent DDL to verify/repair structure.
            fn(conn)
            conn.execute(
                "INSERT INTO schema_migrations(version,description,checksum) VALUES(?,?,?) ON CONFLICT(version) DO UPDATE SET checksum=excluded.checksum",
                (version, fn.__name__, digest),
            )
        conn.commit()
        conn.execute("PRAGMA journal_mode=WAL")
    except Exception:
        conn.rollback()
        raise


def verify_schema(conn):
    try:
        rows = {
            r["version"]: r["checksum"]
            for r in conn.execute("SELECT version,checksum FROM schema_migrations")
        }
        if rows != {v: checksum(fn) for v, fn in MIGRATIONS}:
            return False
        conn.execute("SELECT staging_key, lease_until, next_reconcile_at FROM media_assets LIMIT 0")
        conn.execute("SELECT key_hash,count,resets_at FROM rate_limits LIMIT 0")
        conn.execute("SELECT * FROM quarantined_lookbook_entries LIMIT 0")
        conn.execute("SELECT * FROM media_objects LIMIT 0")
        index = conn.execute(
            "SELECT sql FROM sqlite_master WHERE name='uq_solution_forms_owner'"
        ).fetchone()
        triggers = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='trigger'")}
        required = {f"{table}_visibility_{event}" for table in ("media_assets","lookbooks") for event in ("insert","update")}
        unique_columns = [r[2] for r in conn.execute("PRAGMA index_info(uq_solution_forms_owner)")]
        return bool(index and "UNIQUE" in index[0].upper() and unique_columns==["owner_id"] and required<=triggers)
    except sqlite3.Error:
        return False
