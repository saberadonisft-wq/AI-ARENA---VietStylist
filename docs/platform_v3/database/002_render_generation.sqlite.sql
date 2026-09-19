CREATE TABLE IF NOT EXISTS renderable_items_v3 (
  id TEXT PRIMARY KEY,
  canonical_entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  canonical_variant_id TEXT,
  slot TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS renderable_variants_v3 (
  id TEXT PRIMARY KEY,
  renderable_item_id TEXT NOT NULL REFERENCES renderable_items_v3(id) ON DELETE CASCADE,
  style_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS render_profiles_v3 (
  id TEXT PRIMARY KEY,
  render_variant_id TEXT NOT NULL REFERENCES renderable_variants_v3(id) ON DELETE CASCADE,
  avatar_id TEXT,
  pose_id TEXT,
  media_asset_id TEXT,
  render_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS generation_profiles_v3 (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  profile_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
);
