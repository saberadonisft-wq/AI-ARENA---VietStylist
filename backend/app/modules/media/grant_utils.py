import hmac
import hashlib
import time
import json
import base64
from typing import Optional
from app.core.config import settings


def create_media_grant(
    media_id: str, purpose: str = "read", expires_in: int = 300
) -> str:
    """
    Tạo signed grant token ngắn hạn cho media access hoặc upload (R05).
    - media_id: định danh tài nguyên media
    - purpose: 'read' hoặc 'upload'
    - expires_in: thời gian sống tính bằng giây (mặc định 300s = 5 phút)
    """
    payload = {
        "mid": media_id,
        "pur": purpose,
        "exp": int(time.time()) + expires_in,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")

    secret = settings.get_jwt_secret().encode("utf-8")
    sig = hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")

    return f"{payload_b64}.{sig_b64}"


def verify_media_grant(
    grant_token: Optional[str], expected_media_id: str, expected_purpose: str = "read"
) -> bool:
    """
    Xác minh signed grant token (R05).
    Kiểm tra tính hợp lệ của chữ ký, hạn sử dụng, purpose và media_id.
    """
    if not grant_token or len(grant_token) > 4096 or "." not in grant_token:
        return False
    parts = grant_token.split(".")
    if len(parts) != 2:
        return False
    payload_b64, sig_b64 = parts

    secret = settings.get_jwt_secret().encode("utf-8")
    expected_sig = hmac.new(
        secret, payload_b64.encode("utf-8"), hashlib.sha256
    ).digest()
    expected_sig_b64 = (
        base64.urlsafe_b64encode(expected_sig).decode("utf-8").rstrip("=")
    )
    if not hmac.compare_digest(sig_b64, expected_sig_b64):
        return False

    try:
        pad_len = 4 - (len(payload_b64) % 4)
        if pad_len != 4:
            payload_b64 += "=" * pad_len
        payload = json.loads(
            base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        )
    except Exception:
        return False

    if not isinstance(payload, dict):
        return False
    if payload.get("mid") != expected_media_id:
        return False
    if payload.get("pur") != expected_purpose:
        return False
    if not isinstance(payload.get("exp"), int) or payload["exp"] <= int(time.time()):
        return False

    return True
