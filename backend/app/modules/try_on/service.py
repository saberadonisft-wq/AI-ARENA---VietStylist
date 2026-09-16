import hashlib
import json
import uuid
from typing import Optional, Dict, Any
from app.core.config import settings
from app.modules.try_on.schemas import CreateTryOnJobRequest, TryOnJobResponse
from app.modules.try_on.repository import TryOnRepository
from app.core.errors import AppError


class TryOnService:
    @staticmethod
    def create_try_on_job(owner_id: Optional[str], req: CreateTryOnJobRequest) -> TryOnJobResponse:
        raise AppError(
            code="TRY_ON_UNAVAILABLE",
            message="Thử đồ AI chưa sẵn sàng. Bạn vẫn có thể phối đồ và xuất ảnh trong Studio.",
            status_code=503,
        )

    @staticmethod
    def get_job_status(job_id: str, owner_id: Optional[str]) -> TryOnJobResponse:
        job = TryOnRepository.get_job_by_id(job_id)
        if not job:
            raise AppError(code="JOB_NOT_FOUND", message="Không tìm thấy tác vụ thử đồ AI", status_code=404)

        if owner_id and job["owner_id"] and job["owner_id"] != owner_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền xem tác vụ này", status_code=403)

        return TryOnService._format_job_response(job)

    @staticmethod
    def _format_job_response(job: Dict[str, Any]) -> TryOnJobResponse:
        result_url = None
        if job.get("result_data"):
            try:
                res_data = json.loads(job["result_data"]) if isinstance(job["result_data"], str) else job["result_data"]
                result_url = res_data.get("image_url")
            except Exception:
                pass

        outfit_v_id = None
        if job.get("input_params"):
            try:
                p = json.loads(job["input_params"]) if isinstance(job["input_params"], str) else job["input_params"]
                outfit_v_id = p.get("outfit_version_id")
            except Exception:
                pass

        return TryOnJobResponse(
            job_id=job["id"],
            task_type=job["task_type"],
            status=job["status"],
            input_hash=job["input_hash"],
            outfit_version_id=outfit_v_id,
            result_image_url=result_url,
            error_message=job.get("error_message"),
            created_at=str(job["created_at"]),
            updated_at=str(job["updated_at"]),
        )
