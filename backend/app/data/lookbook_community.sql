CREATE TABLE lookbook_posts (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES accounts(id),
    outfit_version_id TEXT NOT NULL REFERENCES outfit_versions(id),
    cover_media_id TEXT NOT NULL REFERENCES media_assets(id),
    title TEXT NOT NULL,
    search_title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public','private','unlisted')),
    moderation_status TEXT NOT NULL DEFAULT 'visible' CHECK(moderation_status IN ('visible','hidden')),
    moderation_reason TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    request_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT,
    UNIQUE(owner_id,request_key)
);
CREATE INDEX idx_lookbook_posts_feed ON lookbook_posts(visibility,moderation_status,is_deleted,published_at,id);
CREATE INDEX idx_lookbook_posts_owner ON lookbook_posts(owner_id,is_deleted,created_at,id);
CREATE INDEX idx_lookbook_posts_version ON lookbook_posts(outfit_version_id);
CREATE INDEX idx_lookbook_posts_media ON lookbook_posts(cover_media_id,is_deleted);
CREATE TABLE lookbook_post_shares (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES lookbook_posts(id),
    token_hash TEXT UNIQUE NOT NULL,
    token_prefix TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT
);
CREATE INDEX idx_lookbook_post_shares_post ON lookbook_post_shares(post_id,created_at,id);
CREATE TABLE lookbook_favorites (
    user_id TEXT NOT NULL REFERENCES accounts(id),
    post_id TEXT NOT NULL REFERENCES lookbook_posts(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY(user_id,post_id)
);
CREATE INDEX idx_lookbook_favorites_owner ON lookbook_favorites(user_id,created_at,post_id);
CREATE TABLE lookbook_reports (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES lookbook_posts(id),
    reporter_id TEXT NOT NULL REFERENCES accounts(id),
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    UNIQUE(post_id,reporter_id)
);
CREATE INDEX idx_lookbook_reports_queue ON lookbook_reports(status,created_at,id);
CREATE TABLE lookbook_public_profiles (
    owner_id TEXT PRIMARY KEY REFERENCES accounts(id),
    bio TEXT NOT NULL DEFAULT ''
);
UPDATE share_links SET is_revoked=1,revoked_at=CURRENT_TIMESTAMP
WHERE is_revoked=0 AND lookbook_id IN (SELECT id FROM lookbooks WHERE visibility='private');
