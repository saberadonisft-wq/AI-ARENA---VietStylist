PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entity_registry (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  identity_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  extensions_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entity_type_status
ON entity_registry(entity_type, status);

CREATE TABLE IF NOT EXISTS attribute_definitions (
  key TEXT PRIMARY KEY,
  label_vi TEXT NOT NULL,
  description TEXT,
  value_type TEXT NOT NULL,
  cardinality TEXT NOT NULL DEFAULT 'single',
  allowed_values_json TEXT,
  applies_to_json TEXT NOT NULL,
  contextual INTEGER NOT NULL DEFAULT 1,
  queryable INTEGER NOT NULL DEFAULT 1,
  inheritable INTEGER NOT NULL DEFAULT 1,
  default_missing_state TEXT NOT NULL DEFAULT 'not_collected',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS attribute_values (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL REFERENCES attribute_definitions(key) ON DELETE RESTRICT,
  state TEXT NOT NULL,
  value_json TEXT,
  candidate_values_json TEXT NOT NULL DEFAULT '[]',
  qualifiers_json TEXT NOT NULL DEFAULT '{}',
  assertion_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attr_entity_key
ON attribute_values(entity_id, attribute_key);

CREATE TABLE IF NOT EXISTS relation_definitions (
  key TEXT PRIMARY KEY,
  label_vi TEXT NOT NULL,
  source_types_json TEXT NOT NULL,
  target_types_json TEXT NOT NULL,
  directional INTEGER NOT NULL DEFAULT 1,
  inverse_relation_key TEXT,
  contextual INTEGER NOT NULL DEFAULT 1,
  inheritable INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entity_relations (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL REFERENCES relation_definitions(key) ON DELETE RESTRICT,
  object_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'known',
  qualifiers_json TEXT NOT NULL DEFAULT '{}',
  assertion_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rel_subject
ON entity_relations(subject_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_rel_object
ON entity_relations(object_id, relation_type);

CREATE TABLE IF NOT EXISTS cultural_sources_v3 (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  creator TEXT,
  institution TEXT,
  publication_date TEXT,
  url TEXT,
  accessed_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  rights_json TEXT NOT NULL,
  trust_tier TEXT NOT NULL DEFAULT 'F_UNVERIFIED',
  review_status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cultural_assertions_v3 (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  value_json TEXT NOT NULL,
  qualifiers_json TEXT NOT NULL DEFAULT '{}',
  statement_vi TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.0,
  consensus TEXT NOT NULL DEFAULT 'single_source',
  review_status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS assertion_evidence_v3 (
  id TEXT PRIMARY KEY,
  assertion_id TEXT NOT NULL REFERENCES cultural_assertions_v3(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES cultural_sources_v3(id) ON DELETE RESTRICT,
  locator TEXT NOT NULL,
  media_binding_ids_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS cultural_media_bindings_v3 (
  id TEXT PRIMARY KEY,
  media_asset_id TEXT NOT NULL,
  source_id TEXT REFERENCES cultural_sources_v3(id) ON DELETE SET NULL,
  subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  view_type TEXT NOT NULL,
  qualifiers_json TEXT NOT NULL DEFAULT '{}',
  quality_json TEXT NOT NULL DEFAULT '{}',
  usage_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS dataset_snapshots_v3 (
  id TEXT PRIMARY KEY,
  version TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  ruleset_version TEXT,
  manifest_json TEXT NOT NULL,
  checksum TEXT NOT NULL,
  published_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legacy_entity_mappings_v3 (
  legacy_table TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  mapping_kind TEXT NOT NULL,
  PRIMARY KEY (legacy_table, legacy_id, entity_id)
);
