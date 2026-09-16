from typing import List, Optional
from pydantic import BaseModel


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
    sources: List[ArticleSourceCitation] = []
