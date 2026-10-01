from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class RequestUploadUrlInput(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    media_type: Literal["image", "video"] = "image"  # image, video
    mime_type: str = "image/png"
    size_bytes: Optional[int] = Field(
        default=None, gt=0,
        description="Exact file size in bytes; required for R2 uploads and bound into the signed PUT URL.",
    )
    visibility: Literal["public", "private", "unlisted"] = (
        "private"  # public, private, unlisted
    )


class UploadUrlResponse(BaseModel):
    media_id: str
    upload_url: str
    method: str
    object_key: str
    bucket: str
    expires_in: int
    storage_type: str  # r2 or local


class CompleteUploadRequest(BaseModel):
    width: Optional[int] = None
    height: Optional[int] = None


class MediaAssetResponse(BaseModel):
    id: str
    bucket: str
    object_key: str
    public_url: Optional[str] = None
    media_type: str
    mime_type: str
    size_bytes: Optional[int] = None
    visibility: str
    status: str
    created_at: str


class AccessUrlResponse(BaseModel):
    access_url: str
    expires_in: int


class AIMediaResponse(BaseModel):
    media_id: str
    purposes: List[Literal["person", "outfit", "result"]]
    status: str
    created_at: str
