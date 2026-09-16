from typing import List, Optional, Dict, Any
from app.core.database import Database


class HeritageRepository:
    @staticmethod
    def get_published_articles() -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM heritage_articles WHERE status = 'published' ORDER BY created_at ASC")

    @staticmethod
    def get_article_by_slug_or_id(identifier: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one(
            "SELECT * FROM heritage_articles WHERE id = ? OR slug = ?",
            (identifier, identifier),
        )

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
