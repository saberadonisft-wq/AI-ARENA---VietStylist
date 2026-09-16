from typing import Optional
from fastapi import APIRouter, Depends
from app.core.security import get_current_user_optional, AuthenticatedUser
from app.modules.solution_forms.schemas import (
    SolutionFormResponse,
    UpdateSolutionFormRequest,
)
from app.modules.solution_forms.service import SolutionFormService

router = APIRouter(prefix="/solution-form", tags=["Solution Form F12"])


@router.get("", response_model=SolutionFormResponse)
async def get_solution_form(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)):
    """
    Lấy nội dung form trình bày giải pháp của đội (F12).
    Nếu chưa có, tự động khởi tạo bản nháp mẫu với đầy đủ các mục nghiên cứu và văn hóa.
    """
    owner_id = user.user_id if user else "team_default_owner"
    return SolutionFormService.get_or_create_form(owner_id)


@router.put("", response_model=SolutionFormResponse)
async def update_solution_form(
    req: UpdateSolutionFormRequest,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """
    Cập nhật nội dung form giải pháp, phát hiện xung đột khi mở nhiều tab (F12).
    """
    owner_id = user.user_id if user else "team_default_owner"
    return SolutionFormService.update_form(owner_id, req)
