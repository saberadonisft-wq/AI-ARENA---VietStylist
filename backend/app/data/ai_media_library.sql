CREATE TABLE ai_job_media (
    job_id TEXT NOT NULL REFERENCES ai_jobs(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('person', 'outfit', 'result')),
    PRIMARY KEY (job_id, media_id, purpose)
);
CREATE INDEX idx_ai_job_media_owner_media ON ai_job_media(owner_id, media_id, purpose);
CREATE INDEX idx_ai_job_media_media ON ai_job_media(media_id);

CREATE TABLE ai_media_library (
    owner_id TEXT NOT NULL,
    media_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (owner_id, media_id)
);
CREATE INDEX idx_ai_media_library_owner_page ON ai_media_library(owner_id, created_at DESC, media_id DESC);
