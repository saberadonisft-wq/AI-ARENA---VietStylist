import json
from typing import List, Optional, Dict, Any
from app.core.database import Database, get_db_connection
from contextlib import closing


class OutfitRepository:
    @staticmethod
    def get_outfits_by_owner(owner_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT o.*, v.snapshot_json, v.preview_image_url
            FROM outfits o
            LEFT JOIN outfit_versions v ON o.current_version_id = v.id
            WHERE o.owner_id = ? AND o.is_deleted = 0
            ORDER BY o.updated_at DESC
        """, (owner_id,))

    @staticmethod
    def get_outfit_by_id(outfit_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("""
            SELECT o.*, v.snapshot_json, v.preview_image_url
            FROM outfits o
            LEFT JOIN outfit_versions v ON o.current_version_id = v.id
            WHERE o.id = ? AND o.is_deleted = 0
        """, (outfit_id,))

    @staticmethod
    def create_outfit(
        outfit_id: str,
        owner_id: Optional[str],
        title: str,
        occasion_id: Optional[str],
        style_mode: str,
    ) -> None:
        Database.execute("""
            INSERT INTO outfits (id, owner_id, title, occasion_id, style_mode, revision, is_deleted)
            VALUES (?, ?, ?, ?, ?, 1, 0)
        """, (outfit_id, owner_id, title, occasion_id, style_mode))

    @staticmethod
    def create_outfit_version(
        version_id: str,
        outfit_id: str,
        version_number: int,
        snapshot_json: str,
        preview_image_url: Optional[str] = None,
    ) -> None:
        Database.execute("""
            INSERT INTO outfit_versions (id, outfit_id, version_number, snapshot_json, preview_image_url)
            VALUES (?, ?, ?, ?, ?)
        """, (version_id, outfit_id, version_number, snapshot_json, preview_image_url))

    @staticmethod
    def set_current_version(outfit_id: str, version_id: str, new_revision: int) -> None:
        Database.execute("""
            UPDATE outfits
            SET current_version_id = ?, revision = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (version_id, new_revision, outfit_id))

    @staticmethod
    def save_revision(outfit_id, expected_revision, version_id, snapshot_json, title, occasion_id, style_mode, preview_image_url):
        # Commit snapshot and metadata together; concurrent stale saves return 409.
        with closing(get_db_connection()) as conn, conn:
            conn.execute("BEGIN IMMEDIATE")
            current = conn.execute("SELECT revision FROM outfits WHERE id = ? AND is_deleted = 0", (outfit_id,)).fetchone()
            if not current or current["revision"] != expected_revision:
                return False
            version_number = conn.execute("SELECT COALESCE(MAX(version_number), 0) + 1 FROM outfit_versions WHERE outfit_id = ?", (outfit_id,)).fetchone()[0]
            conn.execute("INSERT INTO outfit_versions (id, outfit_id, version_number, snapshot_json, preview_image_url) VALUES (?, ?, ?, ?, ?)",
                         (version_id, outfit_id, version_number, snapshot_json, preview_image_url))
            conn.execute("UPDATE outfits SET current_version_id = ?, revision = revision + 1, title = ?, occasion_id = ?, style_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                         (version_id, title, occasion_id, style_mode, outfit_id))
        return True

    @staticmethod
    def get_latest_version_number(outfit_id: str) -> int:
        row = Database.fetch_one("""
            SELECT MAX(version_number) as max_v FROM outfit_versions WHERE outfit_id = ?
        """, (outfit_id,))
        return row["max_v"] if row and row.get("max_v") else 0

    @staticmethod
    def get_outfit_versions(outfit_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT * FROM outfit_versions WHERE outfit_id = ? ORDER BY version_number DESC
        """, (outfit_id,))

    @staticmethod
    def soft_delete_outfit(outfit_id: str) -> None:
        Database.execute("UPDATE outfits SET is_deleted = 1 WHERE id = ?", (outfit_id,))
