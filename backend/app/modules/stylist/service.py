"""Stylist catalog submissions remain unpublished until an admin approves them."""
import json
import logging
import uuid
from datetime import datetime, timezone

from app.core.database import Database, db_transaction, INTEGRITY_ERRORS
from app.core.errors import AppError
from app.modules.media.service import MediaService
from app.modules.media.schemas import RequestUploadUrlInput, CompleteUploadRequest
from app.modules.media.validation import validate_content, byte_limit
from app.modules.catalog.studio_images import make_cutout
from app.modules.media.repository import MediaRepository
from app.infrastructure.r2.client import r2_client

logger = logging.getLogger(__name__)
from app.modules.stylist.schemas import CreateGarmentSubmissionRequest, CreateGarmentTypeRequest


class StylistCatalogService:
    @staticmethod
    def upload_garment_image(user_id, content: bytes, mime_type: str):
        """Remove the background before creating any media row or storing bytes."""
        if mime_type not in ("image/jpeg", "image/png", "image/webp"):
            raise AppError("INVALID_FILE_TYPE", "Chọn ảnh JPEG, PNG hoặc WebP.", 422)
        clean, _, _, _ = validate_content(content, mime_type)
        try:
            cutout = make_cutout(clean)
        except AppError:
            raise
        except Exception as exc:
            logger.warning("Stylist image cutout failed: %s", type(exc).__name__)
            raise AppError("CUTOUT_UNAVAILABLE", "Chưa thể tách nền ảnh. Vui lòng thử lại.", 503) from exc
        if len(cutout) > byte_limit("image"):
            raise AppError("PAYLOAD_TOO_LARGE", "Ảnh sau khi tách nền vượt giới hạn 10 MB.", 413)
        session = MediaService.create_upload_session(user_id, RequestUploadUrlInput(
            filename="stylist-cutout.png", media_type="image", mime_type="image/png",
            size_bytes=len(cutout), visibility="private",
        ))
        try:
            r2_client.put_object(session.bucket, session.object_key, cutout, "image/png")
            if not r2_client.is_configured:
                token = MediaRepository.claim(session.media_id, "pending", "uploading")
                if not MediaRepository.release(session.media_id, token, "uploaded"):
                    raise AppError("INVALID_UPLOAD_STATE", "Không thể hoàn tất ảnh trang phục.", 409)
            return MediaService.complete_upload(session.media_id, user_id, CompleteUploadRequest())
        except Exception:
            try:
                MediaService.delete_media(session.media_id, user_id)
            except Exception:
                pass
            raise

    @staticmethod
    def create_garment_type(req: CreateGarmentTypeRequest):
        name = req.name.strip()
        if len(name) < 2:
            raise AppError("INVALID_GARMENT_TYPE", "Tên nhóm cần có ít nhất 2 ký tự.", 422)
        existing = Database.fetch_one(
            "SELECT id FROM garment_types WHERE lower(trim(name))=lower(?) LIMIT 1",
            (name,),
        )
        if existing:
            raise AppError("GARMENT_TYPE_EXISTS", "Tên nhóm trang phục đã tồn tại.", 409)
        try:
            Database.execute(
                "INSERT INTO garment_types(id,name,description) VALUES(?,?,?)",
                (req.id, name, ""),
            )
        except INTEGRITY_ERRORS as exc:
            raise AppError("GARMENT_TYPE_EXISTS", "Mã nhóm trang phục đã tồn tại.", 409) from exc
        return Database.fetch_one("SELECT * FROM garment_types WHERE id=?", (req.id,))

    @staticmethod
    def _metadata(item):
        value = item.get("metadata") or {}
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (TypeError, ValueError):
                value = {}
        return value if isinstance(value, dict) else {}

    @classmethod
    def get_submission(cls, item_id, *, conn=None):
        item = Database.fetch_one("SELECT * FROM items WHERE id=?", (item_id,), conn=conn)
        metadata = cls._metadata(item or {})
        submission = metadata.get("stylist_submission")
        if not item or item.get("is_published") or not isinstance(submission, dict):
            raise AppError("SUBMISSION_NOT_FOUND", "Không tìm thấy mẫu đang chờ duyệt.", 404)
        return item, metadata, submission

    @classmethod
    def create(cls, user_id, req: CreateGarmentSubmissionRequest):
        item_id = f"stylist_{uuid.uuid4().hex}"
        now = datetime.now(timezone.utc).isoformat()
        metadata = {"stylist_submission": {"submitter_id": user_id, "media_id": req.media_id, "status": "pending", "submitted_at": now}}
        try:
            with db_transaction() as conn:
                # Validate while holding the same write lock used by media deletion.
                media = MediaRepository.get_media_by_id(req.media_id, conn=conn)
                if not media or media.get("owner_id") != user_id:
                    raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy file", 404)
                if media.get("media_type") != "image" or media.get("status") != "ready" or media.get("visibility") != "private":
                    raise AppError("SUBMISSION_IMAGE_REQUIRED", "Tải ảnh riêng tư lên hoàn tất trước khi gửi mẫu.", 422)
                conn.execute("INSERT INTO items(id,garment_type_id,name,slot,gender,description,era,is_published,metadata) VALUES(?,?,?,?,?,?,?,0,?)",
                    (item_id, req.garment_type_id, req.name, req.slot, req.gender, req.description, req.era, json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))))
                conn.execute("INSERT INTO item_variants(id,item_id,color_name,hex_color,material,is_default) VALUES(?,?,?,?,?,1)",
                    (f"variant_{uuid.uuid4().hex}", item_id, req.color_name, req.hex_color, req.material))
        except INTEGRITY_ERRORS as exc:
            raise AppError("INVALID_GARMENT_TYPE", "Nhóm trang phục không tồn tại hoặc mẫu đã bị trùng.", 422) from exc
        return cls.format(item_id, with_submitter=False)

    @classmethod
    def list_submissions(cls, *, user_id=None, pending_only=False, search="", limit=20, offset=0):
        query = "SELECT * FROM items WHERE CAST(metadata AS TEXT) LIKE '%stylist_submission%' ORDER BY created_at DESC,id DESC"
        candidates = Database.fetch_all(query)
        records = []
        for item in candidates:
            meta = cls._metadata(item)
            submission = meta.get("stylist_submission")
            if not isinstance(submission, dict):
                continue
            if user_id and submission.get("submitter_id") != user_id:
                continue
            if pending_only and submission.get("status") != "pending":
                continue
            if search and search.casefold() not in item["name"].casefold():
                continue
            records.append((item, submission))
        page = records[offset:offset + limit]
        users = {}
        owner_ids = list({sub.get("submitter_id") for _, sub in page if sub.get("submitter_id")})
        if owner_ids:
            marks = ",".join("?" for _ in owner_ids)
            users = {row["id"]: row for row in Database.fetch_all(f"SELECT id,display_name,email FROM accounts WHERE id IN ({marks})", tuple(owner_ids))}
        return {"items": [cls.format(item["id"], with_submitter=True, item=item, submission=sub, submitter=users.get(sub.get("submitter_id"))) for item, sub in page], "total": len(records)}

    @classmethod
    def format(cls, item_id, *, with_submitter, item=None, submission=None, submitter=None):
        if item is None:
            item = Database.fetch_one("SELECT * FROM items WHERE id=?", (item_id,))
            metadata = cls._metadata(item or {})
            submission = metadata.get("stylist_submission")
            if not item or not isinstance(submission, dict):
                raise AppError("SUBMISSION_NOT_FOUND", "Không tìm thấy mẫu đã gửi.", 404)
        else:
            metadata = cls._metadata(item)
        variant = Database.fetch_one("SELECT color_name,hex_color,material FROM item_variants WHERE item_id=? ORDER BY is_default DESC,id LIMIT 1", (item_id,))
        garment_type = Database.fetch_one("SELECT name FROM garment_types WHERE id=?", (item["garment_type_id"],))
        result = {"id": item["id"], "name": item["name"], "garment_type_id": item["garment_type_id"], "garment_type_name": garment_type.get("name") if garment_type else None, "slot": item["slot"], "gender": item["gender"], "description": item.get("description"), "era": item.get("era"), "status": submission.get("status", "pending"), "color_name": variant.get("color_name") if variant else None, "hex_color": variant.get("hex_color") if variant else None, "material": variant.get("material") if variant else None, "submitted_at": submission.get("submitted_at"), "reviewed_at": submission.get("reviewed_at"), "review_note": submission.get("review_note")}
        if with_submitter:
            result.update(submitter_id=submission.get("submitter_id"), submitter_name=(submitter or {}).get("display_name"), submitter_email=(submitter or {}).get("email"), media_id=submission.get("media_id"))
        return result

    @classmethod
    def delete_own_submission(cls, item_id, user_id):
        cleanup_id = None
        with db_transaction() as conn:
            _, _, submission = cls.get_submission(item_id, conn=conn)
            if submission.get("submitter_id") != user_id:
                raise AppError("SUBMISSION_NOT_FOUND", "Không tìm thấy mẫu của bạn.", 404)
            if submission.get("status") == "approved":
                raise AppError("SUBMISSION_ALREADY_APPROVED", "Mẫu đã vào thư viện; liên hệ admin nếu cần gỡ.", 409)
            conn.execute("DELETE FROM items WHERE id=? AND is_published=0", (item_id,))
            media_id = submission.get("media_id")
            media = MediaRepository.get_media_by_id(media_id, conn=conn) if media_id else None
            if media and media.get("owner_id") == user_id and media.get("status") != "deleted":
                marked = MediaRepository.mark_media_deleting_if_unused(media_id, user_id, conn=conn)
                if marked == "busy":
                    raise AppError("MEDIA_BUSY", "File đang được xử lý; thử lại sau", 409)
                if marked == "marked":
                    conn.execute("UPDATE media_assets SET next_reconcile_at=0 WHERE id=?", (media_id,))
                    cleanup_id = media_id
        pending = 0
        if cleanup_id:
            try:
                MediaService.delete_media(cleanup_id, user_id)
            except Exception:
                # The committed deletion is successful; the durable media ledger
                # lets the janitor retry storage cleanup outside this transaction.
                pending = 1
                logger.warning("Stylist media cleanup pending media_id=%s", cleanup_id)
        return {"status": "deleted", "media_cleanup_pending": pending}

    @classmethod
    def review(cls, item_id, moderator_id, action, note=None):
        item, metadata, submission = cls.get_submission(item_id)
        if submission.get("status") != "pending":
            raise AppError("SUBMISSION_ALREADY_REVIEWED", "Mẫu này đã được xét duyệt.", 409)
        if action == "reject" and len((note or "").strip()) < 5:
            raise AppError("REVIEW_NOTE_REQUIRED", "Khi từ chối, hãy ghi ít nhất 5 ký tự góp ý để stylist biết cách chỉnh sửa.", 422)
        public_asset = None
        if action == "approve":
            public_asset = MediaService.copy_stylist_submission_image(submission["media_id"], submission["submitter_id"], moderator_id)
        submission.update(status="approved" if action == "approve" else "rejected", reviewed_by=moderator_id,
                          reviewed_at=datetime.now(timezone.utc).isoformat(), review_note=(note or "").strip() or None)
        if public_asset:
            submission["public_media_id"] = public_asset.id
            metadata["real_image_url"] = public_asset.public_url
            metadata["catalog_media_id"] = public_asset.id
        metadata["stylist_submission"] = submission
        try:
            with db_transaction() as conn:
                changed = conn.execute("UPDATE items SET is_published=?,metadata=? WHERE id=? AND is_published=0",
                    (1 if action == "approve" else 0, json.dumps(metadata, ensure_ascii=False, separators=(",", ":")), item_id)).rowcount
                if not changed:
                    raise AppError("SUBMISSION_ALREADY_REVIEWED", "Mẫu này đã được xét duyệt.", 409)
        except Exception:
            if public_asset:
                try:
                    MediaService.delete_media(public_asset.id, moderator_id)
                except Exception:
                    pass
            raise
        return cls.format(item_id, with_submitter=False)

    @classmethod
    def preview_url(cls, item_id):
        _, _, submission = cls.get_submission(item_id)
        return MediaService.get_access_url(submission["media_id"], submission["submitter_id"])
