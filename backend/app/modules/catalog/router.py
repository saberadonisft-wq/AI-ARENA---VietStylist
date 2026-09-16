from typing import List, Optional
from fastapi import APIRouter, Query
from app.modules.catalog.schemas import (
    GarmentTypeResponse,
    OccasionResponse,
    ItemSummaryResponse,
    ItemDetailResponse,
    AvatarResponse,
    StarterOutfitResponse,
)
from app.modules.catalog.service import CatalogService

router = APIRouter(prefix="/catalog", tags=["Catalog"])


@router.get("/garment-types", response_model=List[GarmentTypeResponse])
async def list_garment_types():
    """Lấy danh sách các nhóm áo truyền thống (Ngũ thân, Áo tấc, Nhật bình, v.v.)."""
    return CatalogService.list_garment_types()


@router.get("/occasions", response_model=List[OccasionResponse])
async def list_occasions():
    """Lấy danh sách sự kiện (Kỷ yếu, Tết, Hội trường, Cưới hỏi, v.v.)."""
    return CatalogService.list_occasions()


@router.get("/items", response_model=List[ItemSummaryResponse])
async def list_items(
    garment_type_id: Optional[str] = Query(None, description="Lọc theo nhóm áo"),
    slot: Optional[str] = Query(None, description="Lọc theo vị trí (outerwear, bottom, headwear...)"),
    gender: Optional[str] = Query(None, description="Lọc theo giới tính (male, female, unisex)"),
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
async def get_item_detail(item_id: str):
    """Xem chi tiết một món đồ gồm các biến thể màu sắc, lớp ảnh vector 2D và sự kiện phù hợp."""
    return CatalogService.get_item_detail(item_id)


@router.get("/avatars", response_model=List[AvatarResponse])
async def list_avatars():
    """Lấy danh sách nhân vật mẫu (Avatars) 2D với dữ liệu vector SVG chuẩn hóa."""
    return CatalogService.list_avatars()


@router.get("/starter-outfits", response_model=List[StarterOutfitResponse])
async def get_starter_outfits():
    """Lấy các mẫu phối mở đầu giúp người dùng bắt đầu ngay trong Studio."""
    return CatalogService.get_starter_outfits()
