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
    SQLITE_DB_PATH = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", SQLITE_DB_PATH)
    )


def _create_raw_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False, timeout=10.0)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute("PRAGMA temp_store = MEMORY;")
        conn.execute("PRAGMA busy_timeout = 5000;")
        return conn
    except Exception:
        conn.close()
        raise


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
        if not conn.in_transaction:
            conn.execute("BEGIN IMMEDIATE")
        savepoint = "nested_" + uuid.uuid4().hex
        conn.execute(f"SAVEPOINT {savepoint}")
        try:
            yield conn
            conn.execute(f"RELEASE SAVEPOINT {savepoint}")
        except Exception:
            conn.execute(f"ROLLBACK TO SAVEPOINT {savepoint}")
            conn.execute(f"RELEASE SAVEPOINT {savepoint}")
            raise
    else:
        with get_db_connection() as new_conn:
            try:
                new_conn.execute("BEGIN IMMEDIATE")
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
    def fetch_one(
        query: str, params: tuple = (), conn: Optional[sqlite3.Connection] = None
    ) -> Optional[Dict[str, Any]]:
        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return row_to_dict(cursor.fetchone())
        with get_db_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(query, params)
            return row_to_dict(cursor.fetchone())

    @staticmethod
    def fetch_all(
        query: str, params: tuple = (), conn: Optional[sqlite3.Connection] = None
    ) -> List[Dict[str, Any]]:
        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return rows_to_dicts(cursor.fetchall())
        with get_db_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(query, params)
            return rows_to_dicts(cursor.fetchall())

    @staticmethod
    def execute(
        query: str, params: tuple = (), conn: Optional[sqlite3.Connection] = None
    ) -> int:
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
    def execute_many(
        query: str, param_list: List[tuple], conn: Optional[sqlite3.Connection] = None
    ) -> int:
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


from app.core.migrations import run_migrations, verify_schema


def init_database(seed=True):
    """Development/test initialization. Production runs migrate.py explicitly."""
    os.makedirs(os.path.dirname(SQLITE_DB_PATH), exist_ok=True)
    with get_db_connection() as conn:
        run_migrations(conn)
        if seed:
            from importlib.resources import files

            sql = files("app.data").joinpath("seed.sql").read_text(encoding="utf-8")
            try:
                conn.execute("BEGIN IMMEDIATE")
                for statement in split_sql_statements(sql):
                    conn.execute(statement)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
