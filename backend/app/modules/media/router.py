from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query
from fastapi.responses import Response
from app.core.config import settings
from app.core.security import (
    get_current_user_optional,
    require_current_user,
    AuthenticatedUser,
)
from app.core.errors import AppError
from app.modules.media.schemas import (
    RequestUploadUrlInput,
    UploadUrlResponse,
    CompleteUploadRequest,
    MediaAssetResponse,
    AccessUrlResponse,
    AIMediaResponse,
)
from app.modules.media.service import MediaService
from app.modules.media.repository import MediaRepository
from app.modules.media.grant_utils import verify_media_grant
from app.infrastructure.r2.client import r2_client
from app.modules.media.validation import byte_limit

router = APIRouter(prefix="/media", tags=["Cloudflare R2 Media Management"])
local_router = APIRouter(
    prefix="/media", tags=["Development media"], include_in_schema=False
)


@router.post("/uploads", response_model=UploadUrlResponse)
def request_upload_url(
    req: RequestUploadUrlInput, user: AuthenticatedUser = Depends(require_current_user)
):
    return MediaService.create_upload_session(user.user_id, req, user.roles)


@router.get("/ai", response_model=list[AIMediaResponse])
def list_ai_media(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=10000),
    user: AuthenticatedUser = Depends(require_current_user),
):
    return MediaService.list_ai_media(user.user_id, limit=limit, offset=offset)


@router.post("/{media_id}/complete", response_model=MediaAssetResponse)
def complete_upload(
    media_id: str,
    req: CompleteUploadRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    return MediaService.complete_upload(media_id, user.user_id, req)


@router.get("/{media_id}/access", response_model=AccessUrlResponse)
def get_media_access(
    media_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    return MediaService.get_access_url(media_id, user.user_id if user else None)


@router.delete("/{media_id}")
def delete_media(
    media_id: str, user: AuthenticatedUser = Depends(require_current_user)
):
    MediaService.delete_media(media_id, user.user_id)
    return {"message": "Đã xóa file thành công", "status": "deleted"}


@local_router.post("/local-upload/{media_id}")
def handle_local_upload_by_id(
    media_id: str, file: UploadFile = File(...), grant: str = Query(...)
):
    return MediaService.local_upload(media_id, grant, file.file)


@local_router.post("/local-upload")
def handle_legacy_upload():
    if not settings.is_local_media_enabled():
        raise AppError("ENDPOINT_NOT_FOUND", "Endpoint local không khả dụng", 404)
    raise AppError(
        "LEGACY_UPLOAD_DISABLED", "Tạo phiên upload mới bằng /media/uploads", 410
    )


@local_router.get("/files/{bucket}/{file_path:path}")
def serve_local_file(bucket: str, file_path: str, grant: Optional[str] = Query(None)):
    if not settings.is_local_media_enabled() or r2_client.is_configured:
        raise AppError("ENDPOINT_NOT_FOUND", "Endpoint local không khả dụng", 404)
    from app.modules.media.path_utils import safe_join_media_path

    safe_join_media_path(settings.LOCAL_MEDIA_DIR, bucket, file_path)
    asset = MediaRepository.get_media_by_bucket_and_key(bucket, file_path)
    if not asset:
        raise AppError("FILE_NOT_FOUND", "Không tìm thấy file", 404)
    if asset["status"] != "ready":
        raise AppError("MEDIA_NOT_READY", "File chưa sẵn sàng", 409)
    if asset["visibility"] != "public" or bucket != settings.R2_BUCKET_PUBLIC:
        if not verify_media_grant(grant, asset["id"], "read"):
            raise AppError("FORBIDDEN", "Cần grant truy cập hợp lệ", 403)
    try:
        data = r2_client.read_object(bucket, file_path, byte_limit(asset["media_type"]))
    except FileNotFoundError:
        raise AppError("FILE_NOT_FOUND", "Không tìm thấy file", 404)
    return Response(
        data,
        media_type=asset["mime_type"],
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
        },
    )
