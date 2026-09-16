from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class LockedItemInput(BaseModel):
    slot: str
    item_id: str
    variant_id: Optional[str] = None


class ContextRecommendationRequest(BaseModel):
    occasion_id: str
    city_key: Optional[str] = "hanoi"
    gender: Optional[str] = "unisex"
    style_mode: str = "traditional" # traditional, remix
    locked_items: List[LockedItemInput] = []


class AIRecommendationRequest(BaseModel):
    prompt: str
    occasion_id: Optional[str] = None
    gender: Optional[str] = "unisex"
    style_mode: str = "traditional"
    locked_items: List[LockedItemInput] = []


class RecommendedItemOutput(BaseModel):
    slot: str
    item_id: str
    variant_id: Optional[str] = None
    item_name: str
    color_name: Optional[str] = None
    hex_color: Optional[str] = None


class RecommendedOutfitOutput(BaseModel):
    title: str
    explanation: str
    items: List[RecommendedItemOutput]


class RecommendationResponse(BaseModel):
    source: str # gemini or cultural_rule_engine
    model: str
    outfits: List[RecommendedOutfitOutput]
