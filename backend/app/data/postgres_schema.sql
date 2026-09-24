-- PostgreSQL runtime schema. Schema-only: no application seed or local data.
-- Integer flags and JSON text preserve the existing backend API contract.

CREATE TABLE schema_migrations(version TEXT PRIMARY KEY, description TEXT NOT NULL, applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, checksum TEXT);

CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    salt TEXT,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    auth_provider TEXT DEFAULT 'local',
    provider_id TEXT,
    is_active BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    preferences TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'user', 'stylist')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE TABLE garment_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    gender_compatibility TEXT DEFAULT 'unisex',
    era TEXT DEFAULT 'Nguyễn',
    slot_schema TEXT DEFAULT '[]',
    is_active BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE occasions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    formality_level TEXT DEFAULT 'casual',
    season TEXT DEFAULT 'all',
    criteria TEXT DEFAULT '{}',
    icon_name TEXT,
    is_active BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE avatars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    skin_tone TEXT NOT NULL,
    body_type TEXT NOT NULL DEFAULT 'standard',
    base_image_url TEXT,
    svg_body TEXT,
    dimensions TEXT DEFAULT '{"width": 800, "height": 1200}',
    is_active BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media_assets (
    id TEXT PRIMARY KEY,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT,
    media_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT,
    width BIGINT,
    height BIGINT,
    duration_ms BIGINT,
    owner_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'public',
    status TEXT NOT NULL DEFAULT 'pending',
    source_url TEXT,
    license_note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
, staging_bucket TEXT, staging_key TEXT, upload_expires_at BIGINT, operation_token TEXT, lease_until BIGINT, upload_consumed BIGINT NOT NULL DEFAULT 0, next_reconcile_at BIGINT NOT NULL DEFAULT 0);

CREATE TABLE heritage_sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    publication_year BIGINT,
    publisher TEXT,
    citation_text TEXT NOT NULL,
    url TEXT,
    license_type TEXT DEFAULT 'Public Reference',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE heritage_articles (
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
    reviewed_at TIMESTAMPTZ,
    version BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
, author_id TEXT, author_name TEXT, author_role TEXT DEFAULT 'stylist', cover_image_url TEXT, category TEXT DEFAULT 'Điển tích Cổ phục', era TEXT DEFAULT 'Triều Nguyễn', related_garment_id TEXT, read_time_minutes BIGINT DEFAULT 5, likes_count BIGINT DEFAULT 0);

CREATE TABLE lookbooks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_jobs (
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
    lease_until TIMESTAMPTZ,
    retry_count BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_usage (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    task_type TEXT NOT NULL,
    model_name TEXT NOT NULL,
    tokens_used BIGINT DEFAULT 0,
    cost_estimate DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE weather_cache (
    id TEXT PRIMARY KEY,
    location_key TEXT UNIQUE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    weather_data TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE solution_forms (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    team_name TEXT NOT NULL DEFAULT 'Đội thi Việt phục Remix',
    product_name TEXT NOT NULL DEFAULT 'Việt Dáng Remix',
    target_audience TEXT,
    problem_statement TEXT,
    proposed_solution TEXT,
    cultural_safeguards TEXT,
    lookbook_references TEXT DEFAULT '[]',
    revision BIGINT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rate_limits (key_hash TEXT PRIMARY KEY, count BIGINT NOT NULL, resets_at BIGINT NOT NULL);

CREATE TABLE entity_registry (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            schema_version TEXT NOT NULL DEFAULT '1.0',
            identity_json TEXT NOT NULL DEFAULT '{}',
            status TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','under_review','verified','published','deprecated')),
            version BIGINT NOT NULL DEFAULT 1,
            extensions_json TEXT NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE attribute_definitions (
            key TEXT PRIMARY KEY,
            label_vi TEXT NOT NULL,
            description TEXT,
            value_type TEXT NOT NULL,
            cardinality TEXT NOT NULL DEFAULT 'single',
            allowed_values_json TEXT,
            applies_to_json TEXT NOT NULL DEFAULT '[]',
            contextual BIGINT NOT NULL DEFAULT 1,
            queryable BIGINT NOT NULL DEFAULT 1,
            inheritable BIGINT NOT NULL DEFAULT 1,
            default_missing_state TEXT NOT NULL DEFAULT 'not_collected',
            status TEXT NOT NULL DEFAULT 'draft',
            version BIGINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE relation_definitions (
            key TEXT PRIMARY KEY,
            label_vi TEXT NOT NULL,
            source_types_json TEXT NOT NULL DEFAULT '[]',
            target_types_json TEXT NOT NULL DEFAULT '[]',
            directional BIGINT NOT NULL DEFAULT 1,
            inverse_relation_key TEXT,
            contextual BIGINT NOT NULL DEFAULT 1,
            inheritable BIGINT NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'draft',
            version BIGINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE cultural_sources_v3 (
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
            version BIGINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE dataset_snapshots_v3 (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            entity_count BIGINT NOT NULL DEFAULT 0,
            attribute_count BIGINT NOT NULL DEFAULT 0,
            relation_count BIGINT NOT NULL DEFAULT 0,
            snapshot_hash TEXT,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE items (
    id TEXT PRIMARY KEY,
    garment_type_id TEXT NOT NULL REFERENCES garment_types(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slot TEXT NOT NULL,
    gender TEXT DEFAULT 'unisex',
    description TEXT,
    era TEXT DEFAULT 'Nguyễn',
    cultural_notes TEXT,
    is_signature BIGINT DEFAULT 0,
    is_published BIGINT DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_sources (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL REFERENCES heritage_articles(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES heritage_sources(id) ON DELETE CASCADE,
    page_reference TEXT,
    quote TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cultural_rules (
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
    version BIGINT DEFAULT 1,
    is_active BIGINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE outfits (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    title TEXT NOT NULL DEFAULT 'Bản phối mới',
    occasion_id TEXT REFERENCES occasions(id) ON DELETE SET NULL,
    style_mode TEXT NOT NULL DEFAULT 'traditional',
    current_version_id TEXT,
    revision BIGINT DEFAULT 1,
    is_deleted BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE media_objects (media_id TEXT NOT NULL REFERENCES media_assets(id), bucket TEXT NOT NULL, object_key TEXT NOT NULL, kind TEXT NOT NULL, PRIMARY KEY(bucket,object_key));

CREATE TABLE attribute_values (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            attribute_key TEXT NOT NULL REFERENCES attribute_definitions(key) ON DELETE CASCADE,
            state TEXT NOT NULL DEFAULT 'not_collected',
            value_json TEXT,
            candidate_values_json TEXT DEFAULT '[]',
            qualifiers_json TEXT DEFAULT '{}',
            assertion_ids_json TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE entity_relations (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            relation_type TEXT NOT NULL REFERENCES relation_definitions(key) ON DELETE CASCADE,
            object_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            state TEXT NOT NULL DEFAULT 'known',
            qualifiers_json TEXT DEFAULT '{}',
            assertion_ids_json TEXT DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE cultural_assertions_v3 (
            id TEXT PRIMARY KEY,
            subject_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            predicate TEXT NOT NULL,
            value_json TEXT NOT NULL,
            qualifiers_json TEXT DEFAULT '{}',
            statement_vi TEXT DEFAULT '',
            confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
            consensus TEXT NOT NULL DEFAULT 'single_source',
            review_status TEXT NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE cultural_media_bindings_v3 (
            id TEXT PRIMARY KEY,
            entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            media_asset_id TEXT NOT NULL,
            view_type TEXT NOT NULL DEFAULT 'front',
            source_id TEXT REFERENCES cultural_sources_v3(id) ON DELETE SET NULL,
            rights_json TEXT NOT NULL DEFAULT '{}',
            sort_order BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE legacy_entity_mappings_v3 (
            legacy_table TEXT NOT NULL,
            legacy_id TEXT NOT NULL,
            entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            mapping_kind TEXT NOT NULL DEFAULT 'identity',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (legacy_table, legacy_id)
        );

CREATE TABLE renderable_items_v3 (
            id TEXT PRIMARY KEY,
            canonical_entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            slot TEXT NOT NULL,
            name TEXT NOT NULL,
            asset_format TEXT NOT NULL DEFAULT 'svg',
            metadata_json TEXT DEFAULT '{}',
            is_active BIGINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE generation_profiles_v3 (
            id TEXT PRIMARY KEY,
            canonical_entity_id TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
            must_preserve_json TEXT NOT NULL DEFAULT '[]',
            may_vary_json TEXT NOT NULL DEFAULT '[]',
            forbidden_json TEXT NOT NULL DEFAULT '[]',
            reference_media_ids_json TEXT NOT NULL DEFAULT '[]',
            version BIGINT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE cultural_rules_v3 (
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
        version BIGINT NOT NULL DEFAULT 1 CHECK(version>=1)
    );

CREATE TABLE dataset_contents_v3 (
        dataset_id TEXT PRIMARY KEY REFERENCES dataset_snapshots_v3(id),
        format_version BIGINT NOT NULL,
        ruleset_version TEXT NOT NULL,
        content_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE item_variants (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_color TEXT NOT NULL,
    secondary_hex TEXT,
    material TEXT DEFAULT 'Lụa tơ tằm',
    thickness_level TEXT DEFAULT 'medium',
    pattern_description TEXT,
    price_tier TEXT DEFAULT 'standard',
    is_default BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE item_occasions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    occasion_id TEXT NOT NULL REFERENCES occasions(id) ON DELETE CASCADE,
    priority_score BIGINT DEFAULT 10,
    editorial_note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, occasion_id)
);

CREATE TABLE item_articles (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES heritage_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, article_id)
);

CREATE TABLE outfit_versions (
    id TEXT PRIMARY KEY,
    outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    version_number BIGINT NOT NULL DEFAULT 1,
    snapshot_json TEXT NOT NULL,
    preview_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(outfit_id, version_number)
);

CREATE TABLE assertion_evidence_v3 (
            id TEXT PRIMARY KEY,
            assertion_id TEXT NOT NULL REFERENCES cultural_assertions_v3(id) ON DELETE CASCADE,
            source_id TEXT NOT NULL REFERENCES cultural_sources_v3(id) ON DELETE CASCADE,
            locator TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE renderable_variants_v3 (
            id TEXT PRIMARY KEY,
            renderable_item_id TEXT NOT NULL REFERENCES renderable_items_v3(id) ON DELETE CASCADE,
            color_name TEXT,
            hex_color TEXT,
            material TEXT,
            style_json TEXT DEFAULT '{}',
            is_default BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE asset_layers (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id TEXT REFERENCES item_variants(id) ON DELETE CASCADE,
    avatar_id TEXT REFERENCES avatars(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    z_index BIGINT NOT NULL DEFAULT 10,
    anchor_x DOUBLE PRECISION DEFAULT 0.0,
    anchor_y DOUBLE PRECISION DEFAULT 0.0,
    scale_x DOUBLE PRECISION DEFAULT 1.0,
    scale_y DOUBLE PRECISION DEFAULT 1.0,
    layer_type TEXT DEFAULT 'svg',
    svg_content TEXT,
    media_asset_id TEXT,
    color_mask_rule TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lookbook_entries (
    id TEXT PRIMARY KEY,
    lookbook_id TEXT NOT NULL REFERENCES lookbooks(id) ON DELETE CASCADE,
    outfit_version_id TEXT NOT NULL REFERENCES outfit_versions(id) ON DELETE CASCADE,
    sort_order BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE share_links (
    id TEXT PRIMARY KEY,
    lookbook_id TEXT REFERENCES lookbooks(id) ON DELETE CASCADE,
    outfit_version_id TEXT REFERENCES outfit_versions(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    token_plain_prefix TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'view_only',
    is_revoked BIGINT DEFAULT 0,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE render_profiles_v3 (
            id TEXT PRIMARY KEY,
            renderable_item_id TEXT NOT NULL REFERENCES renderable_items_v3(id) ON DELETE CASCADE,
            variant_id TEXT REFERENCES renderable_variants_v3(id) ON DELETE CASCADE,
            avatar_id TEXT,
            pose TEXT DEFAULT 'front_01',
            z_index BIGINT NOT NULL DEFAULT 10,
            svg_content TEXT,
            media_asset_id TEXT,
            transform_json TEXT DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX idx_articles_status_era ON heritage_articles(status, era, category);

CREATE INDEX idx_assertion_subject ON cultural_assertions_v3(subject_id);

CREATE INDEX idx_assertion_subject_status_v3 ON cultural_assertions_v3(subject_id, review_status, id);

CREATE INDEX idx_asset_layers_item ON asset_layers(item_id, z_index);

CREATE INDEX idx_attrval_entity ON attribute_values(entity_id);

CREATE INDEX idx_attrval_entity_key_id_v3 ON attribute_values(entity_id, attribute_key, id);

CREATE INDEX idx_attrval_key ON attribute_values(attribute_key);

CREATE INDEX idx_entity_status ON entity_registry(status);

CREATE INDEX idx_entity_status_type_id_v3 ON entity_registry(status, entity_type, id);

CREATE INDEX idx_entity_type ON entity_registry(entity_type);

CREATE INDEX idx_evidence_assertion ON assertion_evidence_v3(assertion_id);

CREATE INDEX idx_genprof_entity ON generation_profiles_v3(canonical_entity_id);

CREATE INDEX idx_item_variants_item ON item_variants(item_id, is_default);

CREATE INDEX idx_items_gender_pub ON items(gender, is_published);

CREATE INDEX idx_items_slot_pub ON items(slot, is_published);

CREATE INDEX idx_legacy_map_entity ON legacy_entity_mappings_v3(entity_id);

CREATE INDEX idx_lookbook_entries_lb ON lookbook_entries(lookbook_id, sort_order);

CREATE INDEX idx_lookbooks_owner ON lookbooks(owner_id, updated_at);

CREATE INDEX idx_media_bind_entity ON cultural_media_bindings_v3(entity_id);

CREATE INDEX idx_media_objects_media ON media_objects(media_id);

CREATE INDEX idx_media_owner_status ON media_assets(owner_id, status);

CREATE INDEX idx_media_reconcile ON media_assets(next_reconcile_at,status);

CREATE INDEX idx_outfit_versions_outfit ON outfit_versions(outfit_id, version_number);

CREATE INDEX idx_outfits_owner ON outfits(owner_id, is_deleted, updated_at);

CREATE INDEX idx_rel_object ON entity_relations(object_id);

CREATE INDEX idx_rel_subject ON entity_relations(subject_id);

CREATE INDEX idx_rel_subject_type_id_v3 ON entity_relations(subject_id, relation_type, id);

CREATE INDEX idx_rel_type ON entity_relations(relation_type);

CREATE INDEX idx_renderable_entity ON renderable_items_v3(canonical_entity_id);

CREATE INDEX idx_rprofile_item ON render_profiles_v3(renderable_item_id);

CREATE INDEX idx_rules_v3_entity_status ON cultural_rules_v3(entity_id,status);

CREATE INDEX idx_rvar_item ON renderable_variants_v3(renderable_item_id);

CREATE UNIQUE INDEX uq_solution_forms_owner ON solution_forms(owner_id);

CREATE VIEW quarantined_lookbook_entries AS SELECT e.* FROM lookbook_entries e JOIN lookbooks l ON l.id=e.lookbook_id JOIN outfit_versions v ON v.id=e.outfit_version_id JOIN outfits o ON o.id=v.outfit_id WHERE l.owner_id != o.owner_id OR o.is_deleted != 0;

ALTER TABLE media_assets ADD CONSTRAINT media_assets_visibility_valid CHECK (visibility IS NOT NULL AND visibility IN ('public','private','unlisted'));

ALTER TABLE lookbooks ADD CONSTRAINT lookbooks_visibility_valid CHECK (visibility IS NOT NULL AND visibility IN ('public','private','unlisted'));

CREATE FUNCTION reject_dataset_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'immutable dataset' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER dataset_snapshots_v3_immutable BEFORE UPDATE OR DELETE ON dataset_snapshots_v3 FOR EACH ROW EXECUTE FUNCTION reject_dataset_mutation();

CREATE TRIGGER dataset_contents_v3_immutable BEFORE UPDATE OR DELETE ON dataset_contents_v3 FOR EACH ROW EXECUTE FUNCTION reject_dataset_mutation();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE article_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE assertion_evidence_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE asset_layers ENABLE ROW LEVEL SECURITY;

ALTER TABLE attribute_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE attribute_values ENABLE ROW LEVEL SECURITY;

ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;

ALTER TABLE cultural_assertions_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE cultural_media_bindings_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE cultural_rules ENABLE ROW LEVEL SECURITY;

ALTER TABLE cultural_rules_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE cultural_sources_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE dataset_contents_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE dataset_snapshots_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE entity_registry ENABLE ROW LEVEL SECURITY;

ALTER TABLE entity_relations ENABLE ROW LEVEL SECURITY;

ALTER TABLE garment_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE generation_profiles_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE heritage_articles ENABLE ROW LEVEL SECURITY;

ALTER TABLE heritage_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE item_articles ENABLE ROW LEVEL SECURITY;

ALTER TABLE item_occasions ENABLE ROW LEVEL SECURITY;

ALTER TABLE item_variants ENABLE ROW LEVEL SECURITY;

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

ALTER TABLE legacy_entity_mappings_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE lookbook_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE lookbooks ENABLE ROW LEVEL SECURITY;

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE media_objects ENABLE ROW LEVEL SECURITY;

ALTER TABLE occasions ENABLE ROW LEVEL SECURITY;

ALTER TABLE outfit_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE relation_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE render_profiles_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE renderable_items_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE renderable_variants_v3 ENABLE ROW LEVEL SECURITY;

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE solution_forms ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE weather_cache ENABLE ROW LEVEL SECURITY;
