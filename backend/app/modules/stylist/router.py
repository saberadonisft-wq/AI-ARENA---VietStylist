from fastapi import APIRouter, Depends, Query, UploadFile, File

from app.core.security import AuthenticatedUser, require_role
from app.modules.stylist.schemas import (
    CreateGarmentTypeRequest,
    CreateGarmentSubmissionRequest,
    GarmentSubmissionPage,
    GarmentSubmissionResponse,
)
from app.modules.stylist.service import StylistCatalogService
from app.modules.media.schemas import AccessUrlResponse, MediaAssetResponse
from app.modules.media.validation import byte_limit
from app.core.errors import AppError
from app.modules.catalog.schemas import GarmentTypeResponse

router = APIRouter(prefix="/stylist", tags=["Stylist Catalog Submissions"])
stylist_or_admin = require_role(["stylist", "admin"])


@router.post("/garment-image", response_model=MediaAssetResponse, status_code=201)
def upload_garment_image(file: UploadFile = File(...), user: AuthenticatedUser = Depends(stylist_or_admin)):
    content = file.file.read(byte_limit("image") + 1)
    if len(content) > byte_limit("image"):
        raise AppError("PAYLOAD_TOO_LARGE", "Ảnh vượt giới hạn 10 MB.", 413)
    return StylistCatalogService.upload_garment_image(user.user_id, content, file.content_type or "")


@router.post("/garment-types", response_model=GarmentTypeResponse, status_code=201)
def create_garment_type(req: CreateGarmentTypeRequest, user: AuthenticatedUser = Depends(stylist_or_admin)):
    return StylistCatalogService.create_garment_type(req)


@router.post("/catalog-submissions", response_model=GarmentSubmissionResponse, status_code=201)
def submit_garment(req: CreateGarmentSubmissionRequest, user: AuthenticatedUser = Depends(stylist_or_admin)):
    return StylistCatalogService.create(user.user_id, req)


@router.get("/catalog-submissions", response_model=GarmentSubmissionPage)
def list_my_submissions(
    search: str = Query("", max_length=200),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: AuthenticatedUser = Depends(stylist_or_admin),
):
    return StylistCatalogService.list_submissions(user_id=user.user_id, search=search, limit=limit, offset=offset)


@router.delete("/catalog-submissions/{item_id}")
def delete_my_submission(item_id: str, user: AuthenticatedUser = Depends(stylist_or_admin)):
    return StylistCatalogService.delete_own_submission(item_id, user.user_id)


@router.get("/catalog-submissions/{item_id}/preview", response_model=AccessUrlResponse)
def preview_my_submission(item_id: str, user: AuthenticatedUser = Depends(stylist_or_admin)):
    _, _, submission = StylistCatalogService.get_submission(item_id)
    if submission.get("submitter_id") != user.user_id and not user.is_admin:
        from app.core.errors import AppError
        raise AppError("SUBMISSION_NOT_FOUND", "Không tìm thấy mẫu của bạn.", 404)
    return StylistCatalogService.preview_url(item_id)
