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
from app.modules.media.repository import MediaRepository
from app.core.errors import AppError

router = APIRouter(prefix="/media", tags=["Cloudflare R2 Media Management"])


from app.core.security import get_current_user_optional, require_current_user, AuthenticatedUser

@router.post("/uploads", response_model=UploadUrlResponse)
async def request_upload_url(
    req: RequestUploadUrlInput,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """
    Tạo phiên tải lên file ảnh/video và cấp URL upload có hạn (Direct to R2) (F14, R04).
    """
    return MediaService.create_upload_session(user.user_id, req)


@router.post("/{media_id}/complete", response_model=MediaAssetResponse)
async def complete_upload(
    media_id: str,
    req: CompleteUploadRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """
    Xác nhận hoàn tất upload bởi chính chủ sở hữu phiên tải lên (R04).
    """
    return MediaService.complete_upload(media_id, user.user_id, req)


@router.get("/{media_id}/access", response_model=AccessUrlResponse)
async def get_media_access(
    media_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Cấp URL truy cập ngắn hạn cho file riêng tư sau khi xác thực quyền người dùng (R04, R05).
    """
    user_id = user.user_id if user else None
    return MediaService.get_access_url(media_id, user_id)


@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Xóa file thuộc sở hữu của người dùng (R04)."""
    MediaService.delete_media(media_id, user.user_id)
    return {"message": "Đã xóa file thành công"}


# --- Local Development Endpoints (Khi chưa cấu hình R2 credentials) ---

from app.modules.media.path_utils import safe_join_media_path


@router.post("/local-upload/{media_id}")
async def handle_local_upload_by_id(
    media_id: str,
    file: UploadFile = File(...),
    grant: str = Query(...),
):
    """Upload file cục bộ qua media_id và signed grant (R01, R05)."""
    if not settings.is_local_media_enabled():
        raise AppError(code="ENDPOINT_NOT_FOUND", message="Endpoint upload local chỉ hoạt động ở môi trường dev.", status_code=404)

    from app.modules.media.grant_utils import verify_media_grant
    if not verify_media_grant(grant, expected_media_id=media_id, expected_purpose="upload"):
        raise AppError(code="FORBIDDEN", message="Grant upload không hợp lệ hoặc đã hết hạn.", status_code=403)

    media = MediaRepository.get_media_by_id(media_id)
    if not media or media.get("status") != "pending":
        raise AppError(code="INVALID_UPLOAD_SESSION", message="Phiên tải lên không hợp lệ hoặc đã hoàn tất.", status_code=400)

    target_path = safe_join_media_path(settings.LOCAL_MEDIA_DIR, media["bucket"], media["object_key"])
    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    MAX_BYTES = 50 * 1024 * 1024
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise AppError(code="PAYLOAD_TOO_LARGE", message="File vượt quá dung lượng tối đa cho phép (50MB).", status_code=413)

    with open(target_path, "wb") as f:
        f.write(content)

    return {"status": "success", "size": len(content), "media_id": media_id}


@router.post("/local-upload")
async def handle_local_upload(
    file: UploadFile = File(...),
    key: str = Query(...),
    bucket: str = Query("viet-phuc-public"),
):
    """Endpoint dev lưu file cục bộ (chỉ nhận key thuộc pending session hợp lệ, R01)."""
    if not settings.is_local_media_enabled():
        raise AppError(code="ENDPOINT_NOT_FOUND", message="Endpoint upload local chỉ hoạt động ở môi trường dev.", status_code=404)

    target_path = safe_join_media_path(settings.LOCAL_MEDIA_DIR, bucket, key)

    media = MediaRepository.get_media_by_bucket_and_key(bucket, key)
    if not media or media.get("status") != "pending":
        raise AppError(code="INVALID_UPLOAD_SESSION", message="Phiên tải lên không hợp lệ hoặc đã hoàn tất.", status_code=400)

    os.makedirs(os.path.dirname(target_path), exist_ok=True)

    MAX_BYTES = 50 * 1024 * 1024
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise AppError(code="PAYLOAD_TOO_LARGE", message="File vượt quá dung lượng tối đa cho phép (50MB).", status_code=413)

    with open(target_path, "wb") as f:
        f.write(content)

    return {"status": "success", "size": len(content), "key": key}


@router.get("/files/{bucket}/{file_path:path}")
async def serve_local_file(
    bucket: str,
    file_path: str,
    grant: Optional[str] = Query(None),
):
    """Endpoint dev phục vụ file tĩnh cục bộ có kiểm tra grant cho private media (R01, R05)."""
    if not settings.is_local_media_enabled():
        raise AppError(code="ENDPOINT_NOT_FOUND", message="Endpoint phục vụ file local chỉ hoạt động ở môi trường dev.", status_code=404)

    full_path = safe_join_media_path(settings.LOCAL_MEDIA_DIR, bucket, file_path)

    asset = MediaRepository.get_media_by_bucket_and_key(bucket, file_path)

    # Chặn đọc file private nếu không có signed grant hợp lệ (R05)
    if bucket == settings.R2_BUCKET_PRIVATE:
        if not grant:
            raise AppError(code="FORBIDDEN", message="Tài nguyên riêng tư yêu cầu access grant hợp lệ.", status_code=403)
        if not asset:
            raise AppError(code="FILE_NOT_FOUND", message="Không tìm thấy file trên hệ thống", status_code=404)
        if asset["status"] != "ready":
            raise AppError(code="MEDIA_NOT_READY", message="Tài nguyên chưa ở trạng thái sẵn sàng", status_code=409)
        from app.modules.media.grant_utils import verify_media_grant
        if not verify_media_grant(grant, expected_media_id=asset["id"], expected_purpose="read"):
            raise AppError(code="FORBIDDEN", message="Grant truy cập không hợp lệ hoặc đã hết hạn.", status_code=403)
    else:
        # File public đã đăng ký trong DB nhưng chưa ready thì không phục vụ
        if asset and asset["status"] != "ready":
            raise AppError(code="MEDIA_NOT_READY", message="Tài nguyên chưa ở trạng thái sẵn sàng", status_code=409)

    if not os.path.exists(full_path):
        raise AppError(code="FILE_NOT_FOUND", message="Không tìm thấy file trên ổ đĩa", status_code=404)
    return FileResponse(full_path)
