from fastapi import APIRouter, Depends
from app.core.security import require_current_user, AuthenticatedUser
from app.modules.try_on.schemas import CreateTryOnJobRequest, TryOnJobResponse
from app.modules.try_on.service import TryOnService

router = APIRouter(prefix="/ai", tags=["AI Virtual Try-On"])


@router.post("/try-on", response_model=TryOnJobResponse)
async def create_try_on_job(
    req: CreateTryOnJobRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """
    Tạo tác vụ thử đồ Việt phục trên ảnh người dùng bằng AI (F05).
    Hiện chưa tích hợp mô hình sinh ảnh: trả về 503 TRY_ON_UNAVAILABLE (R04, O06).
    """
    return TryOnService.create_try_on_job(user.user_id, req)


@router.get("/jobs/{job_id}", response_model=TryOnJobResponse)
async def get_job_status(
    job_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """
    Truy vấn trạng thái tác vụ AI thuộc sở hữu của người dùng (R04).
    """
    return TryOnService.get_job_status(job_id, user.user_id)
