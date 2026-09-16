from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class CreateItemAdminRequest(BaseModel):
    id: str
    garment_type_id: str
    slot: str
    name: str
    gender: str = "unisex"
    description: Optional[str] = None
    era: str = "Nguyễn"
    is_published: bool = True
    metadata: Dict[str, Any] = {}


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
