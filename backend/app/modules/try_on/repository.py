from typing import Optional, List, Dict, Any
from app.core.database import Database, get_db_connection, row_to_dict
from contextlib import closing


class TryOnRepository:
    @staticmethod
    def create_job(
        job_id: str,
        owner_id: Optional[str],
        task_type: str,
        input_hash: str,
        idempotency_key: Optional[str],
        model_name: str,
        input_params_json: str,
    ) -> None:
        Database.execute("""
            INSERT INTO ai_jobs (id, owner_id, task_type, input_hash, idempotency_key, model_name, status, input_params)
            VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
        """, (job_id, owner_id, task_type, input_hash, idempotency_key, model_name, input_params_json))

    @staticmethod
    def get_job_by_id(job_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM ai_jobs WHERE id = ?", (job_id,))

    @staticmethod
    def get_job_by_idempotency_key(key: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM ai_jobs WHERE idempotency_key = ?", (key,))

    @staticmethod
    def claim_queued_job(worker_lease_seconds: int = 60) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            with conn:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute("""
                    SELECT id FROM ai_jobs
                    WHERE status = 'queued' OR (status = 'running' AND lease_until < CURRENT_TIMESTAMP)
                    ORDER BY created_at ASC LIMIT 1
                """).fetchone()
                if not row:
                    return None
                job_id = row["id"]
                conn.execute("""
                    UPDATE ai_jobs SET status = 'running',
                    lease_until = datetime('now', '+' || ? || ' seconds'), updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (worker_lease_seconds, job_id))
                return row_to_dict(conn.execute("SELECT * FROM ai_jobs WHERE id = ?", (job_id,)).fetchone())

    @staticmethod
    def update_job_success(job_id: str, result_data_json: str) -> None:
        Database.execute("""
            UPDATE ai_jobs
            SET status = 'succeeded', result_data = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (result_data_json, job_id))

    @staticmethod
    def update_job_failed(job_id: str, error_message: str) -> None:
        Database.execute("""
            UPDATE ai_jobs
            SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (error_message, job_id))
