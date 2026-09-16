import os
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Query, status
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.security import get_current_user_optional, AuthenticatedUser
from app.modules.media.schemas import (
    RequestUploadUrlInput,
    UploadUrlResponse,
    CompleteUploadRequest,
    MediaAssetResponse,
    AccessUrlResponse,
)
from app.modules.media.service import MediaService
from app.core.errors import AppError

router = APIRouter(prefix="/media", tags=["Cloudflare R2 Media Management"])


@router.post("/uploads", response_model=UploadUrlResponse)
async def request_upload_url(
    req: RequestUploadUrlInput,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Tạo phiên tải lên file ảnh/video và cấp URL upload có hạn (Direct to R2) (F14).
    """
    user_id = user.user_id if user else None
    return MediaService.create_upload_session(user_id, req)


@router.post("/{media_id}/complete", response_model=MediaAssetResponse)
async def complete_upload(
    media_id: str,
    req: CompleteUploadRequest,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Xác nhận hoàn tất upload, kiểm tra HEAD và metadata trên storage trước khi chuyển trạng thái 'ready'.
    """
    user_id = user.user_id if user else None
    return MediaService.complete_upload(media_id, user_id, req)


@router.get("/{media_id}/access", response_model=AccessUrlResponse)
async def get_media_access(
    media_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Cấp URL truy cập ngắn hạn cho file riêng tư sau khi xác thực quyền người dùng.
    """
    user_id = user.user_id if user else None
    return MediaService.get_access_url(media_id, user_id)


@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """Xóa file khỏi R2 và Supabase."""
    user_id = user.user_id if user else None
    MediaService.delete_media(media_id, user_id)
    return {"message": "Đã xóa file thành công"}


# --- Local Development Endpoints (Khi chưa cấu hình R2 credentials) ---

from app.modules.media.path_utils import safe_join_media_path


@router.post("/local-upload")
async def handle_local_upload(
    file: UploadFile = File(...),
    key: str = Query(...),
    bucket: str = Query("viet-phuc-public"),
):
    """Endpoint dev lưu file cục bộ khi chạy offline."""
    if not settings.is_local_media_enabled():
        raise AppError(code="ENDPOINT_NOT_FOUND", message="Endpoint upload local chỉ hoạt động ở môi trường dev.", status_code=404)

    target_path = safe_join_media_path(settings.LOCAL_MEDIA_DIR, bucket, key)
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    MAX_BYTES = 50 * 1024 * 1024
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise AppError(code="PAYLOAD_TOO_LARGE", message="File vượt quá dung lượng tối đa cho phép (50MB).", status_code=413)

    with open(target_path, "wb") as f:
        f.write(content)

    return {"status": "success", "size": len(content), "key": key}


@router.get("/files/{bucket}/{file_path:path}")
async def serve_local_file(bucket: str, file_path: str):
    """Endpoint dev phục vụ file tĩnh cục bộ."""
    if not settings.is_local_media_enabled():
        raise AppError(code="ENDPOINT_NOT_FOUND", message="Endpoint phục vụ file local chỉ hoạt động ở môi trường dev.", status_code=404)

    # Chặn đọc file private trực tiếp mà không qua grant (R05)
    if bucket == settings.R2_BUCKET_PRIVATE:
        raise AppError(code="FORBIDDEN", message="Tài nguyên riêng tư không thể truy cập trực tiếp.", status_code=403)

    full_path = safe_join_media_path(settings.LOCAL_MEDIA_DIR, bucket, file_path)
    if not os.path.exists(full_path):
        raise AppError(code="FILE_NOT_FOUND", message="Không tìm thấy file trên ổ đĩa", status_code=404)
    return FileResponse(full_path)
