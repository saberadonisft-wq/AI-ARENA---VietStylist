import json
from typing import List, Optional, Dict, Any
from app.core.database import Database


class LookbookRepository:
    @staticmethod
    def get_user_lookbooks(owner_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT * FROM lookbooks WHERE owner_id = ? ORDER BY updated_at DESC
        """, (owner_id,))

    @staticmethod
    def get_lookbook_by_id(lookbook_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM lookbooks WHERE id = ?", (lookbook_id,))

    @staticmethod
    def create_lookbook(
        lookbook_id: str,
        owner_id: str,
        title: str,
        description: Optional[str],
        cover_image_url: Optional[str],
        visibility: str,
    ) -> None:
        Database.execute("""
            INSERT INTO lookbooks (id, owner_id, title, description, cover_image_url, visibility)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (lookbook_id, owner_id, title, description, cover_image_url, visibility))

    @staticmethod
    def update_lookbook(
        lookbook_id: str,
        title: str,
        description: Optional[str],
        cover_image_url: Optional[str],
        visibility: str,
    ) -> None:
        Database.execute("""
            UPDATE lookbooks
            SET title = ?, description = ?, cover_image_url = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (title, description, cover_image_url, visibility, lookbook_id))

    @staticmethod
    def delete_lookbook(lookbook_id: str) -> None:
        Database.execute("DELETE FROM lookbooks WHERE id = ?", (lookbook_id,))

    @staticmethod
    def add_entry(entry_id: str, lookbook_id: str, outfit_version_id: str, sort_order: int, notes: Optional[str]) -> None:
        Database.execute("""
            INSERT INTO lookbook_entries (id, lookbook_id, outfit_version_id, sort_order, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (entry_id, lookbook_id, outfit_version_id, sort_order, notes))

    @staticmethod
    def clear_entries(lookbook_id: str) -> None:
        Database.execute("DELETE FROM lookbook_entries WHERE lookbook_id = ?", (lookbook_id,))

    @staticmethod
    def get_entries(lookbook_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT e.*, v.snapshot_json, v.preview_image_url, v.version_number, o.id as outfit_id, o.title as outfit_title
            FROM lookbook_entries e
            JOIN outfit_versions v ON e.outfit_version_id = v.id
            JOIN outfits o ON v.outfit_id = o.id
            WHERE e.lookbook_id = ?
            ORDER BY e.sort_order ASC
        """, (lookbook_id,))

    @staticmethod
    def create_share_link(
        link_id: str,
        lookbook_id: Optional[str],
        outfit_version_id: Optional[str],
        token_hash: str,
        token_prefix: str,
        scope: str,
        expires_at: Optional[str],
    ) -> None:
        Database.execute("""
            INSERT INTO share_links (id, lookbook_id, outfit_version_id, token_hash, token_plain_prefix, scope, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (link_id, lookbook_id, outfit_version_id, token_hash, token_prefix, scope, expires_at))

    @staticmethod
    def get_share_by_token_hash(token_hash: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("""
            SELECT s.*, l.title as lookbook_title, l.description as lookbook_desc, l.cover_image_url, l.owner_id
            FROM share_links s
            LEFT JOIN lookbooks l ON s.lookbook_id = l.id
            WHERE s.token_hash = ? AND s.is_revoked = 0
        """, (token_hash,))

    @staticmethod
    def revoke_share_link(link_id: str) -> None:
        Database.execute("UPDATE share_links SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP WHERE id = ?", (link_id,))
