from typing import List, Optional
import hashlib
from fastapi import APIRouter, Query, Request
from fastapi.responses import Response
from app.modules.catalog.schemas import (
    GarmentTypeResponse,
    OccasionResponse,
    ItemSummaryResponse,
    ItemDetailResponse,
    AvatarResponse,
    StarterOutfitResponse,
    ColorPreviewResponse,
)
from app.modules.catalog.service import CatalogService
from app.modules.catalog.studio_images import get_studio_image, get_catalog_thumbnail, preview_studio_color
from app.core.errors import AppError

router = APIRouter(prefix="/catalog", tags=["Catalog"])


def _image_response(request: Request, data: bytes, media_type: str):
    # Callers validate publication and media state before conditional responses.
    etag = '"' + hashlib.sha256(data).hexdigest() + '"'
    headers = {"Cache-Control": "no-cache", "ETag": etag, "X-Content-Type-Options": "nosniff"}
    candidates = request.headers.get("if-none-match", "").split(",")
    if any(value.strip() == "*" or value.strip().removeprefix("W/") == etag for value in candidates):
        return Response(status_code=304, headers=headers)
    return Response(data, media_type=media_type, headers=headers)


@router.get("/garment-types", response_model=List[GarmentTypeResponse])
def list_garment_types():
    """Lấy danh sách các nhóm áo truyền thống (Ngũ thân, Áo tấc, Nhật bình, v.v.)."""
    return CatalogService.list_garment_types()


@router.get("/occasions", response_model=List[OccasionResponse])
def list_occasions():
    """Lấy danh sách sự kiện (Kỷ yếu, Tết, Hội trường, Cưới hỏi, v.v.)."""
    return CatalogService.list_occasions()


@router.get("/items", response_model=List[ItemSummaryResponse])
def list_items(
    garment_type_id: Optional[str] = Query(None, description="Lọc theo nhóm áo"),
    slot: Optional[str] = Query(
        None, description="Lọc theo vị trí (outerwear, bottom, headwear...)"
    ),
    gender: Optional[str] = Query(
        None, description="Lọc theo giới tính (male, female, unisex)"
    ),
    occasion_id: Optional[str] = Query(None, description="Lọc theo sự kiện"),
    search: Optional[str] = Query(None, description="Tìm kiếm tên hoặc mô tả"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Lấy danh sách món đồ trang phục, quần và phụ kiện với bộ lọc phong phú."""
    return CatalogService.list_items(
        garment_type_id=garment_type_id,
        slot=slot,
        gender=gender,
        occasion_id=occasion_id,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.get("/items/{item_id}", response_model=ItemDetailResponse)
def get_item_detail(item_id: str):
    """Xem chi tiết một món đồ gồm các biến thể màu sắc, lớp ảnh vector 2D và sự kiện phù hợp."""
    return CatalogService.get_item_detail(item_id)


@router.get("/avatars", response_model=List[AvatarResponse])
def list_avatars():
    """Lấy danh sách nhân vật mẫu (Avatars) 2D với dữ liệu vector SVG chuẩn hóa."""
    return CatalogService.list_avatars()


@router.get("/items/{item_id}/studio-image", response_class=Response,
            responses={200: {"content": {"image/png": {"schema": {"type": "string", "format": "binary"}}}},
                       304: {"description": "The published image has not changed"}})
def studio_image(
    item_id: str,
    request: Request,
    color: Optional[str] = Query(None, pattern=r"^#[0-9A-Fa-f]{6}$"),
    source_version: Optional[str] = Query(None, pattern=r"^[a-f0-9]{64}$"),
    algorithm_version: Optional[str] = Query(None, max_length=64),
):
    """Ảnh PNG tách nền, cắt sát trang phục đã công khai, dùng để phối và xuất ảnh."""
    return _image_response(request, get_studio_image(item_id, color, source_version, algorithm_version), "image/png")


@router.get("/items/{item_id}/thumbnail", response_class=Response,
            responses={200: {"content": {"image/webp": {"schema": {"type": "string", "format": "binary"}}}},
                       304: {"description": "The published image has not changed"}})
def catalog_thumbnail(item_id: str, request: Request, size: int = Query(224, ge=64, le=640)):
    """A lossless display derivative; original media and Studio cutouts are unchanged."""
    return _image_response(request, get_catalog_thumbnail(item_id, size), "image/webp")


@router.get("/items/{item_id}/color-preview", response_model=ColorPreviewResponse)
def color_preview(item_id: str, color: str = Query(..., pattern=r"^#[0-9A-Fa-f]{6}$")):
    try:
        return preview_studio_color(item_id, color)
    except AppError as exc:
        if exc.code != "COLOR_CHANGE_UNSUPPORTED":
            raise
        return ColorPreviewResponse(supported=False, reason=exc.message)


@router.get("/starter-outfits", response_model=List[StarterOutfitResponse])
def get_starter_outfits():
    """Lấy các mẫu phối mở đầu giúp người dùng bắt đầu ngay trong Studio."""
    return CatalogService.get_starter_outfits()
