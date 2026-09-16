from typing import List
from fastapi import APIRouter
from app.modules.heritage.schemas import (
    HeritageArticleSummaryResponse,
    HeritageArticleDetailResponse,
    HeritageSourceResponse,
)
from app.modules.heritage.service import HeritageService

router = APIRouter(prefix="/heritage", tags=["Heritage Knowledge"])


@router.get("/articles", response_model=List[HeritageArticleSummaryResponse])
async def list_articles():
    """Lấy danh sách các bài viết di sản văn hóa đã được thẩm định (F04)."""
    return HeritageService.list_articles()


@router.get("/articles/{slug_or_id}", response_model=HeritageArticleDetailResponse)
async def get_article_detail(slug_or_id: str):
    """Xem chi tiết bài viết di sản, cấu trúc may mặc, lịch sử và trích dẫn nguồn."""
    return HeritageService.get_article_detail(slug_or_id)


@router.get("/sources", response_model=List[HeritageSourceResponse])
async def list_sources():
    """Lấy danh sách các nguồn thư tịch cổ và tài liệu nghiên cứu học thuật được trích dẫn."""
    return HeritageService.list_sources()
