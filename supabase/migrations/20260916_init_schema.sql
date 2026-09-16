-- Migration: 20260916_init_schema.sql
-- Description: Schema khởi tạo cho Việt phục Remix (Supabase PostgreSQL)
-- Ngày tạo: 16/09/2026

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles & Roles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- 2. Catalog: Garment Types, Occasions, Items, Variants
CREATE TABLE IF NOT EXISTS garment_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    gender_compatibility TEXT NOT NULL DEFAULT 'unisex', -- male, female, unisex
    era TEXT NOT NULL DEFAULT 'Nguyễn',
    slot_schema JSONB DEFAULT '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front", "accessory_back"]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occasions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    formality_level TEXT NOT NULL DEFAULT 'medium', -- casual, medium, formal, ceremonial
    season TEXT NOT NULL DEFAULT 'all', -- spring, summer, fall, winter, all
    criteria JSONB DEFAULT '{}'::jsonb,
    icon_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    garment_type_id TEXT REFERENCES garment_types(id) ON DELETE SET NULL,
    slot TEXT NOT NULL CHECK (slot IN ('outerwear', 'undergarment', 'bottom', 'footwear', 'headwear', 'accessory_front', 'accessory_back')),
    name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'unisex',
    description TEXT,
    era TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_variants (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_color TEXT NOT NULL,
    secondary_hex TEXT,
    material TEXT DEFAULT 'Lụa tơ tằm',
    thickness_level TEXT DEFAULT 'medium' CHECK (thickness_level IN ('light', 'medium', 'heavy')),
    pattern_description TEXT,
    price_tier TEXT DEFAULT 'standard',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_occasions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    occasion_id TEXT NOT NULL REFERENCES occasions(id) ON DELETE CASCADE,
    priority_score INT DEFAULT 10,
    editorial_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, occasion_id)
);

-- 3. Avatars & 2D Asset Layers
CREATE TABLE IF NOT EXISTS avatars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    skin_tone TEXT NOT NULL,
    body_type TEXT NOT NULL DEFAULT 'standard',
    base_image_url TEXT,
    svg_body TEXT,
    dimensions JSONB DEFAULT '{"width": 800, "height": 1200}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_layers (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id TEXT REFERENCES item_variants(id) ON DELETE CASCADE,
    avatar_id TEXT REFERENCES avatars(id) ON DELETE CASCADE,
    slot TEXT NOT NULL,
    z_index INT NOT NULL DEFAULT 10,
    anchor_x FLOAT DEFAULT 0.0,
    anchor_y FLOAT DEFAULT 0.0,
    scale_x FLOAT DEFAULT 1.0,
    scale_y FLOAT DEFAULT 1.0,
    layer_type TEXT DEFAULT 'svg' CHECK (layer_type IN ('svg', 'image_png', 'mask')),
    svg_content TEXT,
    media_asset_id UUID,
    color_mask_rule JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Media Storage (Cloudflare R2 references)
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'document')),
    mime_type TEXT NOT NULL,
    size_bytes BIGINT,
    width INT,
    height INT,
    duration_ms INT,
    owner_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting')),
    source_url TEXT,
    license_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Heritage Knowledge & Cultural Rules
CREATE TABLE IF NOT EXISTS heritage_sources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    publication_year INT,
    publisher TEXT,
    citation_text TEXT NOT NULL,
    url TEXT,
    license_type TEXT DEFAULT 'Public Reference',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heritage_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    short_summary TEXT NOT NULL, -- <80 từ
    full_content TEXT,
    structural_description TEXT,
    historical_context TEXT,
    modern_interpretation TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'reviewed', 'published')),
    reviewer_id TEXT,
    reviewed_at TIMESTAMPTZ,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id TEXT NOT NULL REFERENCES heritage_articles(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES heritage_sources(id) ON DELETE CASCADE,
    page_reference TEXT,
    quote TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES heritage_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_id, article_id)
);

CREATE TABLE IF NOT EXISTS cultural_rules (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    target_garment_type_id TEXT REFERENCES garment_types(id) ON DELETE CASCADE,
    target_slot TEXT,
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'strict')),
    condition_json JSONB NOT NULL,
    explanation TEXT NOT NULL,
    source_id TEXT REFERENCES heritage_sources(id) ON DELETE SET NULL,
    suggested_fix JSONB,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Outfits & Versions (Snapshot)
CREATE TABLE IF NOT EXISTS outfits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id TEXT, -- NULL for guest
    title TEXT NOT NULL DEFAULT 'Bản phối mới',
    occasion_id TEXT REFERENCES occasions(id) ON DELETE SET NULL,
    style_mode TEXT NOT NULL DEFAULT 'traditional' CHECK (style_mode IN ('traditional', 'remix', 'modern_fusion')),
    current_version_id UUID,
    revision INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outfit_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    snapshot_json JSONB NOT NULL,
    preview_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(outfit_id, version_number)
);

-- 7. Lookbooks & Sharing
CREATE TABLE IF NOT EXISTS lookbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lookbook_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lookbook_id UUID NOT NULL REFERENCES lookbooks(id) ON DELETE CASCADE,
    outfit_version_id UUID NOT NULL REFERENCES outfit_versions(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lookbook_id UUID REFERENCES lookbooks(id) ON DELETE CASCADE,
    outfit_version_id UUID REFERENCES outfit_versions(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    token_plain_prefix TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'view_only',
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AI Jobs & Usage (Gemini / Virtual Try-on)
CREATE TABLE IF NOT EXISTS ai_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type TEXT NOT NULL CHECK (task_type IN ('try_on', 'recommendation', 'attribute_extract')),
    owner_id TEXT,
    input_hash TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    model_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'unknown')),
    input_params JSONB NOT NULL,
    result_data JSONB,
    error_message TEXT,
    lease_until TIMESTAMPTZ,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id TEXT,
    task_type TEXT NOT NULL,
    model_name TEXT NOT NULL,
    tokens_used INT DEFAULT 0,
    cost_estimate FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Weather Cache
CREATE TABLE IF NOT EXISTS weather_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_key TEXT UNIQUE NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    weather_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Team Solution Forms (F12)
CREATE TABLE IF NOT EXISTS solution_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id TEXT NOT NULL,
    team_name TEXT NOT NULL DEFAULT 'Đội thi Việt phục Remix',
    product_name TEXT NOT NULL DEFAULT 'Việt Dáng Remix',
    target_audience TEXT,
    problem_statement TEXT,
    proposed_solution TEXT,
    cultural_safeguards TEXT,
    lookbook_references JSONB DEFAULT '[]'::jsonb,
    revision INT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_items_garment_type ON items(garment_type_id);
CREATE INDEX IF NOT EXISTS idx_items_slot ON items(slot);
CREATE INDEX IF NOT EXISTS idx_asset_layers_item ON asset_layers(item_id);
CREATE INDEX IF NOT EXISTS idx_asset_layers_avatar ON asset_layers(avatar_id);
CREATE INDEX IF NOT EXISTS idx_outfits_owner ON outfits(owner_id);
CREATE INDEX IF NOT EXISTS idx_outfit_versions_outfit ON outfit_versions(outfit_id);
CREATE INDEX IF NOT EXISTS idx_lookbooks_owner ON lookbooks(owner_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_owner ON ai_jobs(owner_id);
CREATE INDEX IF NOT EXISTS idx_weather_cache_key ON weather_cache(location_key);
