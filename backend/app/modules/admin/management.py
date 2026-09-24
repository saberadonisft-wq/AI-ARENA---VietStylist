"""Explicit admin operations; personal endpoints retain their ownership boundary."""
import json
import uuid

from app.core.database import Database, db_transaction, INTEGRITY_ERRORS
from app.core.errors import AppError
from app.modules.auth.service import AuthService
from app.modules.catalog.repository import CatalogRepository
from app.modules.outfits.service import OutfitService
from app.modules.lookbooks.service import LookbookService
from app.modules.admin.recolor_guard import validate_item_metadata_update


class ManagementService:
    @staticmethod
    def overview():
        return {key: Database.fetch_one(query)["n"] for key, query in {
            "users": "SELECT COUNT(*) AS n FROM accounts",
            "items": "SELECT COUNT(*) AS n FROM items",
            "outfits": "SELECT COUNT(*) AS n FROM outfits WHERE is_deleted=0",
            "lookbooks": "SELECT COUNT(*) AS n FROM lookbooks",
            "rules": "SELECT COUNT(*) AS n FROM cultural_rules WHERE is_active=1",
        }.items()}

    @staticmethod
    def user_page(search, limit, offset):
        where = "WHERE LOWER(email) LIKE LOWER(?) OR LOWER(display_name) LIKE LOWER(?)"
        args = (f"%{search}%",) * 2
        rows = Database.fetch_all(
            f"SELECT id, email, display_name, is_active, auth_provider, created_at FROM accounts {where} ORDER BY created_at DESC, id LIMIT ? OFFSET ?",
            (*args, limit, offset),
        )
        for row in rows:
            row["roles"] = AuthService.get_user_roles(row["id"])
            row["created_at"] = str(row["created_at"])
        return {"items": rows, "total": Database.fetch_one(f"SELECT COUNT(*) AS n FROM accounts {where}", args)["n"]}

    @staticmethod
    def update_user(user_id, actor_id, req):
        with db_transaction() as conn:
            account = Database.fetch_one("SELECT id FROM accounts WHERE id=?", (user_id,), conn=conn)
            if not account:
                raise AppError(code="USER_NOT_FOUND", message="Không tìm thấy tài khoản.", status_code=404)
            roles = {r["role"] for r in Database.fetch_all("SELECT role FROM user_roles WHERE user_id=?", (user_id,), conn=conn)}
            if user_id == actor_id or roles & {"admin", "editor"}:
                raise AppError(code="PROTECTED_ACCOUNT", message="Không thay đổi tài khoản quản trị hoặc biên tập tại đây.", status_code=409)
            if req.is_active is not None:
                conn.execute("UPDATE accounts SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (int(req.is_active), user_id))
            if req.is_stylist is not None:
                if "user" not in roles:
                    conn.execute("INSERT INTO user_roles(id,user_id,role) VALUES(?,?,'user') ON CONFLICT(user_id,role) DO NOTHING", (str(uuid.uuid4()), user_id))
                if req.is_stylist:
                    conn.execute("INSERT INTO user_roles(id,user_id,role) VALUES(?,?,'stylist') ON CONFLICT(user_id,role) DO NOTHING", (str(uuid.uuid4()), user_id))
                else:
                    conn.execute("DELETE FROM user_roles WHERE user_id=? AND role='stylist'", (user_id,))
        return {"status": "updated", "user_id": user_id}

    @staticmethod
    def item_page(search, limit, offset):
        rows = Database.fetch_all("SELECT * FROM items WHERE LOWER(name) LIKE LOWER(?) ORDER BY name,id LIMIT ? OFFSET ?", (f"%{search}%", limit, offset))
        for row in rows:
            row["variants"] = CatalogRepository.get_variants_by_item_id(row["id"])
        return {"items": rows, "total": Database.fetch_one("SELECT COUNT(*) AS n FROM items WHERE LOWER(name) LIKE LOWER(?)", (f"%{search}%",))["n"]}

    @staticmethod
    def update_item(item_id, req):
        if item_id != req.id:
            raise AppError(code="ITEM_ID_IMMUTABLE", message="Không thể đổi mã trang phục.", status_code=422)
        try:
            with db_transaction() as conn:
                current = Database.fetch_one("SELECT metadata FROM items WHERE id=?", (item_id,), conn=conn)
                if not current:
                    raise AppError(code="ITEM_NOT_FOUND", message="Không tìm thấy trang phục.", status_code=404)
                metadata = validate_item_metadata_update(current.get("metadata"), req.metadata)
                changed = Database.execute("""UPDATE items SET garment_type_id=?,slot=?,name=?,gender=?,description=?,era=?,is_published=?,metadata=? WHERE id=?""",
                    (req.garment_type_id,req.slot,req.name,req.gender,req.description,req.era,int(req.is_published),json.dumps(metadata,ensure_ascii=False),item_id), conn=conn)
        except INTEGRITY_ERRORS:
            raise AppError(code="INVALID_GARMENT_TYPE", message="Nhóm trang phục không tồn tại.", status_code=422)
        if not changed:
            raise AppError(code="ITEM_NOT_FOUND", message="Không tìm thấy trang phục.", status_code=404)
        return {"status": "updated", "item_id": item_id}

    @staticmethod
    def delete_item(item_id):
        # Snapshots store IDs in JSON, not foreign keys. Keep historical looks intact.
        import json
        catalog_media_id = None
        with db_transaction() as conn:
            item = Database.fetch_one("SELECT metadata FROM items WHERE id=?", (item_id,), conn=conn)
            if not item:
                raise AppError(code="ITEM_NOT_FOUND", message="Không tìm thấy trang phục.", status_code=404)
            for row in Database.fetch_all("SELECT snapshot_json FROM outfit_versions", conn=conn):
                snap = row["snapshot_json"]
                if isinstance(snap, dict) and any(i.get("itemId") == item_id for i in snap.get("items", [])):
                    raise AppError(code="ITEM_IN_USE", message="Trang phục đang có trong lịch sử bộ phối. Hãy chuyển sang ẩn thay vì xóa.", status_code=409)
            metadata = item.get("metadata") or {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except (TypeError, ValueError):
                    metadata = {}
            if isinstance(metadata, dict):
                catalog_media_id = metadata.get("catalog_media_id")
            if not Database.execute("DELETE FROM items WHERE id=?", (item_id,), conn=conn):
                raise AppError(code="ITEM_NOT_FOUND", message="Không tìm thấy trang phục.", status_code=404)
        media_cleanup = "complete"
        if catalog_media_id:
            from app.modules.media.service import MediaService
            try:
                MediaService.delete_catalog_public_image(catalog_media_id)
            except AppError:
                # The catalog row is already deleted; failed storage deletes remain
                # tracked for the media reconciler to retry.
                media_cleanup = "pending"
        return {"status": "deleted", "media_cleanup": media_cleanup}

    @staticmethod
    def owner(kind, resource_id):
        table = {"outfits": "outfits", "lookbooks": "lookbooks"}[kind]
        live = " AND is_deleted=0" if kind == "outfits" else ""
        row = Database.fetch_one(f"SELECT owner_id FROM {table} WHERE id=?{live}", (resource_id,))
        if not row:
            raise AppError(code="RESOURCE_NOT_FOUND", message="Không tìm thấy nội dung.", status_code=404)
        return row["owner_id"]

    @staticmethod
    def resource_page(kind, search, limit, offset):
        table = {"outfits": "outfits", "lookbooks": "lookbooks"}[kind]
        live = "r.is_deleted=0 AND " if kind == "outfits" else ""
        rows = Database.fetch_all(f"""SELECT r.id,r.owner_id,a.display_name AS owner_name,a.email AS owner_email
            FROM {table} r LEFT JOIN accounts a ON a.id=r.owner_id
            WHERE {live}LOWER(r.title) LIKE LOWER(?) ORDER BY r.updated_at DESC,r.id LIMIT ? OFFSET ?""", (f"%{search}%",limit,offset))
        get = OutfitService.get_outfit if kind == "outfits" else LookbookService.get_lookbook
        result = [{**get(r["id"], r["owner_id"]).model_dump(), "owner_name": r["owner_name"], "owner_email": r["owner_email"]} for r in rows]
        return {"items": result, "total": Database.fetch_one(f"SELECT COUNT(*) AS n FROM {table} r WHERE {live}LOWER(r.title) LIKE LOWER(?)", (f"%{search}%",))["n"]}
