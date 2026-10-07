from typing import List, Optional, Dict, Any
from app.core.database import Database


class CatalogRepository:
    @staticmethod
    def get_garment_types() -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM garment_types WHERE is_active = 1 ORDER BY id")

    @staticmethod
    def get_occasions() -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM occasions ORDER BY id")

    @staticmethod
    def get_items(
        garment_type_id: Optional[str] = None,
        slot: Optional[str] = None,
        gender: Optional[str] = None,
        occasion_id: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        *, conn=None,
    ) -> List[Dict[str, Any]]:
        query = """
            SELECT i.* FROM items i
            WHERE i.is_published = 1
        """
        params = []

        if garment_type_id:
            query += " AND i.garment_type_id = ?"
            params.append(garment_type_id)

        if slot:
            query += " AND i.slot = ?"
            params.append(slot)

        if gender and gender != "all":
            query += " AND (i.gender = ? OR i.gender = 'unisex')"
            params.append(gender)

        if occasion_id:
            query += " AND EXISTS (SELECT 1 FROM item_occasions io WHERE io.item_id = i.id AND io.occasion_id = ?)"
            params.append(occasion_id)

        if search:
            query += " AND (i.name LIKE ? OR i.description LIKE ?)"
            params.append(f"%{search}%")
            params.append(f"%{search}%")

        query += " ORDER BY i.created_at ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        return Database.fetch_all(query, tuple(params), conn=conn)

    @staticmethod
    def get_item_by_id(item_id: str, published_only: bool = True, *, conn=None) -> Optional[Dict[str, Any]]:
        if published_only:
            return Database.fetch_one("SELECT * FROM items WHERE id = ? AND is_published = 1", (item_id,), conn=conn)
        return Database.fetch_one("SELECT * FROM items WHERE id = ?", (item_id,), conn=conn)

    @staticmethod
    def get_published_items_by_ids(item_ids: List[str], *, conn=None) -> List[Dict[str, Any]]:
        """Fetch one published set, retaining the caller's prompt order."""
        identifiers = list(dict.fromkeys(item_ids))
        if not identifiers:
            return []
        placeholders = ",".join("?" for _ in identifiers)
        rows = Database.fetch_all(
            f"SELECT * FROM items WHERE is_published=1 AND id IN ({placeholders})",
            tuple(identifiers), conn=conn,
        )
        by_id = {row["id"]: row for row in rows}
        return [by_id[identifier] for identifier in item_ids if identifier in by_id]

    @staticmethod
    def get_variants_by_item_id(item_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM item_variants WHERE item_id = ? ORDER BY is_default DESC", (item_id,))

    @staticmethod
    def get_variants_by_item_ids(item_ids: List[str], *, conn=None) -> List[Dict[str, Any]]:
        if not item_ids:
            return []
        placeholders = ", ".join(["?"] * len(item_ids))
        return Database.fetch_all(f"""
            SELECT * FROM item_variants
            WHERE item_id IN ({placeholders})
            ORDER BY item_id, is_default DESC
        """, tuple(item_ids), conn=conn)

    @staticmethod
    def get_layers_by_item_id(item_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM asset_layers WHERE item_id = ? ORDER BY z_index ASC", (item_id,))

    @staticmethod
    def get_layers_by_item_ids(item_ids: List[str], *, conn=None) -> List[Dict[str, Any]]:
        if not item_ids:
            return []
        placeholders = ", ".join(["?"] * len(item_ids))
        return Database.fetch_all(f"""
            SELECT * FROM asset_layers
            WHERE item_id IN ({placeholders})
            ORDER BY item_id, z_index ASC
        """, tuple(item_ids), conn=conn)

    @staticmethod
    def get_occasions_by_item_id(item_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all("""
            SELECT o.*, io.priority_score, io.editorial_note 
            FROM occasions o
            JOIN item_occasions io ON o.id = io.occasion_id
            WHERE io.item_id = ?
        """, (item_id,))

    @staticmethod
    def get_avatars() -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM avatars WHERE is_active = 1 ORDER BY id")

    @staticmethod
    def get_avatar_by_id(avatar_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM avatars WHERE id = ?", (avatar_id,))
