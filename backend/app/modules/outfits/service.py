import json
import uuid
from typing import List, Optional, Dict, Any
from app.modules.outfits.schemas import (
    CreateOutfitRequest,
    UpdateOutfitRequest,
    OutfitResponse,
    OutfitVersionResponse,
    OutfitSnapshot,
    CompareRequest,
    CompareResponse,
    SlotDiff,
)
from app.modules.outfits.repository import OutfitRepository
from app.modules.catalog.repository import CatalogRepository
from app.core.errors import AppError


class OutfitService:
    @staticmethod
    def list_user_outfits(user_id: str) -> List[OutfitResponse]:
        rows = OutfitRepository.get_outfits_by_owner(user_id)
        result = []
        for r in rows:
            snap = r.get("snapshot_json")
            parsed_snap = OutfitSnapshot(**snap) if isinstance(snap, dict) else (OutfitSnapshot(**json.loads(snap)) if isinstance(snap, str) else None)
            result.append(OutfitResponse(
                id=r["id"],
                owner_id=r["owner_id"],
                title=r["title"],
                occasion_id=r["occasion_id"],
                style_mode=r["style_mode"],
                revision=r["revision"],
                current_version_id=r["current_version_id"],
                current_snapshot=parsed_snap,
                preview_image_url=r.get("preview_image_url"),
                created_at=str(r["created_at"]),
                updated_at=str(r["updated_at"]),
            ))
        return result

    @staticmethod
    def create_outfit(user_id: Optional[str], req: CreateOutfitRequest) -> OutfitResponse:
        outfit_id = str(uuid.uuid4())
        version_id = str(uuid.uuid4())

        OutfitRepository.create_outfit(
            outfit_id=outfit_id,
            owner_id=user_id,
            title=req.title,
            occasion_id=req.occasion_id or req.snapshot.occasionId,
            style_mode=req.style_mode or req.snapshot.styleMode,
        )

        normalized = req.snapshot.model_copy(update={"occasionId": req.occasion_id if req.occasion_id is not None else req.snapshot.occasionId, "styleMode": req.style_mode or req.snapshot.styleMode})
        snapshot_str = normalized.model_dump_json()
        OutfitRepository.create_outfit_version(
            version_id=version_id,
            outfit_id=outfit_id,
            version_number=1,
            snapshot_json=snapshot_str,
            preview_image_url=req.preview_image_url,
        )

        OutfitRepository.set_current_version(outfit_id, version_id, new_revision=1)
        return OutfitService.get_outfit(outfit_id)

    @staticmethod
    def get_outfit(outfit_id: str) -> OutfitResponse:
        r = OutfitRepository.get_outfit_by_id(outfit_id)
        if not r:
            raise AppError(code="OUTFIT_NOT_FOUND", message="Không tìm thấy bộ phối yêu cầu", status_code=404)

        snap = r.get("snapshot_json")
        parsed_snap = OutfitSnapshot(**snap) if isinstance(snap, dict) else (OutfitSnapshot(**json.loads(snap)) if isinstance(snap, str) else None)

        return OutfitResponse(
            id=r["id"],
            owner_id=r["owner_id"],
            title=r["title"],
            occasion_id=r["occasion_id"],
            style_mode=r["style_mode"],
            revision=r["revision"],
            current_version_id=r["current_version_id"],
            current_snapshot=parsed_snap,
            preview_image_url=r.get("preview_image_url"),
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"]),
        )

    @staticmethod
    def update_outfit(outfit_id: str, user_id: Optional[str], req: UpdateOutfitRequest) -> OutfitResponse:
        current = OutfitRepository.get_outfit_by_id(outfit_id)
        if not current:
            raise AppError(code="OUTFIT_NOT_FOUND", message="Không tìm thấy bộ phối yêu cầu", status_code=404)

        # Kiểm tra quyền sở hữu nếu đã đăng nhập
        if user_id and current["owner_id"] and current["owner_id"] != user_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền chỉnh sửa bộ phối của người khác", status_code=403)

        # Optimistic concurrency lock: phát hiện xung đột khi mở 2 tab
        if current["revision"] != req.revision:
            raise AppError(
                code="REVISION_CONFLICT",
                message=f"Bộ phối đã được chỉnh sửa ở tab khác (phiên bản hiện tại {current['revision']}, gửi lên {req.revision}). Vui lòng tải lại trước khi lưu.",
                status_code=409,
            )

        occasion_id = req.occasion_id if "occasion_id" in req.model_fields_set else req.snapshot.occasionId
        style_mode = req.style_mode if req.style_mode is not None else req.snapshot.styleMode
        snapshot = req.snapshot.model_copy(update={"occasionId": occasion_id, "styleMode": style_mode})
        saved = OutfitRepository.save_revision(
            outfit_id, req.revision, str(uuid.uuid4()), snapshot.model_dump_json(),
            req.title if req.title is not None else current["title"], occasion_id, style_mode,
            req.preview_image_url,
        )
        if not saved:
            raise AppError(code="REVISION_CONFLICT", message="Bộ phối đã thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.", status_code=409)
        return OutfitService.get_outfit(outfit_id)

    @staticmethod
    def delete_outfit(outfit_id: str, user_id: Optional[str]) -> None:
        current = OutfitRepository.get_outfit_by_id(outfit_id)
        if not current:
            return
        if user_id and current["owner_id"] and current["owner_id"] != user_id:
            raise AppError(code="FORBIDDEN", message="Bạn không có quyền xóa bộ phối này", status_code=403)
        OutfitRepository.soft_delete_outfit(outfit_id)

    @staticmethod
    def compare_snapshots(req: CompareRequest) -> CompareResponse:
        """So sánh 2 snapshot A và B (F08)."""
        snap_a = req.snapshot_a
        snap_b = req.snapshot_b

        slots = ["outerwear", "undergarment", "bottom", "headwear", "accessory_front", "accessory_back", "footwear"]
        items_a = {it.slot: it for it in snap_a.items}
        items_b = {it.slot: it for it in snap_b.items}

        all_item_cache = {i["id"]: i["name"] for i in CatalogRepository.get_items(limit=100)}

        diffs: List[SlotDiff] = []
        change_count = 0

        for s in slots:
            ia = items_a.get(s)
            ib = items_b.get(s)

            item_a_id = ia.itemId if ia else None
            item_b_id = ib.itemId if ib else None
            var_a_hex = ia.colorHex if ia else None
            var_b_hex = ib.colorHex if ib else None

            is_changed = (ia.model_dump() if ia else None) != (ib.model_dump() if ib else None)
            if is_changed:
                change_count += 1

            diffs.append(SlotDiff(
                slot=s,
                item_a_id=item_a_id,
                item_b_id=item_b_id,
                item_a_name=all_item_cache.get(item_a_id) if item_a_id else None,
                item_b_name=all_item_cache.get(item_b_id) if item_b_id else None,
                variant_a_hex=var_a_hex,
                variant_b_hex=var_b_hex,
                is_changed=is_changed,
            ))

        style_changed = snap_a.styleMode != snap_b.styleMode
        occasion_changed = snap_a.occasionId != snap_b.occasionId

        summary = f"Phương án B có {change_count} điểm khác biệt so với Phương án A."
        if style_changed:
            summary += f" Phong cách đổi từ {snap_a.styleMode} sang {snap_b.styleMode}."

        return CompareResponse(
            diffs=diffs,
            style_changed=style_changed,
            occasion_changed=occasion_changed,
            summary_message=summary,
        )
