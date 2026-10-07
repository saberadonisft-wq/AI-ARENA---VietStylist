"""Backfill the indexed AI gallery once, preserving existing receipt semantics."""
import json


def backfill_ai_media(conn, *, postgres=False):
    bind = "%s" if postgres else "?"
    after = ""
    while True:
        jobs = conn.execute(
            f"SELECT id,owner_id,input_params,result_data FROM ai_jobs "
            f"WHERE task_type='v3_generation' AND id>{bind} ORDER BY id LIMIT 500",
            (after,),
        ).fetchall()
        if not jobs:
            return
        for job in jobs:
            try:
                inputs = json.loads(job["input_params"]) if isinstance(job["input_params"], str) else (job["input_params"] or {})
                result = json.loads(job["result_data"]) if isinstance(job["result_data"], str) else (job["result_data"] or {})
            except (TypeError, ValueError):
                continue
            if not isinstance(inputs, dict) or not isinstance(result, dict):
                continue
            for purpose, media_id in (("person", inputs.get("user_image_id")), ("outfit", inputs.get("outfit_image_id")), ("result", result.get("result_media_id"))):
                if not isinstance(media_id, str) or not media_id:
                    continue
                conn.execute(
                    f"INSERT INTO ai_job_media(job_id,owner_id,media_id,purpose) "
                    f"SELECT {bind},{bind},id,{bind} FROM media_assets "
                    f"WHERE id={bind} AND owner_id={bind} AND media_type='image' ON CONFLICT DO NOTHING",
                    (job["id"], job["owner_id"], purpose, media_id, job["owner_id"]),
                )
        after = jobs[-1]["id"]
