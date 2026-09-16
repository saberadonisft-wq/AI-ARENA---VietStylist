from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class GarmentTypeResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    gender_compatibility: str = "unisex"
    era: str = "Nguyễn"
    slot_schema: List[str] = []
    is_active: bool = True


class OccasionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    formality_level: str = "medium"
    season: str = "all"
    criteria: Dict[str, Any] = {}
    icon_name: Optional[str] = None


class ItemVariantResponse(BaseModel):
    id: str
    item_id: str
    color_name: str
    hex_color: str
    secondary_hex: Optional[str] = None
    material: Optional[str] = "Lụa tơ tằm"
    thickness_level: str = "medium"
    pattern_description: Optional[str] = None
    price_tier: str = "standard"
    is_default: bool = False


class AssetLayerResponse(BaseModel):
    id: str
    item_id: str
    variant_id: Optional[str] = None
    avatar_id: Optional[str] = None
    slot: str
    z_index: int = 10
    anchor_x: float = 0.0
    anchor_y: float = 0.0
    scale_x: float = 1.0
    scale_y: float = 1.0
    layer_type: str = "svg"
    svg_content: Optional[str] = None
    media_asset_id: Optional[str] = None
    color_mask_rule: Dict[str, Any] = {}


class ItemSummaryResponse(BaseModel):
    id: str
    garment_type_id: Optional[str] = None
    slot: str
    name: str
    gender: str = "unisex"
    description: Optional[str] = None
    era: Optional[str] = None
    is_published: bool = True
    metadata: Dict[str, Any] = {}
    variants: List[ItemVariantResponse] = []
    default_layer: Optional[AssetLayerResponse] = None


class ItemDetailResponse(ItemSummaryResponse):
    asset_layers: List[AssetLayerResponse] = []
    occasions: List[OccasionResponse] = []


class AvatarResponse(BaseModel):
    id: str
    name: str
    gender: str
    skin_tone: str
    body_type: str = "standard"
    base_image_url: Optional[str] = None
    svg_body: Optional[str] = None
    dimensions: Dict[str, int] = {"width": 800, "height": 1200}
    is_active: bool = True


class StarterOutfitItem(BaseModel):
    slot: str
    item_id: str
    variant_id: Optional[str] = None


class StarterOutfitResponse(BaseModel):
    id: str
    title: str
    description: str
    garment_type_id: str
    occasion_id: str
    avatar_id: str
    items: List[StarterOutfitItem]
