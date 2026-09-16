from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.modules.heritage.schemas import (
    HeritageArticleSummaryResponse,
    HeritageArticleDetailResponse,
    HeritageSourceResponse,
    CreateStoryRequest,
)
from app.modules.heritage.service import HeritageService
from app.core.security import require_role, AuthenticatedUser

router = APIRouter(prefix="/heritage", tags=["Heritage Knowledge & Stylist Blog"])


@router.get("/articles", response_model=List[HeritageArticleSummaryResponse])
async def list_articles(
    era: Optional[str] = Query(None, description="Lọc theo triều đại (Triều Nguyễn, Triều Lê, Lý - Trần, Đương đại Remix)"),
    category: Optional[str] = Query(None, description="Lọc theo chủ đề/thể loại"),
    search: Optional[str] = Query(None, description="Tìm kiếm từ khóa trong tiêu đề hoặc tóm tắt"),
):
    """Lấy danh sách các bài viết / câu chuyện di sản và góc sáng tạo của Stylist."""
    return HeritageService.list_articles(era=era, category=category, search=search)


@router.get("/articles/{slug_or_id}", response_model=HeritageArticleDetailResponse)
async def get_article_detail(slug_or_id: str):
    """Xem chi tiết câu chuyện trang phục, cấu trúc may mặc, lịch sử và trích dẫn nguồn."""
    return HeritageService.get_article_detail(slug_or_id)


@router.post("/articles", status_code=status.HTTP_201_CREATED)
async def create_story(
    req: CreateStoryRequest,
    current_user: AuthenticatedUser = Depends(require_role(["stylist", "admin"])),
):
    """Dành riêng cho Stylist hoặc Admin: Đăng tải câu chuyện / bài viết mới về trang phục truyền thống."""
    user_info = {
        "id": current_user.user_id,
        "email": current_user.email,
        "roles": current_user.roles,
        "display_name": current_user.claims.get("display_name") or current_user.claims.get("user_metadata", {}).get("display_name") or current_user.email,
    }
    return HeritageService.create_story(req, user_info)


@router.delete("/articles/{id_or_slug}")
async def delete_story(
    id_or_slug: str,
    current_user: AuthenticatedUser = Depends(require_role(["stylist", "admin"])),
):
    """Xóa bài viết câu chuyện trang phục (chỉ dành cho tác giả hoặc Admin)."""
    user_info = {
        "id": current_user.user_id,
        "email": current_user.email,
        "roles": current_user.roles,
    }
    return HeritageService.delete_story(id_or_slug, user_info)


@router.get("/sources", response_model=List[HeritageSourceResponse])
async def list_sources():
    """Lấy danh sách các nguồn thư tịch cổ và tài liệu nghiên cứu học thuật được trích dẫn."""
    return HeritageService.list_sources()
