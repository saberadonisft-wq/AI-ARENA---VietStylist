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
    def get_outfit_by_id_and_owner(outfit_id: str, owner_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("""
            SELECT o.*, v.snapshot_json, v.preview_image_url
            FROM outfits o
            LEFT JOIN outfit_versions v ON o.current_version_id = v.id
            WHERE o.id = ? AND o.owner_id = ? AND o.is_deleted = 0
        """, (outfit_id, owner_id))

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
    ) -> bool:
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
                    return False

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
    def soft_delete_outfit(outfit_id: str, owner_id: str) -> int:
        return Database.execute(
            "UPDATE outfits SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ? AND is_deleted = 0",
            (outfit_id, owner_id),
        )
