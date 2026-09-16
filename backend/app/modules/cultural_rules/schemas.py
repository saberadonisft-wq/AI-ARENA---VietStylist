from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class OutfitItemInput(BaseModel):
    slot: str
    item_id: str
    variant_id: Optional[str] = None
    color_hex: Optional[str] = None


class CulturalCheckRequest(BaseModel):
    garment_type_id: Optional[str] = None
    occasion_id: Optional[str] = None
    style_mode: str = "traditional" # traditional, remix, modern_fusion
    overlap_direction: str = "right_over_left" # right_over_left (hữu nhậm), left_over_right (tả nhậm)
    items: List[OutfitItemInput]


class CulturalRuleWarning(BaseModel):
    rule_id: str
    code: str
    name: str
    severity: str # info, warning, strict
    explanation: str
    source_title: Optional[str] = None
    source_citation: Optional[str] = None
    suggested_fix: Optional[Dict[str, Any]] = None


class CulturalCheckResponse(BaseModel):
    is_culturally_sound: bool
    strict_count: int
    warning_count: int
    info_count: int
    warnings: List[CulturalRuleWarning]
