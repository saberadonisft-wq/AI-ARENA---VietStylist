"""Database-backed fixed windows shared by workers using the same runtime database."""

import hashlib
import time
from fastapi import Request, Depends
from app.core.database import db_transaction
from app.core.errors import AppError
from app.core.security import get_current_user_optional


def consume(scope, identity, limit, seconds):
    now = int(time.time())
    key = hashlib.sha256(f"{scope}:{identity}".encode()).hexdigest()
    denied = False
    with db_transaction() as conn:
        conn.execute("DELETE FROM rate_limits WHERE resets_at<=?", (now,))
        row = conn.execute(
            "INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET count=rate_limits.count+1 "
            "WHERE rate_limits.count < ? RETURNING count,resets_at",
            (key, now + seconds, limit),
        ).fetchone()
        if row is None:
            denied = True
            existing = conn.execute("SELECT resets_at FROM rate_limits WHERE key_hash=?", (key,)).fetchone()
            retry_after = max(1, existing["resets_at"] - now)
    if denied:
        raise AppError(
            "RATE_LIMIT_EXCEEDED",
            "Quá nhiều yêu cầu; vui lòng thử lại sau",
            429,
            {"retry_after": retry_after},
        )


def auth_rate_limit(request: Request):
    consume(
        "auth:" + request.url.path,
        request.client.host if request.client else "unknown",
        20,
        60,
    )


def ai_rate_limit(request: Request, user=Depends(get_current_user_optional)):
    identity = (
        user.user_id if user else (request.client.host if request.client else "unknown")
    )
    consume("ai-minute", identity, 10, 60)
    consume("ai-day", identity, 100, 86400)
