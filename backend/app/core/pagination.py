"""Bounded, owner/resource-scoped cursors for saved outfit pages."""
import base64
import binascii
import json
from datetime import datetime

from app.core.errors import AppError


def encode_cursor(scope: str, value: str | int, identifier: str) -> str:
    payload = json.dumps([scope, value, identifier], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def decode_cursor(cursor: str | None, scope: str, *, numeric: bool = False):
    if cursor is None:
        return None
    try:
        if not cursor or len(cursor) > 2048:
            raise ValueError("Invalid length")
        payload = json.loads(base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True))
        if not isinstance(payload, list) or len(payload) != 3:
            raise ValueError("Invalid cursor")
        saved_scope, value, identifier = payload
        if saved_scope != scope or not isinstance(identifier, str) or not identifier:
            raise ValueError("Invalid scope")
        if numeric:
            if type(value) is not int or value < 1:
                raise ValueError("Invalid version")
        else:
            if not isinstance(value, str):
                raise ValueError("Invalid timestamp")
            datetime.fromisoformat(value)
        return value, identifier
    except (ValueError, TypeError, binascii.Error, UnicodeDecodeError):
        raise AppError("INVALID_CURSOR", "Trang dữ liệu không hợp lệ. Hãy tải lại danh sách.", 422) from None
