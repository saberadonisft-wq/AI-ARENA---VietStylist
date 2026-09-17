import hashlib
import json
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.modules.lookbooks.schemas import (
    CreateLookbookRequest,
    UpdateLookbookRequest,
    LookbookResponse,
    LookbookEntryDetail,
    ShareLinkResponse,
    SharedLookbookViewResponse,
)
from app.modules.lookbooks.repository import LookbookRepository
from app.modules.outfits.schemas import OutfitSnapshot
from app.core.errors import AppError


class LookbookService:
    @staticmethod
    def list_user_lookbooks(owner_id: str) -> List[LookbookResponse]:
        rows = LookbookRepository.get_user_lookbooks(owner_id)
        if not rows:
            return []

        lookbook_ids = [r["id"] for r in rows]
        raw_entries = LookbookRepository.get_entries_by_lookbook_ids(lookbook_ids)

        entries_by_lb: Dict[str, List[LookbookEntryDetail]] = {}
        for e in raw_entries:
            snap = e.get("snapshot_json")
            parsed_snap = OutfitSnapshot(**snap) if isinstance(snap, dict) else (OutfitSnapshot(**json.loads(snap)) if isinstance(snap, str) else None)
            detail = LookbookEntryDetail(
                id=e["id"],
                outfit_id=e["outfit_id"],
                outfit_version_id=e["outfit_version_id"],
                version_number=e["version_number"],
                outfit_title=e["outfit_title"],
                snapshot=parsed_snap or OutfitSnapshot(),
                preview_image_url=e.get("preview_image_url"),
                sort_order=e["sort_order"],
                notes=e.get("notes"),
            )
            entries_by_lb.setdefault(e["lookbook_id"], []).append(detail)

        result = []
        for r in rows:
            entries = entries_by_lb.get(r["id"], [])
            result.append(LookbookResponse(
                id=r["id"],
                owner_id=r["owner_id"],
                title=r["title"],
                description=r.get("description"),
                cover_image_url=r.get("cover_image_url"),
                visibility=r["visibility"],
                created_at=str(r["created_at"]),
                updated_at=str(r["updated_at"]),
                entries=entries,
            ))
        return result

    @staticmethod
    def create_lookbook(owner_id: str, req: CreateLookbookRequest) -> LookbookResponse:
        lookbook_id = str(uuid.uuid4())
        entries_data = [
            {
                "id": str(uuid.uuid4()),
                "outfit_version_id": e.outfit_version_id,
                "sort_order": e.sort_order,
                "notes": e.notes,
            }
            for e in req.entries
        ]
        LookbookRepository.create_with_entries(
            lookbook_id=lookbook_id,
            owner_id=owner_id,
            title=req.title,
            description=req.description,
            cover_image_url=req.cover_image_url,
            visibility=req.visibility,
            entries=entries_data,
        )
        return LookbookService.get_lookbook(lookbook_id, owner_id)

    @staticmethod
    def get_lookbook(lookbook_id: str, user_id: Optional[str]) -> LookbookResponse:
        r = LookbookRepository.get_lookbook_by_id(lookbook_id)
        if not r:
            raise AppError(code="LOOKBOOK_NOT_FOUND", message="Không tìm thấy lookbook yêu cầu", status_code=404)

        if r["visibility"] == "private" and (not user_id or r["owner_id"] != user_id):
            raise AppError(code="FORBIDDEN", message="Lookbook này đang ở chế độ riêng tư", status_code=403)

        entries = LookbookService._get_formatted_entries(lookbook_id)
        return LookbookResponse(
            id=r["id"],
            owner_id=r["owner_id"],
            title=r["title"],
            description=r.get("description"),
            cover_image_url=r.get("cover_image_url"),
            visibility=r["visibility"],
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"]),
            entries=entries,
        )

    @staticmethod
    def update_lookbook(lookbook_id: str, owner_id: str, req: UpdateLookbookRequest) -> LookbookResponse:
        current = LookbookRepository.get_lookbook_by_id(lookbook_id)
        if not current:
            raise AppError(code="LOOKBOOK_NOT_FOUND", message="Không tìm thấy lookbook yêu cầu", status_code=404)
        if current["owner_id"] != owner_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền sửa lookbook này", status_code=403)

        title = req.title if req.title is not None else current["title"]
        description = req.description if req.description is not None else current["description"]
        cover_image_url = req.cover_image_url if req.cover_image_url is not None else current["cover_image_url"]
        visibility = req.visibility if req.visibility is not None else current["visibility"]

        entries_data = None
        if req.entries is not None:
            entries_data = [
                {
                    "id": str(uuid.uuid4()),
                    "outfit_version_id": e.outfit_version_id,
                    "sort_order": e.sort_order,
                    "notes": e.notes,
                }
                for e in req.entries
            ]

        LookbookRepository.update_with_entries(
            lookbook_id=lookbook_id,
            owner_id=owner_id,
            title=title,
            description=description,
            cover_image_url=cover_image_url,
            visibility=visibility,
            entries=entries_data,
        )
        return LookbookService.get_lookbook(lookbook_id, owner_id)

    @staticmethod
    def delete_lookbook(lookbook_id: str, owner_id: str) -> None:
        current = LookbookRepository.get_lookbook_by_id(lookbook_id)
        if not current:
            return
        if current["owner_id"] != owner_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền xóa lookbook này", status_code=403)
        LookbookRepository.delete_lookbook(lookbook_id)

    @staticmethod
    def generate_share_link(lookbook_id: str, owner_id: str, expires_in_days: int = 30) -> ShareLinkResponse:
        current = LookbookRepository.get_lookbook_by_id(lookbook_id)
        if not current:
            raise AppError(code="LOOKBOOK_NOT_FOUND", message="Không tìm thấy lookbook yêu cầu", status_code=404)
        if current["owner_id"] != owner_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền chia sẻ lookbook này", status_code=403)

        if expires_in_days is None or expires_in_days < 1 or expires_in_days > 30:
            raise AppError(code="VALIDATION_ERROR", message="expires_in_days phải nằm trong khoảng từ 1 đến 30 ngày", status_code=422)

        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        token_prefix = token[:8]
        link_id = str(uuid.uuid4())

        expires_at = (datetime.now(timezone.utc) + timedelta(days=expires_in_days)).isoformat()

        LookbookRepository.create_share_link(
            link_id=link_id,
            lookbook_id=lookbook_id,
            outfit_version_id=None,
            token_hash=token_hash,
            token_prefix=token_prefix,
            scope="view_only",
            expires_at=expires_at,
        )

        origin = settings.FRONTEND_PUBLIC_ORIGIN.rstrip("/")
        share_url = f"{origin}/chia-se/{token}"
        return ShareLinkResponse(
            share_token=token,
            share_url=share_url,
            scope="view_only",
            expires_at=expires_at,
        )

    @staticmethod
    def revoke_shares(lookbook_id: str, owner_id: str) -> Dict[str, Any]:
        current = LookbookRepository.get_lookbook_by_id(lookbook_id)
        if not current:
            raise AppError(code="LOOKBOOK_NOT_FOUND", message="Không tìm thấy lookbook yêu cầu", status_code=404)
        if current["owner_id"] != owner_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền thu hồi chia sẻ của lookbook này", status_code=403)
        count = LookbookRepository.revoke_shares_by_lookbook(lookbook_id)
        return {"message": "Đã thu hồi tất cả liên kết chia sẻ của lookbook", "revoked_count": count}

    @staticmethod
    def resolve_shared_token(token: str) -> SharedLookbookViewResponse:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        share = LookbookRepository.get_share_by_token_hash(token_hash)
        if not share or share.get("is_revoked"):
            raise AppError(code="SHARE_NOT_FOUND", message="Liên kết chia sẻ không tồn tại hoặc đã bị thu hồi", status_code=404)

        if share.get("expires_at"):
            exp_str = share["expires_at"]
            if exp_str.endswith("Z"):
                exp_str = exp_str[:-1] + "+00:00"
            exp = datetime.fromisoformat(exp_str)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                raise AppError(code="SHARE_EXPIRED", message="Liên kết chia sẻ đã hết hạn hiệu lực", status_code=410)

        lookbook_id = share["lookbook_id"]
        entries = LookbookService._get_formatted_entries(lookbook_id)

        return SharedLookbookViewResponse(
            title=share.get("lookbook_title") or "Bộ sưu tập Cổ phục",
            description=share.get("lookbook_desc"),
            cover_image_url=share.get("cover_image_url"),
            owner_display_name="Tác giả Việt phục Remix",
            created_at=str(share["created_at"]),
            entries=entries,
        )

    @staticmethod
    def _get_formatted_entries(lookbook_id: str) -> List[LookbookEntryDetail]:
        raw_entries = LookbookRepository.get_entries(lookbook_id)
        result = []
        for e in raw_entries:
            snap = e.get("snapshot_json")
            parsed_snap = OutfitSnapshot(**snap) if isinstance(snap, dict) else (OutfitSnapshot(**json.loads(snap)) if isinstance(snap, str) else None)
            result.append(LookbookEntryDetail(
                id=e["id"],
                outfit_id=e["outfit_id"],
                outfit_version_id=e["outfit_version_id"],
                version_number=e["version_number"],
                outfit_title=e["outfit_title"],
                snapshot=parsed_snap or OutfitSnapshot(),
                preview_image_url=e.get("preview_image_url"),
                sort_order=e["sort_order"],
                notes=e.get("notes"),
            ))
        return result
