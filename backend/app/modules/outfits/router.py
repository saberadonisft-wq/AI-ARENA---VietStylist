from typing import List, Optional
from fastapi import APIRouter, Depends
from app.core.security import get_current_user_optional, require_current_user, AuthenticatedUser
from app.modules.outfits.schemas import (
    CreateOutfitRequest,
    UpdateOutfitRequest,
    OutfitResponse,
    CompareRequest,
    CompareResponse,
)
from app.modules.outfits.service import OutfitService

router = APIRouter(prefix="/outfits", tags=["Outfits & Versions"])


@router.get("", response_model=List[OutfitResponse])
async def list_user_outfits(user: AuthenticatedUser = Depends(require_current_user)):
    """Lấy danh sách các bộ phối của người dùng đã đăng nhập."""
    return OutfitService.list_user_outfits(user.user_id)


@router.post("", response_model=OutfitResponse)
async def create_outfit(
    req: CreateOutfitRequest,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """Lưu bộ phối mới (hỗ trợ cả khách và người dùng đã đăng nhập)."""
    user_id = user.user_id if user else None
    return OutfitService.create_outfit(user_id, req)


@router.get("/{outfit_id}", response_model=OutfitResponse)
async def get_outfit(outfit_id: str):
    """Xem thông tin chi tiết và snapshot hiện hành của bộ phối."""
    return OutfitService.get_outfit(outfit_id)


@router.put("/{outfit_id}", response_model=OutfitResponse)
async def update_outfit(
    outfit_id: str,
    req: UpdateOutfitRequest,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """Cập nhật bộ phối kèm kiểm tra xung đột revision phiên bản (Optimistic Concurrency)."""
    user_id = user.user_id if user else None
    return OutfitService.update_outfit(outfit_id, user_id, req)


@router.delete("/{outfit_id}")
async def delete_outfit(
    outfit_id: str,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    """Xóa bộ phối (Soft delete)."""
    user_id = user.user_id if user else None
    OutfitService.delete_outfit(outfit_id, user_id)
    return {"message": "Đã xóa bộ phối thành công"}


@router.post("/compare", response_model=CompareResponse)
async def compare_outfits(req: CompareRequest):
    """So sánh độc lập hai phương án A/B và hiển thị các điểm khác biệt (F08)."""
    return OutfitService.compare_snapshots(req)
