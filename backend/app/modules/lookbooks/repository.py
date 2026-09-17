import json
import sqlite3
from typing import List, Optional, Dict, Any
from app.core.database import Database, db_transaction
from app.core.errors import AppError


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
    def validate_outfit_versions_ownership(version_ids: List[str], owner_id: str, conn: Optional[sqlite3.Connection] = None) -> bool:
        if not version_ids:
            return True
        unique_ids = list(set(version_ids))
        placeholders = ", ".join(["?"] * len(unique_ids))
        sql = f"""
            SELECT v.id, o.owner_id, o.is_deleted
            FROM outfit_versions v
            JOIN outfits o ON v.outfit_id = o.id
            WHERE v.id IN ({placeholders})
        """
        if conn:
            cursor = conn.execute(sql, tuple(unique_ids))
            rows = [dict(r) for r in cursor.fetchall()]
        else:
            rows = Database.fetch_all(sql, tuple(unique_ids))

        if len(rows) != len(unique_ids):
            return False

        for r in rows:
            if r.get("owner_id") != owner_id or r.get("is_deleted") != 0:
                return False

        return True

    @staticmethod
    def create_with_entries(
        lookbook_id: str,
        owner_id: str,
        title: str,
        description: Optional[str],
        cover_image_url: Optional[str],
        visibility: str,
        entries: List[Dict[str, Any]],
    ) -> None:
        with db_transaction() as conn:
            if entries:
                version_ids = [e["outfit_version_id"] for e in entries]
                if not LookbookRepository.validate_outfit_versions_ownership(version_ids, owner_id, conn=conn):
                    raise AppError(code="INVALID_OUTFIT_VERSION", message="Một hoặc nhiều phiên bản bộ phối không hợp lệ hoặc không thuộc quyền sở hữu của bạn", status_code=422)

            conn.execute("""
                INSERT INTO lookbooks (id, owner_id, title, description, cover_image_url, visibility)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (lookbook_id, owner_id, title, description, cover_image_url, visibility))

            if entries:
                entry_params = [
                    (e["id"], lookbook_id, e["outfit_version_id"], e["sort_order"], e.get("notes"))
                    for e in entries
                ]
                conn.executemany("""
                    INSERT INTO lookbook_entries (id, lookbook_id, outfit_version_id, sort_order, notes)
                    VALUES (?, ?, ?, ?, ?)
                """, entry_params)

    @staticmethod
    def update_with_entries(
        lookbook_id: str,
        owner_id: str,
        title: str,
        description: Optional[str],
        cover_image_url: Optional[str],
        visibility: str,
        entries: Optional[List[Dict[str, Any]]],
    ) -> None:
        with db_transaction() as conn:
            cur = conn.execute("SELECT owner_id FROM lookbooks WHERE id = ?", (lookbook_id,))
            current = cur.fetchone()
            if not current:
                raise AppError(code="LOOKBOOK_NOT_FOUND", message="Không tìm thấy lookbook yêu cầu", status_code=404)
            if current["owner_id"] != owner_id:
                raise AppError(code="FORBIDDEN", message="Bạn không có quyền sửa lookbook này", status_code=403)

            conn.execute("""
                UPDATE lookbooks
                SET title = ?, description = ?, cover_image_url = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (title, description, cover_image_url, visibility, lookbook_id))

            if entries is not None:
                if entries:
                    version_ids = [e["outfit_version_id"] for e in entries]
                    if not LookbookRepository.validate_outfit_versions_ownership(version_ids, owner_id, conn=conn):
                        raise AppError(code="INVALID_OUTFIT_VERSION", message="Một hoặc nhiều phiên bản bộ phối không hợp lệ hoặc không thuộc quyền sở hữu của bạn", status_code=422)

                conn.execute("DELETE FROM lookbook_entries WHERE lookbook_id = ?", (lookbook_id,))

                if entries:
                    entry_params = [
                        (e["id"], lookbook_id, e["outfit_version_id"], e["sort_order"], e.get("notes"))
                        for e in entries
                    ]
                    conn.executemany("""
                        INSERT INTO lookbook_entries (id, lookbook_id, outfit_version_id, sort_order, notes)
                        VALUES (?, ?, ?, ?, ?)
                    """, entry_params)

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
        with db_transaction() as conn:
            conn.execute("DELETE FROM lookbook_entries WHERE lookbook_id = ?", (lookbook_id,))
            conn.execute("DELETE FROM share_links WHERE lookbook_id = ?", (lookbook_id,))
            conn.execute("DELETE FROM lookbooks WHERE id = ?", (lookbook_id,))

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
    def get_entries_by_lookbook_ids(lookbook_ids: List[str]) -> List[Dict[str, Any]]:
        if not lookbook_ids:
            return []
        placeholders = ", ".join(["?"] * len(lookbook_ids))
        return Database.fetch_all(f"""
            SELECT e.*, v.snapshot_json, v.preview_image_url, v.version_number, o.id as outfit_id, o.title as outfit_title
            FROM lookbook_entries e
            JOIN outfit_versions v ON e.outfit_version_id = v.id
            JOIN outfits o ON v.outfit_id = o.id
            WHERE e.lookbook_id IN ({placeholders})
            ORDER BY e.lookbook_id, e.sort_order ASC
        """, tuple(lookbook_ids))

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

    @staticmethod
    def revoke_shares_by_lookbook(lookbook_id: str) -> int:
        return Database.execute("UPDATE share_links SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP WHERE lookbook_id = ? AND is_revoked = 0", (lookbook_id,))

