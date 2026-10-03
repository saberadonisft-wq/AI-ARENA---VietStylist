import json
from typing import List, Optional, Dict, Any
from app.core.database import Database


class HeritageRepository:
    @staticmethod
    def get_published_articles(
        era: Optional[str] = None,
        category: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        query = ("SELECT id,title,slug,short_summary,status,version,author_id,author_name,author_role,"
                 "cover_image_url,category,era,related_garment_id,read_time_minutes,likes_count,created_at "
                 "FROM heritage_articles WHERE status = 'published'")
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
    def get_article_by_slug_or_id(identifier: str, published_only: bool = True, conn=None) -> Optional[Dict[str, Any]]:
        if published_only:
            return Database.fetch_one(
                "SELECT * FROM heritage_articles WHERE (id = ? OR slug = ?) AND status = 'published'",
                (identifier, identifier),
                conn=conn,
            )
        return Database.fetch_one(
            "SELECT * FROM heritage_articles WHERE id = ? OR slug = ?",
            (identifier, identifier),
            conn=conn,
        )

    @staticmethod
    def create_story(story_data: Dict[str, Any], conn=None) -> str:
        Database.execute("""
            INSERT INTO heritage_articles (
                id, title, slug, short_summary, full_content,
                historical_context, structural_description, modern_interpretation,
                author_id, author_name, author_role, cover_image_url,
                category, era, related_garment_id, read_time_minutes, likes_count,
                images_json, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
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
            json.dumps(story_data.get("images", []), ensure_ascii=False),
        ), conn=conn)
        return story_data["id"]

    @staticmethod
    def update_story(story_id: str, data: Dict[str, Any], expected_version: int, conn=None) -> bool:
        fields = ("title", "short_summary", "full_content", "category", "era", "related_garment_id",
                  "historical_context", "modern_interpretation", "structural_description", "cover_image_url", "read_time_minutes")
        return Database.execute(
            "UPDATE heritage_articles SET " + ", ".join(f"{field}=?" for field in fields)
            + ", images_json=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?",
            tuple(data.get(field) for field in fields) + (json.dumps(data["images"], ensure_ascii=False), story_id, expected_version),
            conn=conn,
        ) == 1

    @staticmethod
    def delete_story(story_id: str, conn=None) -> bool:
        count = Database.execute("DELETE FROM heritage_articles WHERE id = ?", (story_id,), conn=conn)
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
