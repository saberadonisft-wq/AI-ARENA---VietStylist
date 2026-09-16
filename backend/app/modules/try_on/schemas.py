from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.modules.outfits.schemas import OutfitSnapshot


class CreateTryOnJobRequest(BaseModel):
    user_photo_url: str
    outfit_version_id: Optional[str] = None
    outfit_snapshot: OutfitSnapshot
    idempotency_key: Optional[str] = None


class TryOnJobResponse(BaseModel):
    job_id: str
    task_type: str = "try_on"
    status: str # queued, running, succeeded, failed, cancelled
    input_hash: str
    outfit_version_id: Optional[str] = None
    result_image_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: str
    updated_at: str
