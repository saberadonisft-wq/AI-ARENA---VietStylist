from typing import List, Dict, Any
from app.core.database import Database


class CulturalRuleRepository:
    @staticmethod
    def get_active_rules() -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT r.*, s.title as source_title, s.citation_text as source_citation
            FROM cultural_rules r
            LEFT JOIN heritage_sources s ON r.source_id = s.id
            WHERE r.is_active = 1
        """)
