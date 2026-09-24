from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from app.core.config import settings
from app.core.database import Database
from app.core.errors import AppError
from app.modules.cultural_data_v3.schemas import SynthesizeRequest
from app.modules.cultural_data_v3.services import generation_jobs
from app.modules.media.repository import MediaRepository


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


def _request(media_id, key="race-key"):
    return SynthesizeRequest.model_validate({
        "outfit": {"dataset_version": "dev", "selections": []},
        "legacy_item_ids": ["item_ngu_than_nam_xanh"],
        "outfit_image_id": media_id,
        "idempotency_key": key,
    })


def test_generation_reservation_and_media_deletion_are_serialized():
    owner_id = "dev-user-test-1"
    media_id = "race-board"
    _ready_image(media_id, owner_id)
    barrier = Barrier(2)

    def reserve():
        barrier.wait(timeout=3)
        try:
            return ("reserved", generation_jobs._reserve(_request(media_id), owner_id))
        except AppError as error:
            return ("rejected", error.code)

    def mark_delete():
        barrier.wait(timeout=3)
        return MediaRepository.mark_media_deleting_if_unused(media_id, owner_id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        reserve_future = pool.submit(reserve)
        delete_future = pool.submit(mark_delete)
        reserve_result = reserve_future.result(timeout=10)
        delete_result = delete_future.result(timeout=10)

    media = MediaRepository.get_media_by_id(media_id)
    job = Database.fetch_one("SELECT status FROM ai_jobs WHERE task_type='v3_generation' AND owner_id=?", (owner_id,))
    if delete_result == "in_use":
        assert reserve_result[0] == "reserved"
        assert job and job["status"] == "running"
        assert media["status"] == "ready"
    else:
        assert delete_result == "marked"
        assert reserve_result == ("rejected", "MEDIA_NOT_READY")
        assert job is None
        assert media["status"] == "deleting"


def test_generation_reservation_rejects_another_owners_image():
    _ready_image("private-board", "another-owner")
    with pytest.raises(AppError) as error:
        generation_jobs._reserve(_request("private-board"), "dev-user-test-1")
    assert error.value.code == "MEDIA_NOT_FOUND"
