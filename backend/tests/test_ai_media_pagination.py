import json
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.database import Database, db_transaction
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService


def _ready_image(media_id, owner_id):
    bucket = settings.R2_BUCKET_PRIVATE
    MediaRepository.create_pending_media(
        media_id,
        bucket,
        f"assets/{media_id}/image.png",
        "image",
        "image/png",
        owner_id,
        "private",
        4,
        bucket,
        f"staging/{media_id}/image.png",
        9999999999,
    )
    Database.execute("UPDATE media_assets SET status='ready' WHERE id=?", (media_id,))


def test_ai_media_pages_past_large_run_of_failed_jobs_and_merges_purposes():
    owner_id = "dev-user-test-1"
    media_ids = ["ai-board", *(f"ai-result-{index}" for index in range(10))]
    for media_id in media_ids:
        _ready_image(media_id, owner_id)
    _ready_image("foreign-ai-image", "another-owner")

    base = datetime(2025, 1, 1)
    jobs = []
    for index in range(10):
        jobs.append((
            f"completed-{index}", owner_id, "hash", f"key-completed-{index}", "fake",
            "succeeded", json.dumps({
                "outfit_image_id": "ai-board",
                "user_image_id": "ai-board" if index == 0 else None,
            }), json.dumps({"result_media_id": f"ai-result-{index}"}),
            (base + timedelta(seconds=index)).strftime("%Y-%m-%d %H:%M:%S"),
        ))
    jobs.append((
        "historical-foreign", owner_id, "hash", "key-historical-foreign", "fake",
        "succeeded", json.dumps({"outfit_image_id": "foreign-ai-image"}), None,
        (base - timedelta(seconds=1)).strftime("%Y-%m-%d %H:%M:%S"),
    ))
    for index in range(1005):
        jobs.append((
            f"failed-{index:04}", owner_id, "hash", f"key-failed-{index}", "fake",
            "failed", json.dumps({"outfit_image_id": "ai-board"}), None,
            (base + timedelta(days=1, seconds=index)).strftime("%Y-%m-%d %H:%M:%S"),
        ))
    with db_transaction() as conn:
        conn.executemany(
            "INSERT INTO ai_jobs(id,owner_id,input_hash,idempotency_key,model_name,status,input_params,result_data,created_at,task_type) "
            "VALUES(?,?,?,?,?,?,?,?,?,'v3_generation')",
            jobs,
        )

    first_page = MediaService.list_ai_media(owner_id, limit=6, offset=0)
    second_page = MediaService.list_ai_media(owner_id, limit=6, offset=6)
    all_rows = first_page + second_page
    all_ids = {item.media_id for item in all_rows}

    assert len(all_rows) == 11
    assert len(all_ids) == 11
    assert {f"ai-result-{index}" for index in range(10)} <= all_ids
    assert "foreign-ai-image" not in all_ids
    board = next(item for item in all_rows if item.media_id == "ai-board")
    assert set(board.purposes) == {"outfit", "person"}
    assert all(item.status == "ready" for item in all_rows)
