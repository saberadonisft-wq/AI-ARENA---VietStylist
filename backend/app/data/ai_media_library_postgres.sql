CREATE FUNCTION track_ai_media_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO ai_media_library(owner_id, media_id, created_at)
        SELECT NEW.owner_id, id, created_at FROM media_assets WHERE id = NEW.media_id
        ON CONFLICT (owner_id, media_id) DO NOTHING;
        RETURN NEW;
    END IF;
    DELETE FROM ai_media_library l WHERE l.owner_id = OLD.owner_id AND l.media_id = OLD.media_id
    AND NOT EXISTS (SELECT 1 FROM ai_job_media r WHERE r.owner_id = l.owner_id AND r.media_id = l.media_id);
    RETURN OLD;
END;
$$;
CREATE TRIGGER ai_job_media_insert AFTER INSERT ON ai_job_media FOR EACH ROW EXECUTE FUNCTION track_ai_media_reference();
CREATE TRIGGER ai_job_media_delete AFTER DELETE ON ai_job_media FOR EACH ROW EXECUTE FUNCTION track_ai_media_reference();

CREATE FUNCTION sync_ai_job_media() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    inputs JSONB;
    result JSONB;
BEGIN
    DELETE FROM ai_job_media WHERE job_id = NEW.id;
    IF NEW.task_type <> 'v3_generation' OR NEW.owner_id IS NULL THEN
        RETURN NEW;
    END IF;
    BEGIN
        inputs := COALESCE(NEW.input_params::jsonb, '{}'::jsonb);
        result := COALESCE(NEW.result_data::jsonb, '{}'::jsonb);
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NEW;
    END;
    IF jsonb_typeof(inputs) <> 'object' OR jsonb_typeof(result) <> 'object' THEN
        RETURN NEW;
    END IF;
    INSERT INTO ai_job_media(job_id, owner_id, media_id, purpose)
    SELECT NEW.id, NEW.owner_id, m.id, r.purpose
    FROM (VALUES
        ('person', inputs->>'user_image_id', jsonb_typeof(inputs->'user_image_id')),
        ('outfit', inputs->>'outfit_image_id', jsonb_typeof(inputs->'outfit_image_id')),
        ('result', result->>'result_media_id', jsonb_typeof(result->'result_media_id'))
    ) AS r(purpose, media_id, value_type)
    JOIN media_assets m ON m.id = r.media_id AND m.owner_id = NEW.owner_id AND m.media_type = 'image'
    WHERE r.value_type = 'string' AND r.media_id <> ''
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;
CREATE TRIGGER ai_jobs_media_insert AFTER INSERT ON ai_jobs FOR EACH ROW EXECUTE FUNCTION sync_ai_job_media();
CREATE TRIGGER ai_jobs_media_update AFTER UPDATE OF owner_id, task_type, input_params, result_data ON ai_jobs FOR EACH ROW EXECUTE FUNCTION sync_ai_job_media();

CREATE FUNCTION update_ai_media_timestamp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE ai_media_library SET created_at = NEW.created_at WHERE media_id = NEW.id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER ai_media_timestamp_update AFTER UPDATE OF created_at ON media_assets FOR EACH ROW EXECUTE FUNCTION update_ai_media_timestamp();
