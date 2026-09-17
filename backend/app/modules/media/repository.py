import time
import uuid
from app.core.database import Database, db_transaction
from app.core.config import settings
from app.core.errors import AppError


class MediaRepository:
    @staticmethod
    def get_media_by_id(media_id):
        return Database.fetch_one("SELECT * FROM media_assets WHERE id=?", (media_id,))

    @staticmethod
    def get_media_by_bucket_and_key(bucket, object_key):
        return Database.fetch_one(
            "SELECT * FROM media_assets WHERE bucket=? AND object_key=?",
            (bucket, object_key),
        )

    @staticmethod
    def create_pending_media(
        media_id,
        bucket,
        object_key,
        media_type,
        mime_type,
        owner_id,
        visibility,
        size_bytes,
        staging_bucket=None,
        staging_key=None,
        upload_expires_at=None,
    ):
        with db_transaction() as conn:
            conn.execute(
                "INSERT INTO media_assets(id,bucket,object_key,media_type,mime_type,owner_id,visibility,status,size_bytes,staging_bucket,staging_key,upload_expires_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?,?)",
                (
                    media_id,
                    bucket,
                    object_key,
                    media_type,
                    mime_type,
                    owner_id,
                    visibility,
                    size_bytes,
                    staging_bucket,
                    staging_key,
                    upload_expires_at,
                ),
            )
            conn.execute(
                "INSERT INTO media_objects VALUES(?,?,?,'staging')",
                (media_id, staging_bucket or bucket, staging_key or object_key),
            )

    @staticmethod
    def claim(media_id, expected, target):
        token = uuid.uuid4().hex
        now = int(time.time())
        changed = Database.execute(
            "UPDATE media_assets SET status=?,operation_token=?,lease_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status=? AND upload_expires_at>?",
            (
                target,
                token,
                now + settings.MEDIA_OPERATION_LEASE,
                media_id,
                expected,
                now,
            ),
        )
        if not changed:
            raise AppError(
                "INVALID_UPLOAD_STATE", "Phiên hết hạn hoặc đang được xử lý", 409
            )
        return token

    @staticmethod
    def release(media_id, token, target):
        return Database.execute(
            "UPDATE media_assets SET status=?,operation_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND operation_token=?",
            (target, media_id, token),
        )

    @staticmethod
    def reserve_final(media_id, token, bucket, key):
        with db_transaction() as conn:
            row = conn.execute(
                "SELECT id FROM media_assets WHERE id=? AND status='processing' AND operation_token=? AND lease_until>?",
                (media_id, token, int(time.time())),
            ).fetchone()
            if not row:
                raise AppError("INVALID_UPLOAD_STATE", "Phiên xử lý hết hạn", 409)
            conn.execute(
                "INSERT INTO media_objects VALUES(?,?,?,'final')",
                (media_id, bucket, key),
            )

    @staticmethod
    def publish(
        media_id, token, bucket, key, data, width, height, duration, public_url
    ):
        return Database.execute(
            "UPDATE media_assets SET status='ready',bucket=?,object_key=?,size_bytes=?,width=?,height=?,duration_ms=?,public_url=?,operation_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing' AND operation_token=? AND lease_until>?",
            (
                bucket,
                key,
                len(data),
                width,
                height,
                duration,
                public_url,
                media_id,
                token,
                int(time.time()),
            ),
        )

    @staticmethod
    def objects(media_id):
        return Database.fetch_all(
            "SELECT * FROM media_objects WHERE media_id=?", (media_id,)
        )

    @staticmethod
    def mark_media_deleting(media_id):
        return Database.execute(
            "UPDATE media_assets SET status='deleting',operation_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND (status NOT IN ('processing','uploading') OR lease_until<?)",
            (media_id, int(time.time())),
        )

    @staticmethod
    def mark_media_deleted(media_id):
        Database.execute(
            "UPDATE media_assets SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='deleting'",
            (media_id,),
        )

    @staticmethod
    def cleanup_candidates(limit=100):
        now = int(time.time())
        return Database.fetch_all(
            "SELECT * FROM media_assets WHERE next_reconcile_at<=? AND (status IN ('deleting','deleted','rejected') OR (status IN ('pending','uploaded') AND upload_expires_at<=?) OR (status IN ('uploading','processing') AND lease_until<=?) OR (status='ready' AND staging_key IS NOT NULL AND upload_expires_at<=?) ) ORDER BY next_reconcile_at, updated_at LIMIT ?",
            (now, now, now, now, limit),
        )
