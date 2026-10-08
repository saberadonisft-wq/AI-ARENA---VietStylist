"""Authorize stylist uploads and bound multipart input before parsing/spooling."""

import uuid
from starlette.formparsers import MultiPartException
from starlette.concurrency import run_in_threadpool
from app.core.config import settings
from app.core.errors import AppError, create_error_response
from app.core.security import get_current_user_optional


class LocalUploadBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        stylist_upload = scope["path"].rstrip("/") == "/api/stylist/garment-image"
        session_upload = scope["path"].rstrip("/") == "/api/media/session-cutout"
        local_upload = scope["path"].startswith("/api/media/local-upload/") and settings.is_local_media_enabled()
        if not (stylist_upload or session_upload or local_upload):
            return await self.app(scope, receive, send)
        limit = settings.MEDIA_IMAGE_MAX_BYTES if session_upload else (settings.MEDIA_IMAGE_MAX_BYTES if stylist_upload else settings.MEDIA_VIDEO_MAX_BYTES) + 64 * 1024
        headers = dict(scope.get("headers", []))

        async def respond(error):
            request_id = scope.get("state", {}).get("request_id", f"req_{uuid.uuid4().hex[:12]}")
            response = create_error_response(error.code, error.message, error.status_code, request_id, error.details)
            response.headers["X-Request-ID"] = request_id
            await response(scope, receive, send)

        if stylist_upload or session_upload:
            # FastAPI parses UploadFile before resolving route dependencies.
            # Check the live account/roles here without consuming the body.
            try:
                user = await run_in_threadpool(
                    get_current_user_optional, credentials=None,
                    authorization=headers.get(b"authorization", b"").decode("latin-1") or None,
                )
                if user is None:
                    raise AppError("UNAUTHORIZED", "Yêu cầu đăng nhập để upload.", 401)
                if stylist_upload and not user.is_stylist:
                    raise AppError("FORBIDDEN", "Chỉ stylist hoặc admin được upload trang phục.", 403)
            except AppError as exc:
                return await respond(exc)
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 0

        async def reject():
            await respond(AppError(
                "PAYLOAD_TOO_LARGE",
                "Request upload vượt giới hạn dung lượng",
                413,
            ))

        if declared > limit:
            return await reject()
        size = 0
        exceeded = False
        rejected = False

        async def bounded_receive():
            nonlocal size, exceeded
            if session_upload and exceeded:
                return {"type": "http.disconnect"}
            message = await receive()
            size += len(message.get("body", b""))
            if size > limit:
                exceeded = True
                if session_upload:
                    # Raw bodies have no multipart parser to close. End the
                    # stream and let the endpoint reject before inference;
                    # raising here also reaches BaseHTTPMiddleware's listener.
                    scope.setdefault("state", {})["session_upload_exceeded"] = True
                    return {"type": "http.request", "body": b"", "more_body": False}
                # Starlette closes all spooled files on this parser error.
                raise MultiPartException("Upload body limit exceeded")
            return message

        async def bounded_send(message):
            nonlocal rejected
            if exceeded:
                if not rejected:
                    rejected = True
                    await reject()
                return
            await send(message)

        await self.app(scope, bounded_receive, bounded_send)
