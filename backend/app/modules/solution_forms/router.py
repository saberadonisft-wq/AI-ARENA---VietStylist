from fastapi import APIRouter, Depends
from app.core.security import require_current_user, AuthenticatedUser
from app.modules.solution_forms.schemas import (
    SolutionFormResponse,
    UpdateSolutionFormRequest,
)
from app.modules.solution_forms.service import SolutionFormService

router = APIRouter(prefix="/solution-form", tags=["Solution Form F12"])


@router.get("", response_model=SolutionFormResponse)
async def get_solution_form(user: AuthenticatedUser = Depends(require_current_user)):
    """
    Lấy nội dung form trình bày giải pháp của người dùng đã đăng nhập (R04).
    Nếu chưa có, tự động khởi tạo bản nháp mẫu với đầy đủ các mục nghiên cứu và văn hóa.
    """
    return SolutionFormService.get_or_create_form(user.user_id)


@router.put("", response_model=SolutionFormResponse)
async def update_solution_form(
    req: UpdateSolutionFormRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """
    Cập nhật nội dung form giải pháp, phát hiện xung đột khi mở nhiều tab qua CAS (R04, O03).
    """
    return SolutionFormService.update_form(user.user_id, req)
