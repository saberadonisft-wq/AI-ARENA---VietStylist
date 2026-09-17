import uuid
import re
from typing import List, Dict, Any, Optional
from app.modules.heritage.repository import HeritageRepository
from app.modules.heritage.schemas import CreateStoryRequest
from app.core.errors import AppError


def slugify_vietnamese(text: str) -> str:
    slug = text.lower().strip()
    # Thay thế các ký tự tiếng Việt phổ biến
    slug = re.sub(r"[áàảãạăắằẳẵặâấầẩẫậ]", "a", slug)
    slug = re.sub(r"[éèẻẽẹêếềểễệ]", "e", slug)
    slug = re.sub(r"[íìỉĩị]", "i", slug)
    slug = re.sub(r"[óòỏõọôốồổỗộơớờởỡợ]", "o", slug)
    slug = re.sub(r"[úùủũụưứừửữự]", "u", slug)
    slug = re.sub(r"[ýỳỷỹỵ]", "y", slug)
    slug = re.sub(r"[đ]", "d", slug)
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    return slug


class HeritageService:
    @staticmethod
    def list_articles(
        era: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        return HeritageRepository.get_published_articles(era=era, category=category, search=search)

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
    def create_story(req: CreateStoryRequest, user: Dict[str, Any]) -> Dict[str, Any]:
        story_id = f"story_{uuid.uuid4().hex[:10]}"
        base_slug = slugify_vietnamese(req.title)
        slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"

        # Tính thời gian đọc dựa vào số từ
        word_count = len(req.full_content.split())
        read_time = max(3, round(word_count / 150)) if word_count > 0 else (req.read_time_minutes or 5)

        author_name = user.get("display_name") or user.get("email", "Stylist VietStylist")
        author_role = "admin" if "admin" in user.get("roles", []) else "stylist"

        story_data = {
            "id": story_id,
            "title": req.title,
            "slug": slug,
            "short_summary": req.short_summary,
            "full_content": req.full_content,
            "historical_context": req.historical_context,
            "structural_description": req.structural_description,
            "modern_interpretation": req.modern_interpretation,
            "author_id": user.get("id"),
            "author_name": author_name,
            "author_role": author_role,
            "cover_image_url": req.cover_image_url,
            "category": req.category or "Điển tích Cổ phục",
            "era": req.era or "Triều Nguyễn",
            "related_garment_id": req.related_garment_id,
            "read_time_minutes": read_time,
            "likes_count": 0,
        }

        created_id = HeritageRepository.create_story(story_data)
        return {
            "status": "created",
            "id": created_id,
            "slug": slug,
            "title": req.title,
            "author_name": author_name,
            "category": req.category,
        }

    @staticmethod
    def delete_story(story_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
        article = HeritageRepository.get_article_by_slug_or_id(story_id, published_only=False)
        if not article:
            raise AppError(code="ARTICLE_NOT_FOUND", message="Không tìm thấy bài viết để xóa", status_code=404)

        # Quyền xóa: Admin hoặc chính tác giả
        is_admin = "admin" in user.get("roles", [])
        is_author = article.get("author_id") == user.get("id")
        if not is_admin and not is_author:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền xóa bài viết này", status_code=403)

        HeritageRepository.delete_story(article["id"])
        return {"status": "deleted", "id": article["id"]}

    @staticmethod
    def list_sources() -> List[Dict[str, Any]]:
        return HeritageRepository.get_all_sources()
