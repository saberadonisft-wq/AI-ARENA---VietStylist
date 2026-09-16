import os
import sqlite3
import json
import uuid
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings

# Path to database file if using SQLite
if settings.DATABASE_URL.startswith("sqlite:///"):
    SQLITE_DB_PATH = settings.DATABASE_URL.replace("sqlite:///", "")
    if SQLITE_DB_PATH.startswith("./"):
        SQLITE_DB_PATH = SQLITE_DB_PATH[2:]
else:
    SQLITE_DB_PATH = "viet_phuc_remix.db"

if not os.path.isabs(SQLITE_DB_PATH):
    SQLITE_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", SQLITE_DB_PATH))


def _create_raw_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


@contextmanager
def get_db_connection():
    """
    Context manager cung cấp kết nối SQLite và đảm bảo LUÔN đóng kết nối (close) sau khi dùng xong (O01).
    """
    conn = _create_raw_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def db_transaction(conn: Optional[sqlite3.Connection] = None):
    """
    Context manager cho giao dịch (Transaction) nguyên tử.
    - Nếu được truyền `conn`, dùng giao dịch trên kết nối đó mà không đóng sớm.
    - Nếu không được truyền `conn`, mở kết nối mới, quản lý commit/rollback và đóng kết nối ở finally.
    """
    if conn is not None:
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    else:
        with get_db_connection() as new_conn:
            try:
                yield new_conn
                new_conn.commit()
            except Exception:
                new_conn.rollback()
                raise


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
            try:
                d[k] = json.loads(v)
            except Exception:
                pass
    return d


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    return [row_to_dict(r) for r in rows]  # type: ignore


class Database:
    @staticmethod
    def fetch_one(query: str, params: tuple = (), conn: Optional[sqlite3.Connection] = None) -> Optional[Dict[str, Any]]:
        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return row_to_dict(cursor.fetchone())
        with get_db_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(query, params)
            return row_to_dict(cursor.fetchone())

    @staticmethod
    def fetch_all(query: str, params: tuple = (), conn: Optional[sqlite3.Connection] = None) -> List[Dict[str, Any]]:
        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return rows_to_dicts(cursor.fetchall())
        with get_db_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(query, params)
            return rows_to_dicts(cursor.fetchall())

    @staticmethod
    def execute(query: str, params: tuple = (), conn: Optional[sqlite3.Connection] = None) -> int:
        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.rowcount
        with get_db_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(query, params)
            connection.commit()
            return cursor.rowcount

    @staticmethod
    def execute_many(query: str, param_list: List[tuple], conn: Optional[sqlite3.Connection] = None) -> int:
        if conn is not None:
            cursor = conn.cursor()
            cursor.executemany(query, param_list)
            return cursor.rowcount
        with get_db_connection() as connection:
            cursor = connection.cursor()
            cursor.executemany(query, param_list)
            connection.commit()
            return cursor.rowcount


SQLITE_INIT_DDL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts (Local & OAuth)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    salt TEXT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    auth_provider TEXT DEFAULT 'local',
    provider_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles & Roles
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    preferences TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'user', 'stylist')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

-- Garment Types & Occasions
CREATE TABLE IF NOT EXISTS garment_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    gender_compatibility TEXT DEFAULT 'unisex',
    era TEXT DEFAULT 'Nguyễn',
    slot_schema TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS occasions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    formality_level TEXT DEFAULT 'casual',
    season TEXT DEFAULT 'all',
    criteria TEXT DEFAULT '{}',
    icon_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items & Variants
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    garment_type_id TEXT NOT NULL REFERENCES garment_types(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slot TEXT NOT NULL,
    gender TEXT DEFAULT 'unisex',
    description TEXT,
    era TEXT DEFAULT 'Nguyễn',
    cultural_notes TEXT,
    is_signature INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_variants (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_color TEXT NOT NULL,
    secondary_hex TEXT,
    material TEXT DEFAULT 'Lụa tơ tằm',
    thickness_level TEXT DEFAULT 'medium',
    pattern_description TEXT,
    price_tier TEXT DEFAULT 'standard',
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_occasions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    occasion_id TEXT NOT NULL REFERENCES occasions(id) ON DELETE CASCADE,
    priority_score INTEGER DEFAULT 10,
    editorial_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, occasion_id)
);

-- Avatars & Asset Layers
CREATE TABLE IF NOT EXISTS avatars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    skin_tone TEXT NOT NULL,
    body_type TEXT NOT NULL DEFAULT 'standard',
    base_image_url TEXT,
    svg_body TEXT,
    dimensions TEXT DEFAULT '{"width": 800, "height": 1200}',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_layers (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id TEXT REFERENCES item_variants(id) ON DELETE CASCADE,
    avatar_id TEXT REFERENCES avatars(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    z_index INTEGER NOT NULL DEFAULT 10,
    anchor_x REAL DEFAULT 0.0,
    anchor_y REAL DEFAULT 0.0,
    scale_x REAL DEFAULT 1.0,
    scale_y REAL DEFAULT 1.0,
    layer_type TEXT DEFAULT 'svg',
    svg_content TEXT,
    media_asset_id TEXT,
    color_mask_rule TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media Assets
CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT,
    media_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER,
    owner_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'public',
    status TEXT NOT NULL DEFAULT 'pending',
    source_url TEXT,
    license_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Heritage & Cultural Rules
CREATE TABLE IF NOT EXISTS heritage_sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    publication_year INTEGER,
    publisher TEXT,
    citation_text TEXT NOT NULL,
    url TEXT,
    license_type TEXT DEFAULT 'Public Reference',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS heritage_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    short_summary TEXT NOT NULL,
    full_content TEXT,
    structural_description TEXT,
    historical_context TEXT,
    modern_interpretation TEXT,
    status TEXT NOT NULL DEFAULT 'published',
    reviewer_id TEXT,
    reviewed_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_sources (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES heritage_articles(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES heritage_sources(id) ON DELETE CASCADE,
    page_reference TEXT,
    quote TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS item_articles (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES heritage_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, article_id)
);

CREATE TABLE IF NOT EXISTS cultural_rules (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    target_garment_type_id TEXT REFERENCES garment_types(id) ON DELETE CASCADE,
    target_slot TEXT,
    severity TEXT NOT NULL DEFAULT 'warning',
    condition_json TEXT NOT NULL,
    explanation TEXT NOT NULL,
    source_id TEXT REFERENCES heritage_sources(id) ON DELETE SET NULL,
    suggested_fix TEXT,
    version INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Outfits & Versions
CREATE TABLE IF NOT EXISTS outfits (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    title TEXT NOT NULL DEFAULT 'Bản phối mới',
    occasion_id TEXT REFERENCES occasions(id) ON DELETE SET NULL,
    style_mode TEXT NOT NULL DEFAULT 'traditional',
    current_version_id TEXT,
    revision INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outfit_versions (
    id TEXT PRIMARY KEY,
    outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    snapshot_json TEXT NOT NULL,
    preview_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(outfit_id, version_number)
);

-- Lookbooks & Shares
CREATE TABLE IF NOT EXISTS lookbooks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lookbook_entries (
    id TEXT PRIMARY KEY,
    lookbook_id TEXT NOT NULL REFERENCES lookbooks(id) ON DELETE CASCADE,
    outfit_version_id TEXT NOT NULL REFERENCES outfit_versions(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    lookbook_id TEXT REFERENCES lookbooks(id) ON DELETE CASCADE,
    outfit_version_id TEXT REFERENCES outfit_versions(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    token_plain_prefix TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'view_only',
    is_revoked INTEGER DEFAULT 0,
    revoked_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Jobs & Usage
CREATE TABLE IF NOT EXISTS ai_jobs (
    id TEXT PRIMARY KEY,
    task_type TEXT NOT NULL,
    owner_id TEXT,
    input_hash TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    model_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    input_params TEXT NOT NULL,
    result_data TEXT,
    error_message TEXT,
    lease_until TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    task_type TEXT NOT NULL,
    model_name TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weather Cache
CREATE TABLE IF NOT EXISTS weather_cache (
    id TEXT PRIMARY KEY,
    location_key TEXT UNIQUE NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    weather_data TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Solution Forms F12
CREATE TABLE IF NOT EXISTS solution_forms (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    team_name TEXT NOT NULL DEFAULT 'Đội thi Việt phục Remix',
    product_name TEXT NOT NULL DEFAULT 'Việt Dáng Remix',
    target_audience TEXT,
    problem_statement TEXT,
    proposed_solution TEXT,
    cultural_safeguards TEXT,
    lookbook_references TEXT DEFAULT '[]',
    revision INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def split_sql_statements(sql: str) -> List[str]:
    """Tách các câu lệnh SQL một cách an toàn, bảo vệ dấu chấm phẩy nằm trong chuỗi nháy đơn."""
    statements = []
    current: List[str] = []
    in_string = False
    escape = False

    for char in sql:
        if char == "'" and not escape:
            in_string = not in_string
            current.append(char)
        elif char == "\\" and in_string:
            escape = not escape
            current.append(char)
        elif char == ";" and not in_string:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            escape = False
            current.append(char)

    last_stmt = "".join(current).strip()
    if last_stmt:
        statements.append(last_stmt)
    return statements


def run_migrations(conn: sqlite3.Connection) -> None:
    """
    Chạy các migration theo phiên bản một cách an toàn, lặp lại được (idempotent), không làm mất dữ liệu (R06).
    """
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 1. Migration 001_initial_schema
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM schema_migrations WHERE version = '001_initial_schema'")
    if not cur.fetchone():
        conn.executescript(SQLITE_INIT_DDL)
        conn.execute(
            "INSERT INTO schema_migrations (version, description) VALUES ('001_initial_schema', 'Initial database schema')"
        )
        conn.commit()

    # 2. Migration 002_add_blog_articles_fields
    cur.execute("SELECT 1 FROM schema_migrations WHERE version = '002_add_blog_articles_fields'")
    if not cur.fetchone():
        cur.execute("PRAGMA table_info(heritage_articles)")
        existing_cols = {r["name"] for r in cur.fetchall()}

        blog_cols = [
            ("author_id", "TEXT"),
            ("author_name", "TEXT"),
            ("author_role", "TEXT DEFAULT 'stylist'"),
            ("cover_image_url", "TEXT"),
            ("category", "TEXT DEFAULT 'Điển tích Cổ phục'"),
            ("era", "TEXT DEFAULT 'Triều Nguyễn'"),
            ("related_garment_id", "TEXT"),
            ("read_time_minutes", "INTEGER DEFAULT 5"),
            ("likes_count", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_type in blog_cols:
            if col_name not in existing_cols:
                conn.execute(f"ALTER TABLE heritage_articles ADD COLUMN {col_name} {col_type}")

        conn.execute(
            "INSERT INTO schema_migrations (version, description) VALUES ('002_add_blog_articles_fields', 'Add missing blog columns to heritage_articles')"
        )
        conn.commit()

    # 3. Migration 003_solution_forms_unique_owner
    cur.execute("SELECT 1 FROM schema_migrations WHERE version = '003_solution_forms_unique_owner'")
    if not cur.fetchone():
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_solution_forms_owner ON solution_forms(owner_id)")
        conn.execute(
            "INSERT INTO schema_migrations (version, description) VALUES ('003_solution_forms_unique_owner', 'Ensure unique owner_id on solution_forms')"
        )
        conn.commit()

    # 4. Migration 004_performance_indexes
    cur.execute("SELECT 1 FROM schema_migrations WHERE version = '004_performance_indexes'")
    if not cur.fetchone():
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_outfits_owner ON outfits(owner_id, is_deleted, updated_at)",
            "CREATE INDEX IF NOT EXISTS idx_outfit_versions_outfit ON outfit_versions(outfit_id, version_number)",
            "CREATE INDEX IF NOT EXISTS idx_media_owner_status ON media_assets(owner_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_lookbooks_owner ON lookbooks(owner_id, updated_at)",
            "CREATE INDEX IF NOT EXISTS idx_lookbook_entries_lb ON lookbook_entries(lookbook_id, sort_order)",
            "CREATE INDEX IF NOT EXISTS idx_items_slot_pub ON items(slot, is_published)",
            "CREATE INDEX IF NOT EXISTS idx_items_gender_pub ON items(gender, is_published)",
            "CREATE INDEX IF NOT EXISTS idx_item_variants_item ON item_variants(item_id, is_default)",
            "CREATE INDEX IF NOT EXISTS idx_asset_layers_item ON asset_layers(item_id, z_index)",
            "CREATE INDEX IF NOT EXISTS idx_articles_status_era ON heritage_articles(status, era, category)",
        ]
        for idx_sql in indexes:
            try:
                conn.execute(idx_sql)
            except Exception:
                pass
        conn.execute(
            "INSERT INTO schema_migrations (version, description) VALUES ('004_performance_indexes', 'Add query performance indexes')"
        )
        conn.commit()


def init_database():
    """Khởi tạo bảng, chạy migrations theo phiên bản và nạp seed data an toàn."""
    os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)
    with get_db_connection() as conn:
        run_migrations(conn)

        # Cập nhật constraint role stylist cho các DB cũ nếu cần
        role_schema = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_roles'"
        ).fetchone()[0]
        if "'stylist'" not in role_schema:
            conn.execute("BEGIN")
            conn.execute("""
                CREATE TABLE user_roles_updated (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'user', 'stylist')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, role)
                )
            """)
            conn.execute("INSERT INTO user_roles_updated SELECT id, user_id, role, created_at FROM user_roles")
            conn.execute("DROP TABLE user_roles")
            conn.execute("ALTER TABLE user_roles_updated RENAME TO user_roles")
            conn.commit()

        # Seed data nếu chưa có heritage_articles
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM heritage_articles")
        count = cur.fetchone()[0]
        if count == 0:
            seed_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "supabase", "seed.sql"))
            if os.path.exists(seed_path):
                with open(seed_path, "r", encoding="utf-8") as f:
                    seed_sql = f.read()

                seed_sql = seed_sql.replace("TRUE", "1").replace("FALSE", "0")
                seed_sql = seed_sql.replace("ON CONFLICT (id) DO NOTHING", "ON CONFLICT (id) DO NOTHING")
                seed_sql = seed_sql.replace("ON CONFLICT (item_id, occasion_id) DO NOTHING", "ON CONFLICT (item_id, occasion_id) DO NOTHING")
                seed_sql = seed_sql.replace("ON CONFLICT DO NOTHING", "-- ON CONFLICT DO NOTHING")

                statements = split_sql_statements(seed_sql)
                for stmt in statements:
                    try:
                        if "INSERT INTO article_sources (article_id, source_id" in stmt:
                            stmt = stmt.replace(
                                "INSERT INTO article_sources (article_id, source_id, page_reference, quote) VALUES",
                                "INSERT INTO article_sources (id, article_id, source_id, page_reference, quote) VALUES"
                            )
                            pattern = r"\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)"
                            def repl(m):
                                return f"('{uuid.uuid4()}', '{m.group(1)}', '{m.group(2)}', '{m.group(3)}', '{m.group(4)}')"
                            stmt = re.sub(pattern, repl, stmt)

                        conn.execute(stmt)
                    except Exception:
                        pass
                conn.commit()
