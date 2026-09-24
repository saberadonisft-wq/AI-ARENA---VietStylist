from typing import List, Optional, Dict, Any
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class CreateItemAdminRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_-]+$")
    garment_type_id: str = Field(min_length=1)
    slot: Literal["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "accessory_back", "footwear"]
    name: str = Field(min_length=1, max_length=200)
    gender: Literal["male", "female", "unisex"] = "unisex"
    description: Optional[str] = None
    era: str = "Nguyễn"
    is_published: bool = True
    metadata: Dict[str, Any] = {}


class UpdateUserAdminRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_stylist: Optional[bool] = None
    is_active: Optional[bool] = None


class AdminUserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    roles: List[str]
    is_active: bool
    auth_provider: str
    created_at: str


class AdminUserPage(BaseModel):
    items: List[AdminUserResponse]
    total: int


class AdminOverview(BaseModel):
    users: int
    items: int
    outfits: int
    lookbooks: int
    rules: int


class CreateGarmentTypeRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class CreateVariantAdminRequest(BaseModel):
    id: str
    item_id: str
    color_name: str
    hex_color: str
    secondary_hex: Optional[str] = None
    material: str = "Lụa tơ tằm"
    thickness_level: str = "medium"
    pattern_description: Optional[str] = None
    price_tier: str = "standard"
    is_default: bool = False


class CreateRuleAdminRequest(BaseModel):
    id: str
    code: str
    name: str
    target_garment_type_id: Optional[str] = None
    target_slot: Optional[str] = None
    severity: str = "warning"
    condition_json: Dict[str, Any]
    explanation: str
    source_id: Optional[str] = None
    suggested_fix: Optional[Dict[str, Any]] = None
    is_active: bool = True


class CreateArticleAdminRequest(BaseModel):
    id: str
    title: str
    slug: str
    short_summary: str
    full_content: Optional[str] = None
    structural_description: Optional[str] = None
    historical_context: Optional[str] = None
    modern_interpretation: Optional[str] = None
    status: str = "published"
