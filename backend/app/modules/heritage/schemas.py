from typing import List, Optional
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
