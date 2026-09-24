"""No external calls: receipts survive HTTP loss without replaying generation."""
import asyncio
from concurrent.futures import ThreadPoolExecutor

import pytest

from app.core.database import Database
from app.core.errors import AppError
from app.core.rate_limit import consume
from app.core.security import AuthenticatedUser
from app.modules.cultural_data_v3.schemas import SynthesizeRequest, SynthesizeResponse
from app.modules.cultural_data_v3.services import generation_jobs as jobs
from app.modules.media.repository import MediaRepository
from app.core.config import settings
from app.modules.try_on.repository import TryOnRepository


def ready_media(media_id, owner_id):
    bucket = settings.R2_BUCKET_PRIVATE
    object_key = f"assets/{media_id}/image.png"
    MediaRepository.create_pending_media(
        media_id, bucket, object_key, "image", "image/png", owner_id,
        "private", 4, bucket, f"staging/{media_id}/image.png", 9999999999,
    )
    Database.execute("UPDATE media_assets SET status='ready' WHERE id=?", (media_id,))


def request(key="same-key", outfit_image_id="board"):
    return SynthesizeRequest.model_validate({
        "outfit": {"dataset_version": "dev", "selections": []},
        "legacy_item_ids": ["item_ngu_than_nam_xanh"], "outfit_image_id": outfit_image_id,
        "idempotency_key": key,
    })


async def generated(_req, _user):
    return SynthesizeResponse(status="completed", model_id="test", result_media_id="private-result")


@pytest.mark.asyncio
async def test_concurrent_receipts_only_invoke_provider_once_and_recover_after_response_loss():
    user = AuthenticatedUser("dev-user-test-1")
    ready_media("board", user.user_id)
    gate = asyncio.Event()
    calls = 0

    async def generate(req, owner):
        nonlocal calls
        calls += 1
        await gate.wait()
        return await generated(req, owner)

    first, duplicate = await asyncio.gather(jobs.submit(request(), user, generate), jobs.submit(request(), user, generate))
    assert first.job_id == duplicate.job_id
    assert first.status == "running"
    waiter = asyncio.create_task(jobs.wait_for_job(first.job_id, user.user_id))
    await asyncio.sleep(0)
    waiter.cancel()
    with pytest.raises(asyncio.CancelledError):
        await waiter
    gate.set()
    result = await jobs.wait_for_job(first.job_id, user.user_id)
    replay = await jobs.submit(request(), user, generate)
    assert result.result_media_id == replay.result.result_media_id == "private-result"
    assert calls == 1
    assert Database.fetch_one("SELECT count FROM rate_limits WHERE count=1")


@pytest.mark.asyncio
async def test_receipt_is_private_and_key_conflict_is_rejected():
    user = AuthenticatedUser("dev-user-test-1")
    ready_media("board", user.user_id)
    receipt = await jobs.submit(request(), user, generated)
    await jobs.wait_for_job(receipt.job_id, user.user_id)
    with pytest.raises(AppError) as forbidden:
        jobs.get_job(receipt.job_id, "another-user")
    assert forbidden.value.status_code == 404
    changed = request().model_copy(update={"outfit_image_id": "another-board"})
    with pytest.raises(AppError) as conflict:
        await jobs.submit(changed, user, generated)
    assert conflict.value.code == "IDEMPOTENCY_CONFLICT"
    ready_media("other-board", "another-user")
    other = await jobs.submit(request(outfit_image_id="other-board"), AuthenticatedUser("another-user"), generated)
    await jobs.wait_for_job(other.job_id, "another-user")
    assert other.job_id != receipt.job_id


@pytest.mark.asyncio
async def test_rate_limit_applies_only_to_new_jobs():
    user = AuthenticatedUser("dev-user-test-1")
    ready_media("board", user.user_id)
    for index in range(10):
        receipt = await jobs.submit(request(str(index)), user, generated)
        await jobs.wait_for_job(receipt.job_id, user.user_id)
    replay = await jobs.submit(request("0"), user, generated)
    assert replay.status == "completed"
    with pytest.raises(AppError) as limited:
        await jobs.submit(request("11"), user, generated)
    assert limited.value.status_code == 429
    assert limited.value.details["retry_after"] > 0


def test_parallel_rate_limit_is_atomic():
    def attempt(_):
        try:
            consume("review", "same-owner", 5, 60)
            return True
        except AppError as error:
            assert error.status_code == 429
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(16))) == 5


@pytest.mark.asyncio
async def test_total_deadline_covers_generation_and_never_replays(monkeypatch):
    monkeypatch.setattr(jobs, "JOB_TIMEOUT", 0.02)
    calls = 0
    async def slow(_req, _user):
        nonlocal calls
        calls += 1
        await asyncio.Event().wait()
    user = AuthenticatedUser("dev-user-test-1")
    ready_media("board", user.user_id)
    receipt = await jobs.submit(request(), user, slow)
    with pytest.raises(AppError) as timeout:
        await jobs.wait_for_job(receipt.job_id, user.user_id)
    assert timeout.value.code == "GENERATION_TIMEOUT"
    assert (await jobs.submit(request(), user, slow)).status == "failed"
    assert calls == 1


def test_expired_job_is_failed_and_legacy_worker_cannot_claim_it():
    ready_media("board", "dev-user-test-1")
    identifier, created = jobs._reserve(request(), "dev-user-test-1")
    assert created
    Database.execute("UPDATE ai_jobs SET lease_until='2000-01-01 00:00:00' WHERE id=?", (identifier,))
    assert TryOnRepository.claim_queued_job() is None
    receipt = jobs.get_job(identifier, "dev-user-test-1")
    assert receipt.status == "failed"
    assert receipt.error["code"] == "GENERATION_INTERRUPTED"


def test_job_status_endpoint_requires_owner():
    from fastapi.testclient import TestClient
    from app.main import app
    from conftest import auth_header
    ready_media("another-board", "another-user")
    identifier, _ = jobs._reserve(request(outfit_image_id="another-board"), "another-user")
    with TestClient(app) as client:
        assert client.get(f"/api/v3/generation/jobs/{identifier}").status_code == 401
        assert client.get(f"/api/v3/generation/jobs/{identifier}", headers={"Authorization": auth_header("dev-user-test-1")}).status_code == 404


@pytest.mark.asyncio
async def test_http_submit_returns_before_provider_and_poll_recovers_result(monkeypatch):
    import httpx
    from app.main import app
    from app.modules.cultural_data_v3 import router
    from app.core.config import settings
    from conftest import auth_header
    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    gate = asyncio.Event()
    calls = 0
    async def delayed(req, user):
        nonlocal calls
        calls += 1
        await gate.wait()
        return await generated(req, user)
    monkeypatch.setattr(router, "_generate_image", delayed)
    headers = {"Authorization": auth_header("dev-user-test-1")}
    ready_media("board", "dev-user-test-1")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post("/api/v3/generation/jobs", headers=headers, json=request().model_dump())
        assert first.status_code == 202
        identifier = first.json()["job_id"]
        assert first.json()["status"] == "running"
        duplicate = await client.post("/api/v3/generation/jobs", headers=headers, json=request().model_dump())
        assert duplicate.json()["job_id"] == identifier
        gate.set()
        await jobs.wait_for_job(identifier, "dev-user-test-1")
        result = await client.get(f"/api/v3/generation/jobs/{identifier}", headers=headers)
        assert result.json()["status"] == "completed"
        assert result.json()["result"]["result_media_id"] == "private-result"
        assert calls == 1
