from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ColorInput(BaseModel):
    slot: str
    hex_color: str = Field(pattern=r"^#?(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
    color_name: Optional[str] = None
    item_id: Optional[str] = None
    variant_id: Optional[str] = None


class ColorAnalysisRequest(BaseModel):
    colors: List[ColorInput] = Field(max_length=32)


class ColorVariantSuggestion(BaseModel):
    item_id: str
    variant_id: str
    color_name: str
    hex_color: str
    harmony_reason: str


class ColorAnalysisResponse(BaseModel):
    dominant_color: str
    accent_colors: List[str]
    palette_type: (
        str  # monochromatic, analogous, complementary, triadic, neutral_balance
    )
    contrast_rating: str  # good, moderate, low
    contrast_ratio: float
    aesthetic_comment: str
    suggested_variants: List[ColorVariantSuggestion]
