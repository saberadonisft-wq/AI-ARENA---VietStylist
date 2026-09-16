from typing import Optional
from fastapi import APIRouter, Depends
from app.core.security import get_current_user_optional, AuthenticatedUser
from app.modules.try_on.schemas import CreateTryOnJobRequest, TryOnJobResponse
from app.modules.try_on.service import TryOnService

router = APIRouter(prefix="/ai", tags=["AI Virtual Try-On"])


@router.post("/try-on", response_model=TryOnJobResponse)
async def create_try_on_job(
    req: CreateTryOnJobRequest,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Tạo tác vụ thử đồ Việt phục trên ảnh người dùng bằng AI (F05).
    Tác vụ được đưa vào hàng đợi xử lý bất đồng bộ bởi Worker.
    """
    user_id = user.user_id if user else None
    return TryOnService.create_try_on_job(user_id, req)


@router.get("/jobs/{job_id}", response_model=TryOnJobResponse)
async def get_job_status(
    job_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Truy vấn trạng thái tác vụ AI (queued -> running -> succeeded/failed) và ảnh kết quả.
    """
    user_id = user.user_id if user else None
    return TryOnService.get_job_status(job_id, user_id)
