CREATE TRIGGER ai_job_media_insert AFTER INSERT ON ai_job_media BEGIN
    INSERT INTO ai_media_library(owner_id, media_id, created_at)
    SELECT NEW.owner_id, id, created_at FROM media_assets WHERE id = NEW.media_id
    ON CONFLICT(owner_id, media_id) DO NOTHING;
END;
CREATE TRIGGER ai_job_media_delete AFTER DELETE ON ai_job_media BEGIN
    DELETE FROM ai_media_library WHERE owner_id = OLD.owner_id AND media_id = OLD.media_id
    AND NOT EXISTS (SELECT 1 FROM ai_job_media r WHERE r.owner_id = OLD.owner_id AND r.media_id = OLD.media_id);
END;
CREATE TRIGGER ai_jobs_media_insert AFTER INSERT ON ai_jobs BEGIN
    DELETE FROM ai_job_media WHERE job_id = NEW.id;
    INSERT INTO ai_job_media(job_id, owner_id, media_id, purpose)
    SELECT NEW.id, NEW.owner_id, m.id, r.purpose
    FROM (
        SELECT 'person' AS purpose, json_extract(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.user_image_id') AS media_id, json_type(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.user_image_id') AS value_type
        UNION ALL SELECT 'outfit', json_extract(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.outfit_image_id'), json_type(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.outfit_image_id')
        UNION ALL SELECT 'result', json_extract(CASE WHEN json_valid(NEW.result_data) THEN NEW.result_data ELSE '{}' END, '$.result_media_id'), json_type(CASE WHEN json_valid(NEW.result_data) THEN NEW.result_data ELSE '{}' END, '$.result_media_id')
    ) r
    JOIN media_assets m ON m.id = r.media_id AND m.owner_id = NEW.owner_id AND m.media_type = 'image'
    WHERE NEW.task_type = 'v3_generation' AND r.value_type = 'text' AND r.media_id <> ''
    AND (NEW.input_params IS NULL OR json_valid(NEW.input_params))
    AND (NEW.result_data IS NULL OR json_valid(NEW.result_data))
    AND json_type(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END) = 'object' AND json_type(CASE WHEN json_valid(NEW.result_data) THEN NEW.result_data ELSE '{}' END) = 'object';
END;
CREATE TRIGGER ai_jobs_media_update AFTER UPDATE OF owner_id, task_type, input_params, result_data ON ai_jobs BEGIN
    DELETE FROM ai_job_media WHERE job_id = NEW.id;
    INSERT INTO ai_job_media(job_id, owner_id, media_id, purpose)
    SELECT NEW.id, NEW.owner_id, m.id, r.purpose
    FROM (
        SELECT 'person' AS purpose, json_extract(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.user_image_id') AS media_id, json_type(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.user_image_id') AS value_type
        UNION ALL SELECT 'outfit', json_extract(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.outfit_image_id'), json_type(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END, '$.outfit_image_id')
        UNION ALL SELECT 'result', json_extract(CASE WHEN json_valid(NEW.result_data) THEN NEW.result_data ELSE '{}' END, '$.result_media_id'), json_type(CASE WHEN json_valid(NEW.result_data) THEN NEW.result_data ELSE '{}' END, '$.result_media_id')
    ) r
    JOIN media_assets m ON m.id = r.media_id AND m.owner_id = NEW.owner_id AND m.media_type = 'image'
    WHERE NEW.task_type = 'v3_generation' AND r.value_type = 'text' AND r.media_id <> ''
    AND (NEW.input_params IS NULL OR json_valid(NEW.input_params))
    AND (NEW.result_data IS NULL OR json_valid(NEW.result_data))
    AND json_type(CASE WHEN json_valid(NEW.input_params) THEN NEW.input_params ELSE '{}' END) = 'object' AND json_type(CASE WHEN json_valid(NEW.result_data) THEN NEW.result_data ELSE '{}' END) = 'object';
END;
CREATE TRIGGER ai_media_timestamp_update AFTER UPDATE OF created_at ON media_assets BEGIN
    UPDATE ai_media_library SET created_at = NEW.created_at WHERE media_id = NEW.id;
END;
