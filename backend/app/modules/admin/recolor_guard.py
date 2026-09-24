"""Keep normal catalog CRUD from bypassing photographic recolor review."""

from typing import Any

from app.core.errors import AppError

APPROVAL_KEY = "studio_recolor_approved"
SOURCE_KEYS = ("catalog_media_id", "catalog_image_version")


def normalize_metadata(value: Any) -> dict:
    if isinstance(value, dict):
        return dict(value)
    return {}


def validate_new_item_metadata(metadata: dict) -> dict:
    normalized = normalize_metadata(metadata)
    if normalized.get(APPROVAL_KEY) is True:
        raise AppError(
            "STUDIO_RECOLOR_APPROVAL_REQUIRES_REVIEW",
            "Không thể bật đổi màu ảnh khi tạo trang phục. Ảnh cần hoàn tất đánh giá chất lượng độc lập trước.",
            409,
        )
    return normalized


def validate_item_metadata_update(current_value: Any, requested_value: Any) -> dict:
    current = normalize_metadata(current_value)
    requested = normalize_metadata(requested_value)
    if requested.get(APPROVAL_KEY) is True:
        has_same_reviewed_source = all(
            isinstance(current.get(key), str)
            and bool(current[key])
            and requested.get(key) == current[key]
            for key in SOURCE_KEYS
        )
        if current.get(APPROVAL_KEY) is not True or not has_same_reviewed_source:
            raise AppError(
                "STUDIO_RECOLOR_APPROVAL_REQUIRES_REVIEW",
                "Không thể bật đổi màu ảnh từ biểu mẫu quản lý. Hãy duyệt lại ảnh và phiên bản nguồn qua quy trình đánh giá chất lượng.",
                409,
            )
    return requested
