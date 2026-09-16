from typing import Optional, Dict, Any
from app.core.database import Database


class MediaRepository:
    @staticmethod
    def create_pending_media(
        media_id: str,
        bucket: str,
        object_key: str,
        media_type: str,
        mime_type: str,
        owner_id: Optional[str],
        visibility: str,
        size_bytes: Optional[int],
    ) -> None:
        Database.execute("""
            INSERT INTO media_assets (id, bucket, object_key, media_type, mime_type, owner_id, visibility, status, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        """, (media_id, bucket, object_key, media_type, mime_type, owner_id, visibility, size_bytes))

    @staticmethod
    def get_media_by_id(media_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM media_assets WHERE id = ?", (media_id,))

    @staticmethod
    def mark_media_ready(media_id: str, size_bytes: Optional[int], width: Optional[int], height: Optional[int], public_url: Optional[str]) -> None:
        Database.execute("""
            UPDATE media_assets
            SET status = 'ready', size_bytes = COALESCE(?, size_bytes), width = ?, height = ?, public_url = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (size_bytes, width, height, public_url, media_id))

    @staticmethod
    def get_media_by_bucket_and_key(bucket: str, object_key: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM media_assets WHERE bucket = ? AND object_key = ?", (bucket, object_key))

    @staticmethod
    def mark_media_deleting(media_id: str) -> None:
        Database.execute("""
            UPDATE media_assets
            SET status = 'deleting', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (media_id,))

    @staticmethod
    def mark_media_deleted(media_id: str) -> None:
        Database.execute("""
            UPDATE media_assets
            SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (media_id,))

    @staticmethod
    def delete_media(media_id: str) -> None:
        Database.execute("DELETE FROM media_assets WHERE id = ?", (media_id,))

    @staticmethod
    def get_stale_pending_media(older_than_seconds: int = 7200) -> list:
        return Database.fetch_all("""
            SELECT * FROM media_assets
            WHERE status = 'pending' AND created_at < datetime('now', '-' || ? || ' seconds')
        """, (older_than_seconds,))

    @staticmethod
    def get_deleting_media() -> list:
        return Database.fetch_all("SELECT * FROM media_assets WHERE status = 'deleting'")
