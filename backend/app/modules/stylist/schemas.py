from typing import Literal, Optional
from pydantic import BaseModel, Field


class CreateGarmentSubmissionRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    garment_type_id: str = Field(min_length=1, max_length=120)
    slot: Literal["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "accessory_back", "footwear"]
    gender: Literal["male", "female", "unisex"] = "unisex"
    description: str = Field(min_length=10, max_length=2000)
    era: str = Field(default="Nguyễn", min_length=1, max_length=100)
    color_name: str = Field(min_length=2, max_length=80)
    hex_color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")
    material: str = Field(default="Lụa tơ tằm", min_length=1, max_length=120)
    media_id: str = Field(min_length=1, max_length=120)


class CreateGarmentTypeRequest(BaseModel):
    id: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=200)


class ReviewGarmentSubmissionRequest(BaseModel):
    action: Literal["approve", "reject"]
    note: Optional[str] = Field(default=None, max_length=1000)


class GarmentSubmissionResponse(BaseModel):
    id: str
    name: str
    garment_type_id: str
    garment_type_name: Optional[str] = None
    slot: str
    gender: str
    description: Optional[str] = None
    era: Optional[str] = None
    status: Literal["pending", "approved", "rejected"]
    color_name: Optional[str] = None
    hex_color: Optional[str] = None
    material: Optional[str] = None
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_note: Optional[str] = None
    submitter_id: Optional[str] = None
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None
    media_id: Optional[str] = None


class GarmentSubmissionPage(BaseModel):
    items: list[GarmentSubmissionResponse]
    total: int
