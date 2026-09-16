from typing import List, Dict, Any
from app.modules.heritage.repository import HeritageRepository
from app.core.errors import AppError


class HeritageService:
    @staticmethod
    def list_articles() -> List[Dict[str, Any]]:
        return HeritageRepository.get_published_articles()

    @staticmethod
    def get_article_detail(identifier: str) -> Dict[str, Any]:
        article = HeritageRepository.get_article_by_slug_or_id(identifier)
        if not article:
            raise AppError(code="ARTICLE_NOT_FOUND", message=f"Không tìm thấy bài viết di sản '{identifier}'", status_code=404)

        raw_sources = HeritageRepository.get_sources_by_article_id(article["id"])
        formatted_sources = []
        for s in raw_sources:
            source_info = {
                "id": s["id"],
                "title": s["title"],
                "author": s.get("author"),
                "publication_year": s.get("publication_year"),
                "publisher": s.get("publisher"),
                "citation_text": s["citation_text"],
                "url": s.get("url"),
                "license_type": s.get("license_type", "Public Reference"),
            }
            formatted_sources.append({
                "source": source_info,
                "page_reference": s.get("page_reference"),
                "quote": s.get("quote"),
            })

        result = dict(article)
        result["sources"] = formatted_sources
        return result

    @staticmethod
    def list_sources() -> List[Dict[str, Any]]:
        return HeritageRepository.get_all_sources()
