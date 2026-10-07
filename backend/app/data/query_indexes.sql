CREATE INDEX idx_ai_jobs_owner_task_created ON ai_jobs(owner_id, task_type, created_at DESC, id DESC);
CREATE INDEX idx_article_sources_article ON article_sources(article_id);
CREATE INDEX idx_item_occasions_occasion_item ON item_occasions(occasion_id, item_id);
CREATE INDEX idx_outfits_owner_page ON outfits(owner_id, is_deleted, updated_at DESC, id DESC);
DROP INDEX idx_outfit_versions_outfit;
