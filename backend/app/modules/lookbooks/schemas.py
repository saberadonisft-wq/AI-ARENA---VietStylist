from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.modules.outfits.schemas import OutfitSnapshot


class LookbookEntryInput(BaseModel):
    outfit_version_id: str
    sort_order: int = 0
    notes: Optional[str] = None


class CreateLookbookRequest(BaseModel):
    title: str = "Lookbook Cổ Phục"
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    visibility: str = "private" # private, unlisted, public
    entries: List[LookbookEntryInput] = []


class UpdateLookbookRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    visibility: Optional[str] = None
    entries: Optional[List[LookbookEntryInput]] = None


class LookbookEntryDetail(BaseModel):
    id: str
    outfit_id: str
    outfit_version_id: str
    version_number: int
    outfit_title: str
    snapshot: OutfitSnapshot
    preview_image_url: Optional[str] = None
    sort_order: int
    notes: Optional[str] = None


class LookbookResponse(BaseModel):
    id: str
    owner_id: str
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    visibility: str
    created_at: str
    updated_at: str
    entries: List[LookbookEntryDetail] = []


class CreateShareLinkRequest(BaseModel):
    scope: str = "view_only"
    expires_in_days: Optional[int] = 30


class ShareLinkResponse(BaseModel):
    share_token: str
    share_url: str
    scope: str
    expires_at: Optional[str] = None


class SharedLookbookViewResponse(BaseModel):
    title: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    owner_display_name: str = "Người yêu Việt phục"
    created_at: str
    entries: List[LookbookEntryDetail] = []
