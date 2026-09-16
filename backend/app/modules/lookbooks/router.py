from typing import List, Optional
from fastapi import APIRouter, Depends
from app.core.security import require_current_user, get_current_user_optional, AuthenticatedUser
from app.modules.lookbooks.schemas import (
    CreateLookbookRequest,
    UpdateLookbookRequest,
    LookbookResponse,
    CreateShareLinkRequest,
    ShareLinkResponse,
)
from app.modules.lookbooks.service import LookbookService

router = APIRouter(prefix="/lookbooks", tags=["Lookbooks"])


@router.get("", response_model=List[LookbookResponse])
async def list_lookbooks(user: AuthenticatedUser = Depends(require_current_user)):
    """Lấy danh sách lookbooks cá nhân của người dùng đã đăng nhập."""
    return LookbookService.list_user_lookbooks(user.user_id)


@router.post("", response_model=LookbookResponse)
async def create_lookbook(
    req: CreateLookbookRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Tạo mới một bộ sưu tập Lookbook (F09)."""
    return LookbookService.create_lookbook(user.user_id, req)


@router.get("/{lookbook_id}", response_model=LookbookResponse)
async def get_lookbook(
    lookbook_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """Xem chi tiết lookbook và danh sách các bộ phối đính kèm."""
    user_id = user.user_id if user else None
    return LookbookService.get_lookbook(lookbook_id, user_id)


@router.put("/{lookbook_id}", response_model=LookbookResponse)
async def update_lookbook(
    lookbook_id: str,
    req: UpdateLookbookRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Cập nhật tiêu đề, mô tả hoặc danh sách bộ phối trong lookbook."""
    return LookbookService.update_lookbook(lookbook_id, user.user_id, req)


@router.delete("/{lookbook_id}")
async def delete_lookbook(
    lookbook_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Xóa lookbook."""
    LookbookService.delete_lookbook(lookbook_id, user.user_id)
    return {"message": "Đã xóa lookbook thành công"}


@router.post("/{lookbook_id}/share", response_model=ShareLinkResponse)
async def share_lookbook(
    lookbook_id: str,
    req: CreateShareLinkRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Tạo liên kết chia sẻ công khai hoặc unlisted với token băm ngẫu nhiên bảo mật cao (F09)."""
    return LookbookService.generate_share_link(lookbook_id, user.user_id, req.expires_in_days or 30)
