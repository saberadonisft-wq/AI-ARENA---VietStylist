"""Immutable graph content, with live withdrawal checks before replay.

Snapshots contain public cultural data only. They never contain accounts, tokens,
private media, database schema SQL, or credentials. A withdrawn dependency makes
the whole version unavailable instead of silently changing its frozen result.
"""
from contextlib import contextmanager
import hashlib
import json
import sqlite3

from app.core.database import Database, db_transaction, get_db_connection
from app.core.errors import AppError
from app.modules.cultural_data_v3.repository import GraphReadRepository, decode_record
from app.modules.cultural_data_v3.services.publication import PublicationPolicy
from app.modules.cultural_data_v3.services.resolver import EffectiveEntityResolver

FORMAT_VERSION = 1
RESOLVER_VERSION = "resolver-2"
TABLES = (
    "entity_registry", "attribute_definitions", "attribute_values", "relation_definitions", "entity_relations",
    "cultural_sources_v3", "cultural_assertions_v3", "assertion_evidence_v3", "cultural_media_bindings_v3",
    "legacy_entity_mappings_v3", "renderable_items_v3", "renderable_variants_v3", "render_profiles_v3",
    "generation_profiles_v3", "cultural_rules_v3",
)


def canonical_json(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def content_hash(value):
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


class ConnectionReader:
    def __init__(self, connection):
        self.connection = connection

    def fetch_one(self, query, params=()):
        return Database.fetch_one(query, params, self.connection)

    def fetch_all(self, query, params=()):
        return Database.fetch_all(query, params, self.connection)


def capture_public_graph(conn):
    # Caller owns one SQLite transaction: facts and evidence come from one view.
    tables = {table: [dict(r) for r in conn.execute(f"SELECT * FROM {table}")] for table in TABLES}
    policy = PublicationPolicy(ConnectionReader(conn))
    tables["entity_registry"] = [{**r, "extensions_json": "{}"} for r in tables["entity_registry"] if r["status"] == "published"]
    entities = {r["id"] for r in tables["entity_registry"]}
    tables["attribute_definitions"] = [r for r in tables["attribute_definitions"] if r["status"] == "active"]
    tables["relation_definitions"] = [r for r in tables["relation_definitions"] if r["status"] == "active"]
    definitions = {r["key"]: r for r in tables["attribute_definitions"]}
    relation_definitions = {r["key"]: r for r in tables["relation_definitions"]}
    attrs = [r for r in tables["attribute_values"] if r["entity_id"] in entities]
    visible = {r["id"] for r in policy.attributes(attrs, definitions)}
    tables["attribute_values"] = [
        {**r, "value_json": None, "candidate_values_json": "[]", "qualifiers_json": "{}", "assertion_ids_json": "[]"} if r["state"] == "withheld" else r
        for r in attrs if r["id"] in visible
    ]
    rels = [r for r in tables["entity_relations"] if r["subject_id"] in entities]
    visible = {r["id"] for r in policy.relations(rels, relation_definitions)}
    tables["entity_relations"] = [r for r in rels if r["id"] in visible]
    tables["cultural_assertions_v3"] = [r for r in tables["cultural_assertions_v3"] if policy.assertion_is_public(r["id"])]
    claims = {r["id"] for r in tables["cultural_assertions_v3"]}
    tables["cultural_sources_v3"] = [r for r in tables["cultural_sources_v3"] if r["review_status"] == "published"]
    sources = {r["id"] for r in tables["cultural_sources_v3"]}
    tables["assertion_evidence_v3"] = [r for r in tables["assertion_evidence_v3"] if r["assertion_id"] in claims and r["source_id"] in sources]
    public_media = {r[0] for r in conn.execute("SELECT id FROM media_assets WHERE visibility='public' AND status='ready'")}
    tables["cultural_media_bindings_v3"] = [r for r in tables["cultural_media_bindings_v3"] if r["entity_id"] in entities and r["source_id"] in sources and r["media_asset_id"] in public_media]
    for table, key in [("legacy_entity_mappings_v3", "entity_id"), ("generation_profiles_v3", "canonical_entity_id")]:
        tables[table] = [r for r in tables[table] if r[key] in entities]
    tables["generation_profiles_v3"] = [{**r, "reference_media_ids_json": canonical_json([id for id in json.loads(r["reference_media_ids_json"]) if id in public_media])} for r in tables["generation_profiles_v3"]]
    tables["renderable_items_v3"] = [r for r in tables["renderable_items_v3"] if r["canonical_entity_id"] in entities and r["is_active"]]
    renderables = {r["id"] for r in tables["renderable_items_v3"]}
    for table in ("renderable_variants_v3", "render_profiles_v3"):
        tables[table] = [r for r in tables[table] if r["renderable_item_id"] in renderables]
    tables["render_profiles_v3"] = [r for r in tables["render_profiles_v3"] if not r["media_asset_id"] or r["media_asset_id"] in public_media]
    tables["cultural_rules_v3"] = [r for r in tables["cultural_rules_v3"] if r["status"] == "published" and (r["entity_id"] is None or r["entity_id"] in entities) and decode_record(r)["assertion_ids"] and policy.fact_is_public(decode_record(r), {"status": "active"})]
    return {"format_version": FORMAT_VERSION, "resolver_version": RESOLVER_VERSION, "tables": {table: sorted(rows, key=canonical_json) for table, rows in tables.items()}}


def create_dataset(label, user_id):
    with db_transaction() as conn:
        content = capture_public_graph(conn)
        encoded = canonical_json(content)
        if len(encoded.encode("utf-8")) > 50 * 1024 * 1024:
            raise AppError("DATASET_TOO_LARGE", "Dataset vượt giới hạn snapshot 50 MiB.", 413)
        digest = content_hash(content)
        dataset_id = "ds_" + digest
        ruleset = "rules_" + content_hash(content["tables"]["cultural_rules_v3"])
        previous = Database.fetch_one("SELECT id FROM dataset_snapshots_v3 WHERE id=?", (dataset_id,), conn)
        if not previous:
            tables = content["tables"]
            Database.execute("INSERT INTO dataset_snapshots_v3(id,label,entity_count,attribute_count,relation_count,snapshot_hash) VALUES(?,?,?,?,?,?)", (dataset_id, label, len(tables["entity_registry"]), len(tables["attribute_values"]), len(tables["entity_relations"]), digest), conn)
            Database.execute("INSERT INTO dataset_contents_v3(dataset_id,format_version,ruleset_version,content_json,content_hash,created_by) VALUES(?,?,?,?,?,?)", (dataset_id, FORMAT_VERSION, ruleset, encoded, digest, user_id), conn)
        return dataset_metadata(dataset_id, reader=ConnectionReader(conn))


def dataset_metadata(dataset_id, *, reader=Database):
    row = reader.fetch_one("SELECT s.id AS dataset_version,s.label,s.entity_count,s.attribute_count,s.relation_count,c.content_hash,c.format_version,c.ruleset_version,c.created_at FROM dataset_snapshots_v3 s JOIN dataset_contents_v3 c ON c.dataset_id=s.id WHERE s.id=?", (dataset_id,))
    if not row:
        raise AppError("DATASET_NOT_FOUND", "Không tìm thấy nội dung dataset đã lưu.", 404)
    return row


def load_content(dataset_id):
    row = Database.fetch_one("SELECT * FROM dataset_contents_v3 WHERE dataset_id=?", (dataset_id,))
    if not row:
        raise AppError("DATASET_NOT_FOUND", "Không tìm thấy nội dung dataset đã lưu.", 404)
    content = row["content_json"]
    if isinstance(content, str):
        content = json.loads(content)
    if content_hash(content) != row["content_hash"] or dataset_id != "ds_" + row["content_hash"]:
        raise AppError("DATASET_INTEGRITY_ERROR", "Nội dung snapshot không khớp checksum.", 409)
    if content.get("format_version") != FORMAT_VERSION or content.get("resolver_version") != RESOLVER_VERSION or set(content.get("tables", {})) != set(TABLES):
        raise AppError("DATASET_FORMAT_UNSUPPORTED", "Dataset cần phiên bản resolver tương ứng.", 409)
    return content


def ensure_not_withdrawn(content):
    # Do not silently filter a frozen graph: that would change its grounding hash.
    with get_db_connection() as conn:
        conn.execute("BEGIN")
        current = capture_public_graph(conn)["tables"]
        for table in TABLES:
            key = "key" if table in ("attribute_definitions", "relation_definitions") else "id"
            if table == "legacy_entity_mappings_v3":
                continue
            live = {r[key]: r for r in current[table]}
            for old in content["tables"][table]:
                now = live.get(old[key])
                if now is None or (table == "attribute_values" and old["state"] != "withheld" and now["state"] == "withheld"):
                    raise AppError("DATASET_WITHDRAWN", "Một phần dữ liệu đã bị thu hồi; hãy chọn dataset mới.", 409)
                if table in ("cultural_sources_v3", "cultural_media_bindings_v3"):
                    # A rights change must not replay obsolete reference grants.
                    if decode_record(now).get("rights") != decode_record(old).get("rights"):
                        raise AppError("DATASET_WITHDRAWN", "Quyền sử dụng dữ liệu đã thay đổi; hãy chọn dataset mới.", 409)


@contextmanager
def dataset_resolver(dataset_version="dev", ruleset_version=None):
    if dataset_version == "dev":
        if ruleset_version not in (None, "dev"):
            raise AppError("RULESET_VERSION_MISMATCH", "Ruleset không thuộc dataset đang dùng.", 422)
        yield EffectiveEntityResolver(), {"dataset_version": "dev", "ruleset_version": "dev", "reproducible": False}
        return
    metadata = dataset_metadata(dataset_version)
    if ruleset_version is not None and ruleset_version != metadata["ruleset_version"]:
        raise AppError("RULESET_VERSION_MISMATCH", "Ruleset không thuộc dataset đang dùng.", 422)
    content = load_content(dataset_version)
    ensure_not_withdrawn(content)
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    try:
        # Table/column names come only from this application's installed schema;
        # archived input supplies values, never executable SQL or schema text.
        for table in TABLES:
            columns = [r["name"] for r in Database.fetch_all(f"PRAGMA table_info({table})")]
            conn.execute(f'CREATE TABLE "{table}" ({",".join(chr(34) + c + chr(34) for c in columns)})')
            for row in content["tables"][table]:
                if set(row) - set(columns):
                    raise AppError("DATASET_FORMAT_UNSUPPORTED", "Schema snapshot không còn được hỗ trợ.", 409)
                keys = list(row)
                conn.execute(f'INSERT INTO "{table}" ({",".join(chr(34) + c + chr(34) for c in keys)}) VALUES ({",".join("?" for _ in keys)})', [row[k] for k in keys])
            index_key = "id" if "id" in columns else "key" if "key" in columns else None
            if index_key:
                conn.execute(f'CREATE INDEX "{table}_lookup" ON "{table}" ("{index_key}")')
        conn.commit()
        conn.execute("PRAGMA query_only=ON")
        reader = ConnectionReader(conn)
        yield EffectiveEntityResolver(GraphReadRepository(reader), reader=reader), {**metadata, "reproducible": True}
    finally:
        conn.close()
