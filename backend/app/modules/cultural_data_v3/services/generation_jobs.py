"""Durable, owner-scoped generation receipts. Never replay an uncertain provider call."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.database import Database, db_transaction
from app.core.errors import AppError
from app.core.rate_limit import consume
from app.modules.catalog.repository import CatalogRepository
from app.modules.cultural_data_v3.schemas import GenerationJobResponse, SynthesizeResponse
from app.modules.cultural_data_v3.services.generation import canonical_hash

logger = logging.getLogger(__name__)
JOB_TIMEOUT = 180
_tasks: dict[str, asyncio.Task] = {}


def job_id(owner_id, key):
    return "v3_" + canonical_hash({"owner": owner_id, "key": key})


def _fail(identifier, error):
    Database.execute(
        "UPDATE ai_jobs SET status='failed',error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='running'",
        (json.dumps({"code": error.code, "message": error.message, "status_code": error.status_code, "details": error.details}), identifier),
    )


def get_job(identifier, owner_id):
    row = Database.fetch_one("SELECT * FROM ai_jobs WHERE id=? AND owner_id=? AND task_type='v3_generation'", (identifier, owner_id))
    if not row:
        raise AppError("GENERATION_JOB_NOT_FOUND", "Không tìm thấy lần tạo ảnh này.", 404)
    if row["status"] == "running" and row["lease_until"]:
        deadline = datetime.fromisoformat(str(row["lease_until"])).replace(tzinfo=timezone.utc)
        if deadline < datetime.now(timezone.utc):
            _fail(identifier, AppError("GENERATION_INTERRUPTED", "Lần tạo ảnh đã bị gián đoạn. Hãy tạo một lượt mới khi muốn thử lại.", 503))
            row = Database.fetch_one("SELECT * FROM ai_jobs WHERE id=?", (identifier,))
    return GenerationJobResponse(
        job_id=identifier,
        status={"succeeded": "completed", "failed": "failed"}.get(row["status"], "running"),
        result=SynthesizeResponse.model_validate(row["result_data"]) if row["result_data"] else None,
        error=row["error_message"] or None,
    )


def _reserve(req, owner_id, require_provider=False):
    payload = req.model_dump(mode="json", exclude={"idempotency_key"})
    payload["model_id"] = req.model_id or settings.GEMINI_MODEL_IMAGE
    fingerprint = canonical_hash(payload)
    identifier = job_id(owner_id, req.idempotency_key or fingerprint)
    with db_transaction() as conn:
        existing = Database.fetch_one("SELECT input_hash FROM ai_jobs WHERE id=?", (identifier,), conn=conn)
        if existing:
            if existing["input_hash"] != fingerprint:
                raise AppError("IDEMPOTENCY_CONFLICT", "Mã tạo ảnh đã được dùng cho dữ liệu khác.", 409)
            return identifier, False
        if require_provider and (not settings.GEMINI_TRY_ON_ENABLED or not settings.GEMINI_API_KEY):
            raise AppError(
                "GENERATION_UNAVAILABLE",
                "Dịch vụ sinh ảnh chưa được cấu hình. Bộ phối của bạn vẫn được giữ nguyên.",
                503,
            )

        if not payload.get("outfit_image_id"):
            raise AppError("OUTFIT_IMAGE_REQUIRED", "Cần ảnh bản phối để thử đồ.", 422)
        if not (payload.get("outfit") or {}).get("selections") and not payload.get("legacy_item_ids"):
            raise AppError("OUTFIT_EMPTY", "Bộ phối chưa có trang phục.", 422)
        if len(payload.get("legacy_item_ids") or []) != len(set(payload.get("legacy_item_ids") or [])):
            raise AppError("DUPLICATE_OUTFIT_ITEMS", "Bộ phối có trang phục trùng.", 422)

        # Resolve public catalog references before accepting a billable job. This
        # keeps unavailable or unpublished garments from becoming asynchronous
        # media errors just because image inputs were checked first.
        item_ids = payload.get("legacy_item_ids") or []
        if len(CatalogRepository.get_published_items_by_ids(item_ids, conn=conn)) != len(item_ids):
            raise AppError("ITEM_NOT_FOUND", "Trang phục chưa được xuất bản hoặc không còn tồn tại.", 404)

        # Reserve the job and its input images under the same write transaction
        # used by media deletion. A delete that wins first marks the image before
        # this check; a reservation that wins first is visible to the deleter.
        media_ids = {payload.get("outfit_image_id"), payload.get("user_image_id")} - {None, ""}
        for media_id in media_ids:
            media = Database.fetch_one(
                "SELECT owner_id,status,media_type FROM media_assets WHERE id=?",
                (media_id,), conn=conn,
            )
            if not media or media.get("owner_id") != owner_id:
                raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy ảnh trong tài khoản.", 404)
            if media.get("status") != "ready" or media.get("media_type") != "image":
                raise AppError("MEDIA_NOT_READY", "Ảnh chưa sẵn sàng hoặc đang được xóa.", 409)

        created = Database.execute(
            "INSERT INTO ai_jobs(id,owner_id,task_type,input_hash,idempotency_key,model_name,status,input_params,lease_until) "
            "VALUES(?,?,'v3_generation',?,?,?,'running',?,?) ON CONFLICT(id) DO NOTHING",
            (identifier, owner_id, fingerprint, identifier, payload["model_id"], json.dumps(payload),
             (datetime.now(timezone.utc) + timedelta(seconds=JOB_TIMEOUT + 60)).strftime("%Y-%m-%d %H:%M:%S")),
            conn=conn,
        )
        # Also compare after INSERT to defend alternate unique-key conflict paths.
        row = Database.fetch_one("SELECT input_hash FROM ai_jobs WHERE id=?", (identifier,), conn=conn)
        if not row or row["input_hash"] != fingerprint:
            raise AppError("IDEMPOTENCY_CONFLICT", "Mã tạo ảnh đã được dùng cho dữ liệu khác.", 409)
        return identifier, bool(created)


async def _execute(identifier, req, user, generate):
    try:
        # Covers preparation, provider, storage and result validation together.
        async with asyncio.timeout(JOB_TIMEOUT):
            result = await generate(req, user)
            await run_in_threadpool(Database.execute,
                "UPDATE ai_jobs SET status='succeeded',result_data=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='running'",
                (result.model_dump_json(), identifier))
    except asyncio.CancelledError:
        await asyncio.shield(run_in_threadpool(_fail, identifier, AppError("GENERATION_INTERRUPTED", "Máy chủ đã dừng trong lúc tạo ảnh. Hãy kiểm tra lại kết quả trước khi tạo lượt mới.", 503)))
        raise
    except TimeoutError:
        await run_in_threadpool(_fail, identifier, AppError("GENERATION_TIMEOUT", "Lần tạo ảnh vượt thời gian chờ. Không tự động gửi lại Gemini.", 504))
    except AppError as exc:
        await run_in_threadpool(_fail, identifier, exc)
    except Exception:
        logger.exception("Generation job failed: %s", identifier)
        await run_in_threadpool(_fail, identifier, AppError("GENERATION_FAILED", "Không thể hoàn tất lần tạo ảnh. Vui lòng thử lại sau.", 503))


async def submit(req, user, generate, *, require_provider=False):
    identifier, created = await run_in_threadpool(_reserve, req, user.user_id, require_provider)
    if created:
        try:
            # Charge only new jobs. Polling/replaying a receipt consumes no AI quota.
            await run_in_threadpool(consume, "ai-minute", user.user_id, 10, 60)
            await run_in_threadpool(consume, "ai-day", user.user_id, 100, 86400)
        except AppError as exc:
            await run_in_threadpool(_fail, identifier, exc)
            raise
        task = asyncio.create_task(_execute(identifier, req, user, generate))
        _tasks[identifier] = task
        task.add_done_callback(lambda finished: _tasks.pop(identifier, None))
    return await run_in_threadpool(get_job, identifier, user.user_id)


async def wait_for_job(identifier, owner_id):
    task = _tasks.get(identifier)
    if task:
        # An HTTP disconnect must not cancel a paid generation already accepted.
        await asyncio.shield(task)
    receipt = await run_in_threadpool(get_job, identifier, owner_id)
    if receipt.error:
        raise AppError(**receipt.error)
    if not receipt.result:
        raise AppError("GENERATION_IN_PROGRESS", "Ảnh đang được tạo. Hãy kiểm tra trạng thái tác vụ.", 409, {"job_id": identifier})
    return receipt.result


async def poll_job(identifier, owner_id, wait_seconds=0):
    """Wait for a receipt, never cancel or replay its paid generation.

    Local jobs wake their readers immediately. For another API process, read
    the durable receipt at bounded intervals without holding a DB connection.
    """
    receipt = await run_in_threadpool(get_job, identifier, owner_id)
    if receipt.status != "running" or wait_seconds <= 0:
        return receipt
    loop = asyncio.get_running_loop()
    deadline = loop.time() + min(wait_seconds, 10)
    while receipt.status == "running":
        remaining = deadline - loop.time()
        if remaining <= 0:
            break
        task = _tasks.get(identifier)
        if task is not None:
            # asyncio.wait leaves the producer running on timeout/disconnect.
            await asyncio.wait({task}, timeout=remaining)
            return await run_in_threadpool(get_job, identifier, owner_id)
        await asyncio.sleep(min(1.0, remaining))
        receipt = await run_in_threadpool(get_job, identifier, owner_id)
    return receipt


async def shutdown():
    tasks = list(_tasks.values())
    if tasks:
        _, pending = await asyncio.wait(tasks, timeout=10)
        for task in pending:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
