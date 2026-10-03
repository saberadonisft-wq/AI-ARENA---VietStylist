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


def cultural_data_v3(conn):
    """V3 Cultural Knowledge Graph — 11 additive tables, zero legacy changes."""

    # 1. Entity registry
    conn.execute("""
        CREATE TABLE IF NOT EXISTS entity_registry (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            schema_version TEXT NOT NULL DEFAULT '1.0',
            identity_json TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','under_review','verified','published','deprecated')),
            version INTEGER NOT NULL DEFAULT 1,
            extensions_json TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entity_type ON entity_registry(entity_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entity_status ON entity_registry(status)")

    # 2. Attribute definitions registry
    conn.execute("""
        CREATE TABLE IF NOT EXISTS attribute_definitions (
            key TEXT PRIMARY KEY,
            label_vi TEXT NOT NULL,
            description TEXT,
            value_type TEXT NOT NULL,
            cardinality TEXT NOT NULL DEFAULT 'single',
            allowed_values_json TEXT,
            applies_to_json TEXT NOT NULL DEFAULT '[]',
            contextual INTEGER NOT NULL DEFAULT 1,
            queryable INTEGER NOT NULL DEFAULT 1,
            inheritable INTEGER NOT NULL DEFAULT 1,
            default_missing_state TEXT NOT NULL DEFAULT 'not_collected',
            status TEXT NOT NULL DEFAULT 'draft',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 3. Attribute values
    conn.execute("""
        CREATE TABLE IF NOT EXISTS attribute_values (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            attribute_key TEXT NOT NULL REFERENCES attribute_definitions(key) ON DELETE CASCADE,
            state TEXT NOT NULL DEFAULT 'not_collected',
            value_json TEXT,
            candidate_values_json TEXT DEFAULT '[]',
            qualifiers_json TEXT DEFAULT '{}',
            assertion_ids_json TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attrval_entity ON attribute_values(entity_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attrval_key ON attribute_values(attribute_key)")

    # 4. Relation definitions registry
    conn.execute("""
        CREATE TABLE IF NOT EXISTS relation_definitions (
            key TEXT PRIMARY KEY,
            label_vi TEXT NOT NULL,
            source_types_json TEXT NOT NULL DEFAULT '[]',
            target_types_json TEXT NOT NULL DEFAULT '[]',
            directional INTEGER NOT NULL DEFAULT 1,
            inverse_relation_key TEXT,
            contextual INTEGER NOT NULL DEFAULT 1,
            inheritable INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'draft',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 5. Entity relations
    conn.execute("""
        CREATE TABLE IF NOT EXISTS entity_relations (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            relation_type TEXT NOT NULL REFERENCES relation_definitions(key) ON DELETE CASCADE,
            object_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            state TEXT NOT NULL DEFAULT 'known',
            qualifiers_json TEXT DEFAULT '{}',
            assertion_ids_json TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_subject ON entity_relations(subject_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_object ON entity_relations(object_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_type ON entity_relations(relation_type)")

    # 6. Cultural sources V3 — with rights and trust tiers
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cultural_sources_v3 (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            title TEXT NOT NULL,
            creator TEXT,
            institution TEXT,
            publication_date TEXT,
            url TEXT,
            accessed_at TEXT NOT NULL,
            rights_json TEXT NOT NULL DEFAULT '{}',
            trust_tier TEXT NOT NULL DEFAULT 'F_UNVERIFIED',
            review_status TEXT NOT NULL DEFAULT 'draft',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 7. Cultural assertions V3 — atomic cultural claims
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cultural_assertions_v3 (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            predicate TEXT NOT NULL,
            value_json TEXT NOT NULL,
            qualifiers_json TEXT DEFAULT '{}',
            statement_vi TEXT DEFAULT '',
            confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
            consensus TEXT NOT NULL DEFAULT 'single_source',
            review_status TEXT NOT NULL DEFAULT 'draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assertion_subject ON cultural_assertions_v3(subject_id)")

    # 8. Assertion evidence V3 — links assertions to sources
    conn.execute("""
        CREATE TABLE IF NOT EXISTS assertion_evidence_v3 (
            id TEXT PRIMARY KEY,
            assertion_id TEXT NOT NULL REFERENCES cultural_assertions_v3(id) ON DELETE CASCADE,
            source_id TEXT NOT NULL REFERENCES cultural_sources_v3(id) ON DELETE CASCADE,
            locator TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_evidence_assertion ON assertion_evidence_v3(assertion_id)")

    # 9. Cultural media bindings V3
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cultural_media_bindings_v3 (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            media_asset_id TEXT NOT NULL,
            view_type TEXT NOT NULL DEFAULT 'front',
            source_id TEXT REFERENCES cultural_sources_v3(id) ON DELETE SET NULL,
            rights_json TEXT NOT NULL DEFAULT '{}',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_media_bind_entity ON cultural_media_bindings_v3(entity_id)")

    # 10. Dataset snapshots V3 — immutable version snapshots
    conn.execute("""
        CREATE TABLE IF NOT EXISTS dataset_snapshots_v3 (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            entity_count INTEGER NOT NULL DEFAULT 0,
            attribute_count INTEGER NOT NULL DEFAULT 0,
            relation_count INTEGER NOT NULL DEFAULT 0,
            snapshot_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 11. Legacy entity mappings V3 — map old tables to canonical entities
    conn.execute("""
        CREATE TABLE IF NOT EXISTS legacy_entity_mappings_v3 (
            legacy_table TEXT NOT NULL,
            legacy_id TEXT NOT NULL,
            entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            mapping_kind TEXT NOT NULL DEFAULT 'identity',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (legacy_table, legacy_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_legacy_map_entity ON legacy_entity_mappings_v3(entity_id)")


def render_generation_v3(conn):
    """V3 Render & Generation tables — 4 additive tables."""

    # 1. Renderable items V3
    conn.execute("""
        CREATE TABLE IF NOT EXISTS renderable_items_v3 (
            id TEXT PRIMARY KEY,
            canonical_entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            slot TEXT NOT NULL,
            name TEXT NOT NULL,
            asset_format TEXT NOT NULL DEFAULT 'svg',
            metadata_json TEXT DEFAULT '{}',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_renderable_entity ON renderable_items_v3(canonical_entity_id)")

    # 2. Renderable variants V3
    conn.execute("""
        CREATE TABLE IF NOT EXISTS renderable_variants_v3 (
            id TEXT PRIMARY KEY,
            renderable_item_id TEXT NOT NULL REFERENCES renderable_items_v3(id) ON DELETE CASCADE,
            color_name TEXT,
            hex_color TEXT,
            material TEXT,
            style_json TEXT DEFAULT '{}',
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rvar_item ON renderable_variants_v3(renderable_item_id)")

    # 3. Render profiles V3
    conn.execute("""
        CREATE TABLE IF NOT EXISTS render_profiles_v3 (
            id TEXT PRIMARY KEY,
            renderable_item_id TEXT NOT NULL REFERENCES renderable_items_v3(id) ON DELETE CASCADE,
            variant_id TEXT REFERENCES renderable_variants_v3(id) ON DELETE CASCADE,
            avatar_id TEXT,
            pose TEXT DEFAULT 'front_01',
            z_index INTEGER NOT NULL DEFAULT 10,
            svg_content TEXT,
            media_asset_id TEXT,
            transform_json TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rprofile_item ON render_profiles_v3(renderable_item_id)")

    # 4. Generation profiles V3
    conn.execute("""
        CREATE TABLE IF NOT EXISTS generation_profiles_v3 (
            id TEXT PRIMARY KEY,
            canonical_entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            must_preserve_json TEXT NOT NULL DEFAULT '[]',
            may_vary_json TEXT NOT NULL DEFAULT '[]',
            forbidden_json TEXT NOT NULL DEFAULT '[]',
            reference_media_ids_json TEXT NOT NULL DEFAULT '[]',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_genprof_entity ON generation_profiles_v3(canonical_entity_id)")


def dataset_content_v3(conn):
    """Immutable dataset content and persisted cultural rules; additive only."""
    conn.execute("""CREATE TABLE IF NOT EXISTS cultural_rules_v3 (
        id TEXT PRIMARY KEY,
        entity_id TEXT REFERENCES entity_registry(id),
        name TEXT NOT NULL,
        condition_json TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('strict','warning','info')),
        explanation TEXT NOT NULL,
        suggested_fix TEXT,
        qualifiers_json TEXT NOT NULL DEFAULT '{}',
        assertion_ids_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','deprecated')),
        version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rules_v3_entity_status ON cultural_rules_v3(entity_id,status)")
    conn.execute("""CREATE TABLE IF NOT EXISTS dataset_contents_v3 (
        dataset_id TEXT PRIMARY KEY REFERENCES dataset_snapshots_v3(id),
        format_version INTEGER NOT NULL,
        ruleset_version TEXT NOT NULL,
        content_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    for table in ("dataset_snapshots_v3", "dataset_contents_v3"):
        for event in ("UPDATE", "DELETE"):
            conn.execute(f"CREATE TRIGGER IF NOT EXISTS {table}_immutable_{event.lower()} BEFORE {event} ON {table} BEGIN SELECT RAISE(ABORT,'immutable dataset'); END")


def dataset_replace_guard_v3(conn):
    """REPLACE can bypass delete triggers when recursive_triggers is disabled."""
    for table, key in (("dataset_snapshots_v3", "id"), ("dataset_contents_v3", "dataset_id")):
        conn.execute(f"""CREATE TRIGGER IF NOT EXISTS {table}_immutable_insert
            BEFORE INSERT ON {table}
            WHEN EXISTS(SELECT 1 FROM {table} WHERE {key}=NEW.{key})
            BEGIN SELECT RAISE(ABORT,'immutable dataset'); END""")


def performance_indexes_v3(conn):
    """Compound indexes for V3 list and resolver hot paths."""
    conn.execute("CREATE INDEX IF NOT EXISTS idx_entity_status_type_id_v3 ON entity_registry(status, entity_type, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attrval_entity_key_id_v3 ON attribute_values(entity_id, attribute_key, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_subject_type_id_v3 ON entity_relations(subject_id, relation_type, id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_assertion_subject_status_v3 ON cultural_assertions_v3(subject_id, review_status, id)")


def heritage_images(conn):
    columns = {r[1] for r in conn.execute("PRAGMA table_info(heritage_articles)")}
    if "images_json" not in columns:
        conn.execute("ALTER TABLE heritage_articles ADD COLUMN images_json TEXT NOT NULL DEFAULT '[]'")


MIGRATIONS = [
    ("001_initial_schema", initial),
    ("002_add_blog_articles_fields", blog),
    ("003_solution_forms_unique_owner", forms),
    ("004_performance_indexes", indexes),
    ("005_media_lifecycle", media_lifecycle),
    ("006_operational_guards", operational_guards),
    ("007_cleanup_schedule", cleanup_schedule),
    ("008_cultural_data_v3", cultural_data_v3),
    ("009_render_generation_v3", render_generation_v3),
    ("010_dataset_content_v3", dataset_content_v3),
    ("011_dataset_replace_guard_v3", dataset_replace_guard_v3),
    ("012_performance_indexes_v3", performance_indexes_v3),
    ("013_heritage_images", heritage_images),
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
