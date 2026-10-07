from typing import List
from fastapi import APIRouter, Depends, Header, Query
from app.core.security import require_current_user, AuthenticatedUser
from app.modules.outfits.schemas import (
    CreateOutfitRequest,
    UpdateOutfitRequest,
    OutfitResponse,
    OutfitVersionResponse,
    CompareRequest,
    CompareResponse,
    OutfitPageResponse,
    OutfitVersionPageResponse,
    OutfitCountResponse,
)
from app.modules.outfits.service import OutfitService

router = APIRouter(prefix="/outfits", tags=["Outfits & Versions"])


@router.get("", response_model=List[OutfitResponse])
def list_user_outfits(user: AuthenticatedUser = Depends(require_current_user)):
    """Lấy tối đa 50 bộ phối mới nhất. Dùng /outfits/page để tải các trang tiếp theo."""
    return OutfitService.list_user_outfits(user.user_id)


@router.get('/page', response_model=OutfitPageResponse)
def list_user_outfit_page(limit: int = Query(30, ge=1, le=100), cursor: str | None = Query(None, max_length=2048),
                          user: AuthenticatedUser = Depends(require_current_user)):
    return OutfitService.list_user_outfit_page(user.user_id, limit, cursor)


@router.get('/count', response_model=OutfitCountResponse)
def count_user_outfits(user: AuthenticatedUser = Depends(require_current_user)):
    from app.modules.outfits.repository import OutfitRepository
    return {'count': OutfitRepository.count_outfits_by_owner(user.user_id)}


@router.post("", response_model=OutfitResponse)
def create_outfit(
    req: CreateOutfitRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key", min_length=1, max_length=128),
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Lưu bộ phối mới của người dùng đã đăng nhập (R04).

    Idempotency-Key cho phép thử lại lần tạo mà không tạo trùng. Nếu bộ phối đã
    đổi phiên bản hoặc bị xóa, trả 409 REVISION_CONFLICT hoặc OUTFIT_DELETED;
    details có outfit_id và revision=1 để giữ nguyên phiên bản của lần tạo.
    """
    return OutfitService.create_outfit(user.user_id, req, idempotency_key)


@router.get("/versions/{version_id}", response_model=OutfitVersionResponse)
def get_outfit_version(
    version_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Đọc snapshot cố định của phiên bản thuộc bộ phối chưa xóa của chính mình."""
    return OutfitService.get_outfit_version(version_id, user.user_id)


@router.get("/{outfit_id}", response_model=OutfitResponse)
def get_outfit(
    outfit_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Xem thông tin chi tiết và snapshot hiện hành của bộ phối thuộc sở hữu (R04)."""
    return OutfitService.get_outfit(outfit_id, user.user_id)


@router.get('/{outfit_id}/versions', response_model=OutfitVersionPageResponse)
def list_outfit_versions(outfit_id: str, limit: int = Query(30, ge=1, le=100), cursor: str | None = Query(None, max_length=2048),
                         user: AuthenticatedUser = Depends(require_current_user)):
    return OutfitService.list_outfit_version_page(outfit_id, user.user_id, limit, cursor)


@router.put("/{outfit_id}", response_model=OutfitResponse)
def update_outfit(
    outfit_id: str,
    req: UpdateOutfitRequest,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Cập nhật bộ phối kèm kiểm tra quyền sở hữu và xung đột revision phiên bản (R04, O03)."""
    return OutfitService.update_outfit(outfit_id, user.user_id, req)


@router.delete("/{outfit_id}")
def delete_outfit(
    outfit_id: str,
    user: AuthenticatedUser = Depends(require_current_user),
):
    """Xóa bộ phối của chính mình (Soft delete, R04)."""
    OutfitService.delete_outfit(outfit_id, user.user_id)
    return {"message": "Đã xóa bộ phối thành công"}


@router.post("/compare", response_model=CompareResponse)
def compare_outfits(req: CompareRequest):
    """So sánh độc lập hai phương án A/B và hiển thị các điểm khác biệt (F08)."""
    return OutfitService.compare_snapshots(req)
