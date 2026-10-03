from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class HeritageSourceResponse(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    publication_year: Optional[int] = None
    publisher: Optional[str] = None
    citation_text: str
    url: Optional[str] = None
    license_type: str = "Public Reference"


class ArticleSourceCitation(BaseModel):
    source: HeritageSourceResponse
    page_reference: Optional[str] = None
    quote: Optional[str] = None


class StoryImageInput(BaseModel):
    media_id: str = Field(min_length=1, max_length=100)
    caption: str = Field(default="", max_length=500)


class StoryImageResponse(StoryImageInput):
    url: str


class StoryImageUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    size_bytes: int = Field(gt=0, le=10485760)


class HeritageArticleSummaryResponse(BaseModel):
    id: str
    title: str
    slug: str
    short_summary: str
    status: str
    version: int
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = "stylist"
    cover_image_url: Optional[str] = None
    category: Optional[str] = "Điển tích Cổ phục"
    era: Optional[str] = "Triều Nguyễn"
    related_garment_id: Optional[str] = None
    read_time_minutes: Optional[int] = 5
    likes_count: Optional[int] = 0
    created_at: Optional[str] = None


class HeritageArticleDetailResponse(BaseModel):
    id: str
    title: str
    slug: str
    short_summary: str
    full_content: Optional[str] = None
    structural_description: Optional[str] = None
    historical_context: Optional[str] = None
    modern_interpretation: Optional[str] = None
    status: str
    version: int
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = "stylist"
    cover_image_url: Optional[str] = None
    category: Optional[str] = "Điển tích Cổ phục"
    era: Optional[str] = "Triều Nguyễn"
    related_garment_id: Optional[str] = None
    read_time_minutes: Optional[int] = 5
    likes_count: Optional[int] = 0
    created_at: Optional[str] = None
    sources: List[ArticleSourceCitation] = []
    images: List[StoryImageResponse] = Field(default_factory=list)


class CreateStoryRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    short_summary: str = Field(..., min_length=10)
    full_content: str = Field(..., min_length=20)
    category: Optional[str] = "Điển tích Cổ phục"
    era: Optional[str] = "Triều Nguyễn"
    related_garment_id: Optional[str] = None
    historical_context: Optional[str] = None
    modern_interpretation: Optional[str] = None
    structural_description: Optional[str] = None
    cover_image_url: Optional[str] = None
    read_time_minutes: Optional[int] = 5
    images: List[StoryImageInput] = Field(default_factory=list, max_length=12)
