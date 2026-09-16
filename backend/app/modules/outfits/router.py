from typing import List
from fastapi import APIRouter, Depends
from app.core.security import require_current_user, AuthenticatedUser
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
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Lưu bộ phối mới của người dùng đã đăng nhập (R04)."""
    return OutfitService.create_outfit(user.user_id, req)


@router.get("/{outfit_id}", response_model=OutfitResponse)
async def get_outfit(
    outfit_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Xem thông tin chi tiết và snapshot hiện hành của bộ phối thuộc sở hữu (R04)."""
    return OutfitService.get_outfit(outfit_id, user.user_id)


@router.put("/{outfit_id}", response_model=OutfitResponse)
async def update_outfit(
    outfit_id: str,
    req: UpdateOutfitRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Cập nhật bộ phối kèm kiểm tra quyền sở hữu và xung đột revision phiên bản (R04, O03)."""
    return OutfitService.update_outfit(outfit_id, user.user_id, req)


@router.delete("/{outfit_id}")
async def delete_outfit(
    outfit_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Xóa bộ phối của chính mình (Soft delete, R04)."""
    OutfitService.delete_outfit(outfit_id, user.user_id)
    return {"message": "Đã xóa bộ phối thành công"}


@router.post("/compare", response_model=CompareResponse)
async def compare_outfits(req: CompareRequest):
    """So sánh độc lập hai phương án A/B và hiển thị các điểm khác biệt (F08)."""
    return OutfitService.compare_snapshots(req)
