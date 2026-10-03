import uuid
import re
import json
import logging
from typing import List, Dict, Any, Optional
from app.modules.heritage.repository import HeritageRepository
from app.modules.heritage.schemas import CreateStoryRequest
from app.core.errors import AppError
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService
from app.modules.media.schemas import RequestUploadUrlInput
from app.infrastructure.r2.client import r2_client
from app.core.config import settings
from app.core.database import Database, db_transaction

logger = logging.getLogger(__name__)


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
    def create_image_upload(req, user_id):
        if r2_client.is_configured and not settings.R2_PUBLIC_DOMAIN:
            raise AppError("PUBLIC_MEDIA_DOMAIN_REQUIRED", "Chưa cấu hình kho ảnh công khai.", 503)
        # This publishing capability is restricted by the heritage router to
        # stylist/admin and raster images; general public/SVG uploads stay restricted.
        return MediaService.create_upload_session(
            user_id,
            RequestUploadUrlInput(**req.model_dump(), media_type="image", visibility="public"),
            roles=("editor",),
        )

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
        images = result.pop("images_json", [])
        result["images"] = json.loads(images) if isinstance(images, str) else images
        result["sources"] = formatted_sources
        return result

    @staticmethod
    def create_story(req: CreateStoryRequest, user: Dict[str, Any], existing=None) -> Dict[str, Any]:
        with db_transaction() as conn:
            if existing:
                current = HeritageRepository.get_article_by_slug_or_id(existing["id"], conn=conn)
                if not current:
                    raise AppError("ARTICLE_NOT_FOUND", "Câu chuyện đã bị xóa.", 404)
                if current["version"] != req.expected_version:
                    raise AppError("ARTICLE_VERSION_CONFLICT", "Bài viết đã được cập nhật ở cửa sổ khác. Bản đang soạn của bạn vẫn được giữ lại.", 409,
                                   {"current_version": current["version"]})
                existing = current
            result = HeritageService._save_story(req, user, existing, conn)
            queued = HeritageService._queue_unused_images(existing, conn) if existing else []
        result["media_cleanup_pending"] = HeritageService._cleanup_images(queued)
        return result

    @staticmethod
    def _save_story(req, user, existing, conn):
        images = []
        seen = set()
        existing_images = (existing.get("images_json") or existing.get("images") or []) if existing else []
        if isinstance(existing_images, str):
            existing_images = json.loads(existing_images)
        retained_ids = {image["media_id"] for image in existing_images}
        for image in req.images:
            media = Database.fetch_one("SELECT * FROM media_assets WHERE id=?", (image.media_id,), conn=conn)
            if (
                not media or (media["owner_id"] != user.get("id") and image.media_id not in retained_ids)
                or media["status"] != "ready" or media["visibility"] != "public"
                or media["media_type"] != "image"
                or media["mime_type"] not in {"image/png", "image/jpeg", "image/webp"}
                or not media.get("public_url") or image.media_id in seen
            ):
                raise AppError("INVALID_STORY_IMAGE", "Ảnh minh họa phải là ảnh công khai đã tải xong của bạn và không trùng lặp.", 422)
            seen.add(image.media_id)
            images.append({"media_id": image.media_id, "caption": image.caption.strip(), "url": media["public_url"]})
        if req.cover_image_url:
            cover = Database.fetch_one("SELECT status,visibility FROM media_assets WHERE public_url=?", (req.cover_image_url,), conn=conn)
            if cover and (cover["status"] != "ready" or cover["visibility"] != "public"):
                raise AppError("INVALID_STORY_IMAGE", "Ảnh bìa không còn khả dụng. Hãy chọn ảnh khác.", 422)
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
            "cover_image_url": req.cover_image_url or (images[0]["url"] if images else None),
            "images": images,
            "category": req.category or "Điển tích Cổ phục",
            "era": req.era or "Triều Nguyễn",
            "related_garment_id": req.related_garment_id,
            "read_time_minutes": read_time,
            "likes_count": 0,
        }

        if existing:
            if not HeritageRepository.update_story(existing["id"], story_data, req.expected_version, conn=conn):
                raise AppError("ARTICLE_VERSION_CONFLICT", "Bài viết đã thay đổi. Hãy kiểm tra phiên bản mới trước khi lưu.", 409)
            return {"status": "updated", "id": existing["id"], "slug": existing["slug"], "title": req.title, "version": req.expected_version + 1}
        created_id = HeritageRepository.create_story(story_data, conn=conn)
        return {
            "status": "created",
            "id": created_id,
            "slug": slug,
            "title": req.title,
            "author_name": author_name,
            "category": req.category,
            "version": 1,
        }

    @staticmethod
    def update_story(identifier: str, req: CreateStoryRequest, user: Dict[str, Any]) -> Dict[str, Any]:
        existing = HeritageService.get_article_detail(identifier)
        if "admin" not in user.get("roles", []) and existing.get("author_id") != user.get("id"):
            raise AppError("FORBIDDEN", "Bạn không có quyền chỉnh sửa câu chuyện này", 403)
        return HeritageService.create_story(req, user, existing=existing)

    @staticmethod
    def delete_story(story_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
        with db_transaction() as conn:
            article = HeritageRepository.get_article_by_slug_or_id(story_id, published_only=False, conn=conn)
            if not article:
                raise AppError(code="ARTICLE_NOT_FOUND", message="Không tìm thấy bài viết để xóa", status_code=404)
            if "admin" not in user.get("roles", []) and article.get("author_id") != user.get("id"):
                raise AppError(code="FORBIDDEN", message="Bạn không có quyền xóa bài viết này", status_code=403)
            HeritageRepository.delete_story(article["id"], conn=conn)
            queued = HeritageService._queue_unused_images(article, conn)
        pending = HeritageService._cleanup_images(queued)
        return {"status": "deleted", "id": article["id"], "media_cleanup_pending": pending}

    @staticmethod
    def _queue_unused_images(article, conn):
        images = article.get("images_json") or []
        if isinstance(images, str):
            images = json.loads(images)
        identifiers = {image["media_id"] for image in images}
        # Also handle images retained only as covers after a gallery edit.
        cover = Database.fetch_one("SELECT id FROM media_assets WHERE public_url=? AND owner_id=?",
                                  (article.get("cover_image_url"), article.get("author_id")), conn=conn)
        if cover:
            identifiers.add(cover["id"])
        queued = []
        for media_id in sorted(identifiers):
            media = Database.fetch_one("SELECT * FROM media_assets WHERE id=?", (media_id,), conn=conn)
            if media and media["status"] == "ready" and media["visibility"] == "public":
                if MediaRepository.mark_media_deleting_if_unused(media_id, media["owner_id"], conn=conn) == "marked":
                    Database.execute("UPDATE media_assets SET next_reconcile_at=0 WHERE id=?", (media_id,), conn=conn)
                    queued.append((media_id, media["owner_id"]))
        return queued

    @staticmethod
    def _cleanup_images(queued):
        pending = 0
        for media_id, owner_id in queued:
            try:
                MediaService.delete_media(media_id, owner_id)
            except Exception:
                # The deleting state survives storage failures; the existing
                # janitor retries without rolling back a successful article save.
                pending += 1
                logger.warning("Story media cleanup pending media_id=%s", media_id)
        return pending

    @staticmethod
    def list_sources() -> List[Dict[str, Any]]:
        return HeritageRepository.get_all_sources()
