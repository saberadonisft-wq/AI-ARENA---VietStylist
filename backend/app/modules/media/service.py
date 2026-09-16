import os
import uuid
from typing import Optional, Dict, Any
from app.core.config import settings
from app.infrastructure.r2.client import r2_client
from app.modules.media.repository import MediaRepository
from app.modules.media.schemas import (
    RequestUploadUrlInput,
    UploadUrlResponse,
    CompleteUploadRequest,
    MediaAssetResponse,
    AccessUrlResponse,
)
from app.core.errors import AppError


class MediaService:
    @staticmethod
    def create_upload_session(owner_id: Optional[str], req: RequestUploadUrlInput) -> UploadUrlResponse:
        media_id = str(uuid.uuid4())
        ext = os.path.splitext(req.filename)[1].lower() or ".png"
        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".svg", ".mp4"]:
            raise AppError(code="INVALID_FILE_TYPE", message="Chỉ hỗ trợ tải lên file ảnh (jpg, png, webp, svg) hoặc video mp4", status_code=400)

        bucket = settings.R2_BUCKET_PUBLIC if req.visibility == "public" else settings.R2_BUCKET_PRIVATE
        user_folder = owner_id if owner_id else "anonymous"
        object_key = f"uploads/{user_folder}/{uuid.uuid4().hex}{ext}"

        upload_data = r2_client.generate_upload_url(
            bucket=bucket,
            object_key=object_key,
            content_type=req.mime_type,
            expires_in=3600,
        )

        MediaRepository.create_pending_media(
            media_id=media_id,
            bucket=bucket,
            object_key=object_key,
            media_type=req.media_type,
            mime_type=req.mime_type,
            owner_id=owner_id,
            visibility=req.visibility,
            size_bytes=req.size_bytes,
        )

        return UploadUrlResponse(
            media_id=media_id,
            upload_url=upload_data["upload_url"],
            method=upload_data["method"],
            object_key=object_key,
            bucket=bucket,
            expires_in=upload_data["expires_in"],
            storage_type=upload_data["storage_type"],
        )

    @staticmethod
    def complete_upload(media_id: str, owner_id: str, req: CompleteUploadRequest) -> MediaAssetResponse:
        media = MediaRepository.get_media_by_id(media_id)
        if not media or media.get("owner_id") != owner_id:
            raise AppError(code="MEDIA_NOT_FOUND", message="Không tìm thấy phiên tải lên", status_code=404)

        # Kiểm tra file đã lên storage chưa
        head_info = r2_client.verify_object_exists(media["bucket"], media["object_key"])
        if not head_info or not head_info.get("size_bytes"):
            raise AppError(code="UPLOAD_INCOMPLETE", message="File chưa được tải lên hoàn tất. Vui lòng tải file rồi xác nhận lại.", status_code=409)
        size_bytes = head_info["size_bytes"]

        public_url = None
        if media["visibility"] == "public":
            public_url = r2_client.generate_access_url(media["bucket"], media["object_key"], visibility="public")

        MediaRepository.mark_media_ready(
            media_id=media_id,
            size_bytes=size_bytes,
            width=req.width,
            height=req.height,
            public_url=public_url,
        )

        updated = MediaRepository.get_media_by_id(media_id)
        return MediaAssetResponse(
            id=updated["id"],
            bucket=updated["bucket"],
            object_key=updated["object_key"],
            public_url=updated.get("public_url"),
            media_type=updated["media_type"],
            mime_type=updated["mime_type"],
            size_bytes=updated.get("size_bytes"),
            visibility=updated["visibility"],
            status=updated["status"],
            created_at=str(updated["created_at"]),
        )

    @staticmethod
    def get_access_url(media_id: str, user_id: Optional[str]) -> AccessUrlResponse:
        media = MediaRepository.get_media_by_id(media_id)
        if not media:
            raise AppError(code="MEDIA_NOT_FOUND", message="Không tìm thấy file yêu cầu", status_code=404)

        # Kiểm tra quyền nếu file private hoặc unlisted (R04: bảo vệ quyền riêng tư, trả 404 trước khi lộ trạng thái)
        if media["visibility"] in ("private", "unlisted"):
            if not user_id:
                raise AppError(code="UNAUTHORIZED", message="Yêu cầu đăng nhập để truy cập tài nguyên riêng tư", status_code=401)
            if media.get("owner_id") != user_id:
                raise AppError(code="MEDIA_NOT_FOUND", message="Không tìm thấy file yêu cầu", status_code=404)

        # Không cấp access URL cho file pending, deleting hoặc deleted (R05, A2.2)
        if media["status"] != "ready":
            raise AppError(code="MEDIA_NOT_READY", message="Tài nguyên chưa sẵn sàng để truy cập", status_code=409)

        ttl = 300  # 5 minutes per plan R05
        if r2_client.is_configured and r2_client.s3:
            url = r2_client.generate_access_url(media["bucket"], media["object_key"], visibility=media["visibility"], expires_in=ttl)
        else:
            if media["visibility"] == "public":
                url = f"http://localhost:{settings.PORT}/api/media/files/{media['bucket']}/{media['object_key']}"
            else:
                from app.modules.media.grant_utils import create_media_grant
                grant = create_media_grant(media_id=media["id"], purpose="read", expires_in=ttl)
                url = f"http://localhost:{settings.PORT}/api/media/files/{media['bucket']}/{media['object_key']}?grant={grant}"

        return AccessUrlResponse(access_url=url, expires_in=ttl)

    @staticmethod
    def delete_media(media_id: str, user_id: str) -> None:
        media = MediaRepository.get_media_by_id(media_id)
        if not media or media.get("owner_id") != user_id:
            raise AppError(code="MEDIA_NOT_FOUND", message="Không tìm thấy file yêu cầu", status_code=404)

        # 1. Đánh dấu deleting để ngăn cấp grant mới (R05)
        MediaRepository.mark_media_deleting(media_id)

        # 2. Xóa object khỏi storage
        success = r2_client.delete_object(media["bucket"], media["object_key"])

        # 3. Hoàn tất xóa nếu storage thành công (idempotent)
        if success:
            MediaRepository.delete_media(media_id)
