import time
import uuid
from pathlib import PurePosixPath
from app.core.config import settings
from app.core.database import Database
from app.core.errors import AppError
from app.infrastructure.r2.client import r2_client
from app.modules.media.repository import MediaRepository
from app.modules.media.grant_utils import create_media_grant, verify_media_grant
from app.modules.media.schemas import (
    CompleteUploadRequest,
    RequestUploadUrlInput,
    UploadUrlResponse,
    MediaAssetResponse,
    AccessUrlResponse,
)
from app.modules.media.validation import TYPES, byte_limit, validate_content


class MediaService:
    @staticmethod
    def create_upload_session(owner_id, req, roles=()):
        r2_client.require_available()
        if not owner_id:
            raise AppError("UNAUTHORIZED", "Yêu cầu đăng nhập", 401)
        privileged = bool(set(roles) & {"admin", "editor"})
        ext = PurePosixPath(req.filename).suffix.lower()
        if ext not in TYPES or TYPES[ext] != (req.mime_type, req.media_type):
            raise AppError(
                "INVALID_FILE_TYPE",
                "Đuôi file, MIME và media_type phải khớp loại được hỗ trợ",
                422,
            )
        if (req.visibility == "public" or ext == ".svg") and not privileged:
            raise AppError(
                "FORBIDDEN", "Chỉ admin/editor được tải tài nguyên public hoặc SVG", 403
            )
        if req.size_bytes and req.size_bytes > byte_limit(req.media_type):
            raise AppError("PAYLOAD_TOO_LARGE", "File vượt giới hạn dung lượng", 413)
        media_id = str(uuid.uuid4())
        staging_bucket = settings.R2_BUCKET_PRIVATE
        staging_key = f"staging/{media_id}/{uuid.uuid4().hex}{ext}"
        final_bucket = (
            settings.R2_BUCKET_PUBLIC
            if req.visibility == "public"
            else settings.R2_BUCKET_PRIVATE
        )
        ttl = settings.MEDIA_UPLOAD_TTL
        if r2_client.is_configured:
            upload = r2_client.generate_upload_url(
                staging_bucket, staging_key, req.mime_type, ttl
            )
        else:
            grant = create_media_grant(media_id, "upload", ttl)
            upload = {
                "upload_url": f"{settings.API_PUBLIC_ORIGIN.rstrip('/')}/api/media/local-upload/{media_id}?grant={grant}",
                "method": "POST",
                "storage_type": "local",
                "expires_in": ttl,
            }
        MediaRepository.create_pending_media(
            media_id,
            final_bucket,
            f"reserved/{media_id}{ext}",
            req.media_type,
            req.mime_type,
            owner_id,
            req.visibility,
            req.size_bytes,
            staging_bucket,
            staging_key,
            int(time.time()) + ttl,
        )
        return UploadUrlResponse(
            media_id=media_id, object_key=staging_key, bucket=staging_bucket, **upload
        )

    @staticmethod
    def local_upload(media_id, grant, stream):
        if not settings.is_local_media_enabled() or r2_client.is_configured:
            raise AppError("ENDPOINT_NOT_FOUND", "Endpoint local không khả dụng", 404)
        if not verify_media_grant(grant, media_id, "upload"):
            raise AppError("FORBIDDEN", "Grant không hợp lệ hoặc hết hạn", 403)
        media = MediaRepository.get_media_by_id(media_id)
        if not media or not media["staging_key"]:
            raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy phiên upload", 404)
        token = MediaRepository.claim(media_id, "pending", "uploading")
        try:
            content = stream.read(byte_limit(media["media_type"]) + 1)
            if len(content) > byte_limit(media["media_type"]):
                raise AppError(
                    "PAYLOAD_TOO_LARGE", "File vượt giới hạn dung lượng", 413
                )
            r2_client.put_object(
                media["staging_bucket"],
                media["staging_key"],
                content,
                media["mime_type"],
            )
            if not MediaRepository.release(media_id, token, "uploaded"):
                r2_client.delete_object(media["staging_bucket"], media["staging_key"])
                raise AppError(
                    "INVALID_UPLOAD_STATE", "Phiên upload đã bị thu hồi", 409
                )
        except AppError:
            MediaRepository.release(media_id, token, "rejected")
            raise
        except Exception as exc:
            MediaRepository.release(media_id, token, "rejected")
            raise AppError("STORAGE_UNAVAILABLE", "Không ghi được file vào storage",503) from exc
        return {"status": "uploaded", "size": len(content), "media_id": media_id}

    @staticmethod
    def complete_upload(media_id, owner_id, req):
        media = MediaService._owned(media_id, owner_id)
        if media["status"] == "ready":
            return MediaAssetResponse(**media)
        expected = "pending" if r2_client.is_configured else "uploaded"
        if media["status"] != expected or not media["staging_key"]:
            raise AppError(
                "INVALID_UPLOAD_STATE",
                "Upload chưa hoàn tất hoặc phiên không còn hợp lệ",
                409,
            )
        token = MediaRepository.claim(media_id, expected, "processing")
        try:
            head = r2_client.verify_object_exists(
                media["staging_bucket"], media["staging_key"]
            )
            if not head or not head.get("size_bytes"):
                raise AppError("UPLOAD_INCOMPLETE", "Chưa có dữ liệu trên storage", 409)
            if head["size_bytes"] > byte_limit(media["media_type"]):
                raise AppError(
                    "PAYLOAD_TOO_LARGE", "File vượt giới hạn dung lượng", 413
                )
            original = r2_client.read_object(
                media["staging_bucket"],
                media["staging_key"],
                byte_limit(media["media_type"]),
            )
            data, width, height, duration = validate_content(
                original, media["mime_type"]
            )
            key = (
                f"assets/{media_id}/{token}{PurePosixPath(media['staging_key']).suffix}"
            )
            bucket = media["bucket"]
            MediaRepository.reserve_final(media_id, token, bucket, key)
            r2_client.put_object(bucket, key, data, media["mime_type"])
            public_url = (
                r2_client.generate_access_url(bucket, key, "public")
                if media["visibility"] == "public"
                else None
            )
            if not MediaRepository.publish(
                media_id, token, bucket, key, data, width, height, duration, public_url
            ):
                r2_client.delete_object(bucket, key)
                raise AppError("INVALID_UPLOAD_STATE", "Phiên xử lý đã bị thu hồi", 409)
        except AppError as exc:
            MediaRepository.release(
                media_id,
                token,
                "rejected" if exc.status_code in (413, 422) else expected,
            )
            raise
        except Exception as exc:
            MediaRepository.release(media_id, token, expected)
            raise AppError(
                "STORAGE_UNAVAILABLE", "Không hoàn tất được upload; có thể thử lại", 503
            ) from exc
        # Retain the staging ledger until its PUT capability has expired; cleanup retries.
        r2_client.delete_object(media["staging_bucket"], media["staging_key"])
        return MediaAssetResponse(**MediaRepository.get_media_by_id(media_id))

    @staticmethod
    def ingest_generated_image(owner_id, content, mime_type):
        """Validate and store provider-generated bytes through the normal media ledger."""
        extensions = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }
        extension = extensions.get(mime_type)
        if not extension:
            raise AppError(
                "GENERATION_INVALID_MEDIA",
                "Provider trả về định dạng ảnh không được hỗ trợ.",
                502,
            )

        clean, _, _, _ = validate_content(content, mime_type)
        session = MediaService.create_upload_session(
            owner_id,
            RequestUploadUrlInput(
                filename=f"gemini-result{extension}",
                media_type="image",
                mime_type=mime_type,
                size_bytes=len(clean),
                visibility="private",
            ),
        )
        try:
            r2_client.put_object(session.bucket, session.object_key, clean, mime_type)
            if not r2_client.is_configured:
                token = MediaRepository.claim(session.media_id, "pending", "uploading")
                if not MediaRepository.release(session.media_id, token, "uploaded"):
                    raise AppError(
                        "INVALID_UPLOAD_STATE", "Không thể hoàn tất media kết quả.", 409
                    )
            return MediaService.complete_upload(
                session.media_id, owner_id, CompleteUploadRequest()
            )
        except Exception:
            try:
                MediaService.delete_media(session.media_id, owner_id)
            except Exception:
                pass
            raise

    @staticmethod
    def read_owned_image(media_id, owner_id):
        media = MediaService._owned(media_id, owner_id)
        if media["status"] != "ready" or media["media_type"] != "image":
            raise AppError("MEDIA_NOT_READY", "Ảnh người dùng chưa sẵn sàng.", 409)
        content = r2_client.read_object(
            media["bucket"], media["object_key"], byte_limit("image")
        )
        clean, _, _, _ = validate_content(content, media["mime_type"])
        return clean, media["mime_type"]

    @staticmethod
    def probe_image(media):
        try:
            content = r2_client.read_object(
                media["bucket"], media["object_key"], byte_limit("image")
            )
            validate_content(content, media["mime_type"])
            return True
        except Exception:
            return False

    @staticmethod
    def _owned(media_id, user_id):
        media = MediaRepository.get_media_by_id(media_id)
        if not media or media.get("owner_id") != user_id:
            raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy file", 404)
        return media

    @staticmethod
    def get_access_url(media_id, user_id):
        media = MediaRepository.get_media_by_id(media_id)
        if not media:
            raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy file", 404)
        if media["visibility"] != "public":
            if not user_id:
                raise AppError("UNAUTHORIZED", "Yêu cầu đăng nhập", 401)
            if media["owner_id"] != user_id:
                raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy file", 404)
        if media["status"] != "ready":
            raise AppError("MEDIA_NOT_READY", "File chưa sẵn sàng", 409)
        url = r2_client.generate_access_url(
            media["bucket"],
            media["object_key"],
            "public" if media["visibility"] == "public" else "private",
            300,
        )
        if not r2_client.is_configured and media["visibility"] != "public":
            url += "?grant=" + create_media_grant(media_id, "read", 300)
        return AccessUrlResponse(access_url=url, expires_in=300)

    @staticmethod
    def delete_media(media_id, user_id):
        media = MediaService._owned(media_id, user_id)
        if not MediaRepository.mark_media_deleting(media_id):
            raise AppError("MEDIA_BUSY", "File đang được xử lý; thử lại sau", 409)
        objects = MediaRepository.objects(media_id)
        # Legacy rows may have been inserted by import scripts after migration.
        keys = {(o["bucket"], o["object_key"]) for o in objects} | {
            (media["bucket"], media["object_key"])
        }
        for bucket, key in keys:
            if bucket not in {
                settings.R2_BUCKET_PUBLIC,
                settings.R2_BUCKET_PRIVATE,
            } or not key.startswith(
                (
                    f"staging/{media_id}/",
                    f"assets/{media_id}/",
                    f"reserved/{media_id}",
                    f"uploads/{user_id}/",
                )
            ):
                raise AppError(
                    "UNSAFE_STORAGE_REFERENCE",
                    "Cần đối soát key storage cũ trước khi xóa",
                    409,
                )
        results = [r2_client.delete_object(bucket, key) for bucket, key in keys]
        if not all(results):
            raise AppError(
                "STORAGE_DELETE_FAILED", "Chưa xóa xong file; hệ thống sẽ thử lại", 503
            )
        MediaRepository.mark_media_deleted(media_id)

    @staticmethod
    def cleanup(limit=100, dry_run=False):
        rows = MediaRepository.cleanup_candidates(limit)
        result = {"candidates": len(rows), "processed": 0, "failed": 0}
        if dry_run:
            return result
        for media in rows:
            # Reserve a retry interval atomically; parallel janitors cannot starve the queue.
            now = int(time.time())
            if not Database.execute(
                "UPDATE media_assets SET next_reconcile_at=? WHERE id=? AND next_reconcile_at<=?",
                (now + 60, media["id"], now),
            ):
                continue
            try:
                if media["status"] == "ready":
                    obsolete = [
                        o
                        for o in MediaRepository.objects(media["id"])
                        if (o["bucket"], o["object_key"])
                        != (media["bucket"], media["object_key"])
                    ]
                    if not all(
                        [
                            r2_client.delete_object(o["bucket"], o["object_key"])
                            for o in obsolete
                        ]
                    ):
                        raise AppError(
                            "STORAGE_DELETE_FAILED", "Cleanup chưa xong", 503
                        )
                    Database.execute(
                        "UPDATE media_assets SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
                        (media["id"],),
                    )
                else:
                    MediaService.delete_media(media["id"], media["owner_id"])
                result["processed"] += 1
            except Exception:
                result["failed"] += 1
        return result
