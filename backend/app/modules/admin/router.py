from fastapi import APIRouter, Depends
from app.core.security import require_role
from app.modules.admin.schemas import (
    CreateItemAdminRequest,
    CreateVariantAdminRequest,
    CreateRuleAdminRequest,
    CreateArticleAdminRequest,
)
from app.modules.admin.service import AdminService

router = APIRouter(
    prefix="/admin",
    tags=["Admin Management F15"],
    dependencies=[Depends(require_role(["admin", "editor"]))],
)


@router.post("/items")
async def create_item(req: CreateItemAdminRequest):
    """Thêm mới trang phục vào kho đồ (Quyền Admin/Editor) (F15)."""
    return AdminService.create_item(req)


@router.post("/variants")
async def create_variant(req: CreateVariantAdminRequest):
    """Thêm biến thể màu sắc và chất liệu cho trang phục (F15)."""
    return AdminService.create_variant(req)


@router.post("/cultural-rules")
async def create_cultural_rule(req: CreateRuleAdminRequest):
    """Thêm quy tắc kiểm tra văn hóa di sản có trích dẫn nguồn (F15)."""
    return AdminService.create_rule(req)


@router.post("/heritage-articles")
async def create_heritage_article(req: CreateArticleAdminRequest):
    """Thêm bài viết di sản văn hóa đã thẩm định (F15)."""
    return AdminService.create_article(req)
