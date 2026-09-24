from fastapi import APIRouter, Depends, Query
from app.core.security import require_role, AuthenticatedUser
from app.core.database import Database, INTEGRITY_ERRORS
from app.core.errors import AppError
from app.modules.admin.management import ManagementService
from app.modules.admin.schemas import UpdateUserAdminRequest, AdminUserPage, AdminOverview, CreateGarmentTypeRequest
from app.modules.catalog.schemas import ItemSummaryResponse, GarmentTypeResponse
from app.modules.outfits.schemas import OutfitResponse, UpdateOutfitRequest
from app.modules.outfits.service import OutfitService
from app.modules.lookbooks.schemas import LookbookResponse, UpdateLookbookRequest
from app.modules.lookbooks.service import LookbookService
from pydantic import BaseModel
from typing import List, Optional
from app.modules.admin.schemas import (
    CreateItemAdminRequest,
    CreateVariantAdminRequest,
    CreateRuleAdminRequest,
    CreateArticleAdminRequest,
)
from app.modules.admin.service import AdminService
from app.modules.stylist.service import StylistCatalogService
from app.modules.stylist.schemas import ReviewGarmentSubmissionRequest, GarmentSubmissionPage, GarmentSubmissionResponse
from app.modules.media.schemas import AccessUrlResponse

router = APIRouter(
    prefix="/admin",
    tags=["Admin Management F15"],
    dependencies=[Depends(require_role(["admin", "editor"]))],
)


@router.post("/items")
def create_item(req: CreateItemAdminRequest):
    """Thêm mới trang phục vào kho đồ (Quyền Admin/Editor) (F15)."""
    try:
        return AdminService.create_item(req)
    except INTEGRITY_ERRORS:
        raise AppError(code="INVALID_ITEM", message="Mã trang phục đã tồn tại hoặc nhóm trang phục không hợp lệ.", status_code=409)


@router.post("/variants")
def create_variant(req: CreateVariantAdminRequest):
    """Thêm biến thể màu sắc và chất liệu cho trang phục (F15)."""
    try:
        return AdminService.create_variant(req)
    except INTEGRITY_ERRORS:
        raise AppError(code="INVALID_VARIANT", message="Mã biến thể đã tồn tại hoặc trang phục không hợp lệ.", status_code=409)


@router.post("/cultural-rules")
def create_cultural_rule(req: CreateRuleAdminRequest):
    """Thêm quy tắc kiểm tra văn hóa di sản có trích dẫn nguồn (F15)."""
    return AdminService.create_rule(req)


@router.post("/heritage-articles")
def create_heritage_article(req: CreateArticleAdminRequest):
    """Thêm bài viết di sản văn hóa đã thẩm định (F15)."""
    return AdminService.create_article(req)


class ItemPage(BaseModel):
    items: List[ItemSummaryResponse]
    total: int


class ManagedOutfit(OutfitResponse):
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None


class OutfitPage(BaseModel):
    items: List[ManagedOutfit]
    total: int


class ManagedLookbook(LookbookResponse):
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None


class LookbookPage(BaseModel):
    items: List[ManagedLookbook]
    total: int


admin_only = require_role(["admin"])


@router.get("/overview", response_model=AdminOverview, dependencies=[Depends(admin_only)])
def overview():
    return ManagementService.overview()


@router.get("/users", response_model=AdminUserPage, dependencies=[Depends(admin_only)])
def list_users(search: str = Query("", max_length=200), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return ManagementService.user_page(search, limit, offset)


@router.patch("/users/{user_id}")
def update_user(user_id: str, req: UpdateUserAdminRequest, actor: AuthenticatedUser = Depends(admin_only)):
    return ManagementService.update_user(user_id, actor.user_id, req)


@router.get("/items", response_model=ItemPage)
def list_items(search: str = Query("", max_length=200), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return ManagementService.item_page(search, limit, offset)


@router.put("/items/{item_id}")
def update_item(item_id: str, req: CreateItemAdminRequest):
    return ManagementService.update_item(item_id, req)


@router.delete("/items/{item_id}")
def delete_item(item_id: str):
    return ManagementService.delete_item(item_id)


@router.post("/garment-types", response_model=GarmentTypeResponse)
def create_garment_type(req: CreateGarmentTypeRequest):
    try:
        Database.execute("INSERT INTO garment_types(id,name,description) VALUES(?,?,?)", (req.id,req.name,req.description))
    except INTEGRITY_ERRORS:
        raise AppError(code="GARMENT_TYPE_EXISTS", message="Mã nhóm trang phục đã tồn tại.", status_code=409)
    return Database.fetch_one("SELECT * FROM garment_types WHERE id=?", (req.id,))


@router.get("/outfits", response_model=OutfitPage, dependencies=[Depends(admin_only)])
def list_all_outfits(search: str = Query("", max_length=200), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return ManagementService.resource_page("outfits",search,limit,offset)


@router.get("/outfits/{outfit_id}", response_model=OutfitResponse, dependencies=[Depends(admin_only)])
def get_managed_outfit(outfit_id: str):
    return OutfitService.get_outfit(outfit_id, ManagementService.owner("outfits",outfit_id))


@router.put("/outfits/{outfit_id}", response_model=OutfitResponse, dependencies=[Depends(admin_only)])
def update_managed_outfit(outfit_id: str, req: UpdateOutfitRequest):
    return OutfitService.update_outfit(outfit_id, ManagementService.owner("outfits",outfit_id),req)


@router.delete("/outfits/{outfit_id}", dependencies=[Depends(admin_only)])
def delete_managed_outfit(outfit_id: str):
    OutfitService.delete_outfit(outfit_id, ManagementService.owner("outfits",outfit_id))
    return {"status": "deleted"}


@router.get("/lookbooks", response_model=LookbookPage, dependencies=[Depends(admin_only)])
def list_all_lookbooks(search: str = Query("", max_length=200), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return ManagementService.resource_page("lookbooks",search,limit,offset)


@router.put("/lookbooks/{lookbook_id}", response_model=LookbookResponse, dependencies=[Depends(admin_only)])
def update_managed_lookbook(lookbook_id: str, req: UpdateLookbookRequest):
    return LookbookService.update_lookbook(lookbook_id, ManagementService.owner("lookbooks",lookbook_id),req)


@router.delete("/lookbooks/{lookbook_id}", dependencies=[Depends(admin_only)])
def delete_managed_lookbook(lookbook_id: str):
    LookbookService.delete_lookbook(lookbook_id, ManagementService.owner("lookbooks",lookbook_id))
    return {"status": "deleted"}


@router.get("/stylist-submissions", response_model=GarmentSubmissionPage, dependencies=[Depends(admin_only)])
def list_stylist_submissions(search: str = Query("", max_length=200), limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    return StylistCatalogService.list_submissions(pending_only=True, search=search, limit=limit, offset=offset)


@router.get("/stylist-submissions/{item_id}/preview", response_model=AccessUrlResponse, dependencies=[Depends(admin_only)])
def preview_stylist_submission(item_id: str):
    return StylistCatalogService.preview_url(item_id)


@router.post("/stylist-submissions/{item_id}/review", response_model=GarmentSubmissionResponse, dependencies=[Depends(admin_only)])
def review_stylist_submission(item_id: str, req: ReviewGarmentSubmissionRequest, actor: AuthenticatedUser = Depends(admin_only)):
    return StylistCatalogService.review(item_id, actor.user_id, req.action, req.note)
