import json
from typing import List, Optional, Dict, Any
from app.core.database import Database, get_db_connection, db_transaction


class OutfitRepository:
    @staticmethod
    def get_create_receipt(idempotency_key: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one(
            "SELECT * FROM ai_jobs WHERE idempotency_key=? AND task_type='outfit_create'",
            (idempotency_key,),
        )

    @staticmethod
    def reserve_create_receipt(job_id: str, owner_id: str, idempotency_key: str, request_hash: str, input_json: str) -> None:
        # ai_jobs already provides a unique, owner-scoped idempotency ledger. Keep
        # this receipt out of the worker queue; the outfit is created synchronously.
        Database.execute(
            "INSERT INTO ai_jobs(id,owner_id,task_type,input_hash,idempotency_key,model_name,status,input_params) "
            "VALUES(?,?,'outfit_create',?,?,'outfit-save-v1','succeeded',?) ON CONFLICT(idempotency_key) DO NOTHING",
            (job_id, owner_id, request_hash, idempotency_key, input_json),
        )

    @staticmethod
    def finish_create_receipt(idempotency_key: str, outfit_id: str) -> None:
        Database.execute(
            "UPDATE ai_jobs SET result_data=?,error_message=NULL,updated_at=CURRENT_TIMESTAMP "
            "WHERE idempotency_key=? AND task_type='outfit_create'",
            (json.dumps({"outfit_id": outfit_id}), idempotency_key),
        )

    @staticmethod
    def get_outfits_by_owner(owner_id: str, limit: int = 50, after=None) -> List[Dict[str, Any]]:
        where = " AND (o.updated_at, o.id) < (?, ?)" if after else ""
        params = (owner_id, *after, limit) if after else (owner_id, limit)
        return Database.fetch_all("""
            SELECT o.*, v.snapshot_json, v.preview_image_url
            FROM outfits o
            LEFT JOIN outfit_versions v ON o.current_version_id = v.id
            WHERE o.owner_id = ? AND o.is_deleted = 0
        """ + where + " ORDER BY o.updated_at DESC, o.id DESC LIMIT ?", params)

    @staticmethod
    def count_outfits_by_owner(owner_id: str) -> int:
        return Database.fetch_one("SELECT COUNT(*) AS n FROM outfits WHERE owner_id=? AND is_deleted=0", (owner_id,))["n"]

    @staticmethod
    def get_outfit_by_id(outfit_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("""
            SELECT o.*, v.snapshot_json, v.preview_image_url
            FROM outfits o
            LEFT JOIN outfit_versions v ON o.current_version_id = v.id
            WHERE o.id = ? AND o.is_deleted = 0
        """, (outfit_id,))

    @staticmethod
    def get_outfit_by_id_and_owner(outfit_id: str, owner_id: str, *, include_deleted: bool = False) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("""
            SELECT o.*, v.snapshot_json, v.preview_image_url
            FROM outfits o
            LEFT JOIN outfit_versions v ON o.current_version_id = v.id
            WHERE o.id = ? AND o.owner_id = ? AND (o.is_deleted = 0 OR ? = 1)
        """, (outfit_id, owner_id, int(include_deleted)))

    @staticmethod
    def get_version_by_id_and_owner(version_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("""
            SELECT v.*
            FROM outfit_versions v
            JOIN outfits o ON o.id = v.outfit_id
            WHERE v.id = ? AND o.owner_id = ? AND o.is_deleted = 0
        """, (version_id, owner_id))

    @staticmethod
    def create_outfit_atomic(
        outfit_id: str,
        owner_id: str,
        title: str,
        occasion_id: Optional[str],
        style_mode: str,
        version_id: str,
        snapshot_json: str,
        preview_image_url: Optional[str] = None,
    ) -> None:
        """Tạo outfit, version 1 và trỏ current_version_id trong cùng một transaction nguyên tử (O03)."""
        # Historical snapshots may refer to a removed/unseeded occasion. Preserve
        # the snapshot; link optional catalog metadata only when its row exists.
        with db_transaction() as conn:
            conn.execute("""
                INSERT INTO outfits (id, owner_id, title, occasion_id, style_mode, current_version_id, revision, is_deleted)
                VALUES (?, ?, ?, (SELECT id FROM occasions WHERE id = ?), ?, ?, 1, 0)
            """, (outfit_id, owner_id, title, occasion_id, style_mode, version_id))

            conn.execute("""
                INSERT INTO outfit_versions (id, outfit_id, version_number, snapshot_json, preview_image_url)
                VALUES (?, ?, 1, ?, ?)
            """, (version_id, outfit_id, snapshot_json, preview_image_url))

    @staticmethod
    def save_revision(
        outfit_id: str,
        expected_revision: int,
        version_id: str,
        snapshot_json: str,
        title: str,
        occasion_id: Optional[str] = None,
        style_mode: str = "traditional",
        preview_image_url: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Lưu phiên bản mới nguyên tử có kiểm tra quyền owner và optimistic revision lock (R04, O03)."""
        # Resolve the optional occasion link in SQL, just as for a new outfit.
        with get_db_connection() as conn:
            with conn:
                conn.execute("BEGIN IMMEDIATE")
                if owner_id:
                    current = conn.execute(
                        "SELECT revision FROM outfits WHERE id = ? AND owner_id = ? AND is_deleted = 0",
                        (outfit_id, owner_id),
                    ).fetchone()
                else:
                    current = conn.execute(
                        "SELECT revision FROM outfits WHERE id = ? AND is_deleted = 0",
                        (outfit_id,),
                    ).fetchone()
                if not current or current["revision"] != expected_revision:
                    return None

                version_number = conn.execute(
                    "SELECT COALESCE(MAX(version_number), 0) + 1 FROM outfit_versions WHERE outfit_id = ?",
                    (outfit_id,),
                ).fetchone()[0]

                conn.execute(
                    "INSERT INTO outfit_versions (id, outfit_id, version_number, snapshot_json, preview_image_url) VALUES (?, ?, ?, ?, ?)",
                    (version_id, outfit_id, version_number, snapshot_json, preview_image_url),
                )
                if owner_id:
                    conn.execute(
                        "UPDATE outfits SET current_version_id = ?, revision = revision + 1, title = ?, occasion_id = (SELECT id FROM occasions WHERE id = ?), style_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?",
                        (version_id, title, occasion_id, style_mode, outfit_id, owner_id),
                    )
                else:
                    conn.execute(
                        "UPDATE outfits SET current_version_id = ?, revision = revision + 1, title = ?, occasion_id = (SELECT id FROM occasions WHERE id = ?), style_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (version_id, title, occasion_id, style_mode, outfit_id),
                    )
                # Capture our own committed version before another writer can
                # advance the revision used by the caller's next save.
                saved = Database.fetch_one("""
                    SELECT o.*, v.snapshot_json, v.preview_image_url
                    FROM outfits o JOIN outfit_versions v ON o.current_version_id=v.id
                    WHERE o.id=?
                """, (outfit_id,), conn=conn)
        return saved

    @staticmethod
    def get_latest_version_number(outfit_id: str) -> int:
        row = Database.fetch_one("""
            SELECT MAX(version_number) as max_v FROM outfit_versions WHERE outfit_id = ?
        """, (outfit_id,))
        return row["max_v"] if row and row.get("max_v") else 0

    @staticmethod
    def get_outfit_versions(outfit_id: str, limit: int = 50, after=None) -> List[Dict[str, Any]]:
        where = " AND version_number < ?" if after else ""
        params = (outfit_id, after[0], limit) if after else (outfit_id, limit)
        return Database.fetch_all("SELECT * FROM outfit_versions WHERE outfit_id = ?" + where + " ORDER BY version_number DESC LIMIT ?", params)

    @staticmethod
    def soft_delete_outfit(outfit_id: str, owner_id: str) -> int:
        with db_transaction() as conn:
            changed = conn.execute(
                "UPDATE outfits SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ? AND is_deleted = 0",
                (outfit_id, owner_id),
            ).rowcount
            if changed:
                from app.modules.community.service import now
                stamp = now()
                ids = 'SELECT p.id FROM lookbook_posts p JOIN outfit_versions v ON v.id=p.outfit_version_id WHERE v.outfit_id=? AND p.owner_id=?'
                conn.execute('UPDATE lookbook_post_shares SET revoked_at=? WHERE post_id IN (' + ids + ') AND revoked_at IS NULL', (stamp, outfit_id, owner_id))
                conn.execute('UPDATE lookbook_posts SET is_deleted=1,revision=revision+1,updated_at=? WHERE id IN (' + ids + ') AND is_deleted=0', (stamp, outfit_id, owner_id))
            return changed
