from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.modules.cultural_data_v3.domain.models import ContextQualifier, Identifier


class CulturalSettings(BaseModel):
    """Persist interpretation settings without storing a second copy of the outfit."""
    model_config = ConfigDict(extra="forbid")
    dataset_version: Identifier = "dev"
    ruleset_version: Optional[Identifier] = None
    context: ContextQualifier = Field(default_factory=ContextQualifier)


class ItemTransform(BaseModel):
    dx: float = Field(default=0, allow_inf_nan=False)
    dy: float = Field(default=0, allow_inf_nan=False)
    scale: float = Field(default=1, gt=0, allow_inf_nan=False)
    rotation: float = Field(default=0, allow_inf_nan=False)


class SnapshotItem(BaseModel):
    slot: str
    itemId: str
    variantId: Optional[str] = None
    assetVersion: int = 1
    colorOptionId: Optional[str] = None
    colorHex: Optional[str] = None
    originalColorHex: Optional[str] = None
    colorAlgorithmVersion: Optional[str] = None
    colorSourceVersion: Optional[str] = None
    transform: Optional[ItemTransform] = None


class OutfitSnapshot(BaseModel):
    schemaVersion: int = 1
    avatarId: str = "avatar_nam_chuan"
    poseId: str = "front_01"
    occasionId: Optional[str] = None
    styleMode: str = "traditional" # traditional, remix, modern_fusion
    overlapDirection: str = "right_over_left"
    items: List[SnapshotItem] = []
    lockedSlots: List[str] = Field(default_factory=list)
    backgroundTheme: Literal["white", "dopaper"] = "white"
    aspectRatio: Literal["1:1", "9:16"] = "9:16"
    culturalSettings: Optional[CulturalSettings] = None

    @model_validator(mode="after")
    def unique_slots(self):
        if len({item.slot for item in self.items}) != len(self.items):
            raise ValueError("Mỗi vị trí chỉ được có một món trang phục")
        return self


class CreateOutfitRequest(BaseModel):
    title: str = "Bản phối mới"
    occasion_id: Optional[str] = None
    style_mode: Optional[str] = None
    snapshot: OutfitSnapshot
    preview_image_url: Optional[str] = None


class UpdateOutfitRequest(BaseModel):
    title: Optional[str] = None
    occasion_id: Optional[str] = None
    style_mode: Optional[str] = None
    revision: int # Optimistic concurrency check
    snapshot: OutfitSnapshot
    preview_image_url: Optional[str] = None


class OutfitVersionResponse(BaseModel):
    id: str
    outfit_id: str
    version_number: int
    snapshot: OutfitSnapshot
    preview_image_url: Optional[str] = None
    created_at: str


class OutfitResponse(BaseModel):
    id: str
    owner_id: Optional[str] = None
    title: str
    occasion_id: Optional[str] = None
    style_mode: str
    revision: int
    current_version_id: Optional[str] = None
    current_snapshot: Optional[OutfitSnapshot] = None
    preview_image_url: Optional[str] = None
    created_at: str
    updated_at: str


class CompareRequest(BaseModel):
    snapshot_a: OutfitSnapshot
    snapshot_b: OutfitSnapshot


class SlotDiff(BaseModel):
    slot: str
    item_a_id: Optional[str] = None
    item_b_id: Optional[str] = None
    item_a_name: Optional[str] = None
    item_b_name: Optional[str] = None
    variant_a_hex: Optional[str] = None
    variant_b_hex: Optional[str] = None
    is_changed: bool


class CompareResponse(BaseModel):
    diffs: List[SlotDiff]
    style_changed: bool
    occasion_changed: bool
    summary_message: str
