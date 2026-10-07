import json
import hashlib
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
from app.core.database import is_unique_violation
from app.core.pagination import decode_cursor, encode_cursor


class OutfitService:
    @staticmethod
    def _page_outfit_response(row):
        snapshot = row.get('snapshot_json')
        if isinstance(snapshot, str):
            snapshot = json.loads(snapshot)
        return OutfitResponse.model_validate({**row, 'current_snapshot': snapshot,
                                               'created_at': str(row['created_at']), 'updated_at': str(row['updated_at'])})

    @staticmethod
    def list_user_outfit_page(user_id: str, limit: int = 30, cursor: str | None = None):
        scope = 'outfits:' + user_id
        rows = OutfitRepository.get_outfits_by_owner(user_id, limit + 1, decode_cursor(cursor, scope))
        selected = rows[:limit]
        return {
            'items': [OutfitService._page_outfit_response(row) for row in selected],
            'next_cursor': encode_cursor(scope, str(selected[-1]['updated_at']), selected[-1]['id']) if len(rows) > limit else None,
        }

    @staticmethod
    def list_outfit_version_page(outfit_id: str, user_id: str, limit: int = 30, cursor: str | None = None):
        if not OutfitRepository.get_outfit_by_id_and_owner(outfit_id, user_id):
            raise AppError('OUTFIT_NOT_FOUND', 'Không tìm thấy bộ phối yêu cầu', 404)
        scope = 'versions:' + user_id + ':' + outfit_id
        rows = OutfitRepository.get_outfit_versions(outfit_id, limit + 1, decode_cursor(cursor, scope, numeric=True))
        selected = rows[:limit]
        items = [OutfitVersionResponse(id=row['id'], outfit_id=row['outfit_id'], version_number=row['version_number'],
                    snapshot=OutfitSnapshot.model_validate(row['snapshot_json'] if isinstance(row['snapshot_json'], dict) else json.loads(row['snapshot_json'])),
                    preview_image_url=row.get('preview_image_url'), created_at=str(row['created_at'])) for row in selected]
        return {'items': items, 'next_cursor': encode_cursor(scope, selected[-1]['version_number'], selected[-1]['id']) if len(rows) > limit else None}

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
    def create_outfit(user_id: str, req: CreateOutfitRequest, idempotency_key: Optional[str] = None) -> OutfitResponse:
        version_id = str(uuid.uuid4())

        occasion_id = req.occasion_id or req.snapshot.occasionId
        style_mode = req.style_mode or req.snapshot.styleMode

        normalized = req.snapshot.model_copy(update={"occasionId": occasion_id, "styleMode": style_mode})
        snapshot_str = normalized.model_dump_json()

        if idempotency_key:
            canonical_request = json.dumps(
                {"title": req.title, "occasion_id": occasion_id, "style_mode": style_mode,
                 "snapshot": normalized.model_dump(mode="json"), "preview_image_url": req.preview_image_url},
                sort_keys=True, separators=(",", ":"), ensure_ascii=False,
            )
            request_hash = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
            scoped_key = "outfit-create:" + hashlib.sha256(f"{user_id}\0{idempotency_key}".encode()).hexdigest()
            job_id = str(uuid.uuid5(uuid.NAMESPACE_URL, scoped_key))
            outfit_id = str(uuid.uuid5(uuid.NAMESPACE_URL, scoped_key + ":outfit"))
            OutfitRepository.reserve_create_receipt(job_id, user_id, scoped_key, request_hash, canonical_request)
            receipt = OutfitRepository.get_create_receipt(scoped_key)
            if not receipt or receipt["owner_id"] != user_id:
                raise AppError("SAVE_RETRY_UNAVAILABLE", "Chưa xác nhận được trạng thái lưu. Hãy thử lại.", 503)
            if receipt["input_hash"] != request_hash:
                raise AppError("IDEMPOTENCY_CONFLICT", "Mã lưu đã được dùng cho bản phối khác. Hãy lưu lại để tạo một mã mới.", 409)

            recovered = OutfitService._recover_create(outfit_id, user_id, scoped_key)
            if recovered:
                return recovered
        else:
            outfit_id = str(uuid.uuid4())

        try:
            OutfitRepository.create_outfit_atomic(
                outfit_id=outfit_id,
                owner_id=user_id,
                title=req.title,
                occasion_id=occasion_id,
                style_mode=style_mode,
                version_id=version_id,
                snapshot_json=snapshot_str,
                preview_image_url=req.preview_image_url,
            )
        except Exception as exc:
            # A concurrent retry can win the deterministic outfit ID after the
            # receipt was reserved. Reuse its saved result; surface other errors.
            if not idempotency_key or not is_unique_violation(exc):
                raise
            recovered = OutfitService._recover_create(outfit_id, user_id, scoped_key)
            if recovered:
                return recovered
            raise

        if idempotency_key:
            recovered = OutfitService._recover_create(outfit_id, user_id, scoped_key)
            if recovered:
                return recovered

        return OutfitService.get_outfit(outfit_id, user_id)

    @staticmethod
    def _recover_create(outfit_id: str, user_id: str, scoped_key: str) -> Optional[OutfitResponse]:
        # Replaying a create must never grant a newer revision to a stale draft.
        # Read the snapshot and revision together, including deletion tombstones.
        row = OutfitRepository.get_outfit_by_id_and_owner(outfit_id, user_id, include_deleted=True)
        if not row:
            return None
        details = {"outfit_id": outfit_id, "revision": 1}
        if row["is_deleted"]:
            raise AppError("OUTFIT_DELETED", "Bộ phối đã được xóa. Bản nháp vẫn có thể được lưu thành bản mới.", 409, details)
        if row["revision"] != 1:
            raise AppError("REVISION_CONFLICT", "Bộ phối đã thay đổi sau lần lưu đầu tiên. Hãy xem bản máy chủ hoặc lưu thành bản mới.", 409, details)
        OutfitRepository.finish_create_receipt(scoped_key, outfit_id)
        return OutfitService._outfit_response(row)

    @staticmethod
    def get_outfit(outfit_id: str, user_id: str) -> OutfitResponse:
        r = OutfitRepository.get_outfit_by_id_and_owner(outfit_id, user_id)
        if not r:
            raise AppError(code="OUTFIT_NOT_FOUND", message="Không tìm thấy bộ phối yêu cầu", status_code=404)

        return OutfitService._outfit_response(r)

    @staticmethod
    def get_outfit_version(version_id: str, user_id: str) -> OutfitVersionResponse:
        row = OutfitRepository.get_version_by_id_and_owner(version_id, user_id)
        if not row:
            raise AppError("OUTFIT_VERSION_NOT_FOUND", "Không tìm thấy phiên bản bộ phối yêu cầu", 404)
        snapshot = row["snapshot_json"]
        if isinstance(snapshot, str):
            snapshot = json.loads(snapshot)
        return OutfitVersionResponse(
            id=row["id"],
            outfit_id=row["outfit_id"],
            version_number=row["version_number"],
            snapshot=OutfitSnapshot.model_validate(snapshot),
            preview_image_url=row.get("preview_image_url"),
            created_at=str(row["created_at"]),
        )

    @staticmethod
    def _outfit_response(r: Dict[str, Any]) -> OutfitResponse:
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
    def update_outfit(outfit_id: str, user_id: str, req: UpdateOutfitRequest) -> OutfitResponse:
        current = OutfitRepository.get_outfit_by_id_and_owner(outfit_id, user_id)
        if not current:
            raise AppError(code="OUTFIT_NOT_FOUND", message="Không tìm thấy bộ phối yêu cầu", status_code=404)

        # Optimistic concurrency lock
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
            outfit_id=outfit_id,
            owner_id=user_id,
            expected_revision=req.revision,
            version_id=str(uuid.uuid4()),
            snapshot_json=snapshot.model_dump_json(),
            title=req.title if req.title is not None else current["title"],
            occasion_id=occasion_id,
            style_mode=style_mode,
            preview_image_url=req.preview_image_url,
        )
        if not saved:
            raise AppError(code="REVISION_CONFLICT", message="Bộ phối đã thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.", status_code=409)

        return OutfitService.get_outfit(outfit_id, user_id)

    @staticmethod
    def delete_outfit(outfit_id: str, user_id: str) -> None:
        count = OutfitRepository.soft_delete_outfit(outfit_id, user_id)
        if count == 0:
            raise AppError(code="OUTFIT_NOT_FOUND", message="Không tìm thấy bộ phối yêu cầu", status_code=404)

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

            item_a_name = all_item_cache.get(item_a_id, item_a_id) if item_a_id else None
            item_b_name = all_item_cache.get(item_b_id, item_b_id) if item_b_id else None

            changed = (item_a_id != item_b_id) or (ia.variantId != ib.variantId if ia and ib else False) or (ia.colorHex != ib.colorHex if ia and ib else False)
            if changed:
                change_count += 1

            diffs.append(SlotDiff(
                slot=s,
                item_a_id=item_a_id,
                item_a_name=item_a_name,
                item_b_id=item_b_id,
                item_b_name=item_b_name,
                variant_a_hex=ia.colorHex if ia else None,
                variant_b_hex=ib.colorHex if ib else None,
                is_changed=changed,
            ))

        return CompareResponse(
            diffs=diffs,
            style_changed=(snap_a.styleMode != snap_b.styleMode),
            occasion_changed=(snap_a.occasionId != snap_b.occasionId),
            summary_message=f"Có {change_count} vị trí khác biệt giữa hai bản phối.",
        )
