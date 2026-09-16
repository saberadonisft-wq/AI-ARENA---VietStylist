from typing import List, Optional, Dict, Any
from app.core.database import Database


class HeritageRepository:
    @staticmethod
    def get_published_articles(
        era: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM heritage_articles WHERE status = 'published'"
        params = []
        if era and era.lower() != "all":
            query += " AND era = ?"
            params.append(era)
        if category and category.lower() != "all":
            query += " AND category = ?"
            params.append(category)
        if search:
            query += " AND (title LIKE ? OR short_summary LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        query += " ORDER BY created_at DESC"
        return Database.fetch_all(query, tuple(params))

    @staticmethod
    def get_article_by_slug_or_id(identifier: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one(
            "SELECT * FROM heritage_articles WHERE id = ? OR slug = ?",
            (identifier, identifier),
        )

    @staticmethod
    def create_story(story_data: Dict[str, Any]) -> str:
        Database.execute("""
            INSERT INTO heritage_articles (
                id, title, slug, short_summary, full_content,
                historical_context, structural_description, modern_interpretation,
                author_id, author_name, author_role, cover_image_url,
                category, era, related_garment_id, read_time_minutes, likes_count,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
        """, (
            story_data["id"],
            story_data["title"],
            story_data["slug"],
            story_data["short_summary"],
            story_data["full_content"],
            story_data.get("historical_context"),
            story_data.get("structural_description"),
            story_data.get("modern_interpretation"),
            story_data.get("author_id"),
            story_data.get("author_name"),
            story_data.get("author_role", "stylist"),
            story_data.get("cover_image_url"),
            story_data.get("category", "Điển tích Cổ phục"),
            story_data.get("era", "Triều Nguyễn"),
            story_data.get("related_garment_id"),
            story_data.get("read_time_minutes", 5),
            story_data.get("likes_count", 0),
        ))
        return story_data["id"]

    @staticmethod
    def delete_story(story_id: str) -> bool:
        count = Database.execute("DELETE FROM heritage_articles WHERE id = ?", (story_id,))
        return count > 0

    @staticmethod
    def get_sources_by_article_id(article_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT s.*, ars.page_reference, ars.quote
            FROM heritage_sources s
            JOIN article_sources ars ON s.id = ars.source_id
            WHERE ars.article_id = ?
        """, (article_id,))

    @staticmethod
    def get_all_sources() -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM heritage_sources ORDER BY title ASC")
