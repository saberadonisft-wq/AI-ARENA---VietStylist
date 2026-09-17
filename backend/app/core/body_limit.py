"""Bound local multipart input before the parser can spool an unbounded body."""

import uuid
from starlette.formparsers import MultiPartException
from app.core.config import settings
from app.core.errors import create_error_response


class LocalUploadBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or not scope["path"].startswith("/api/media/local-upload/")
            or not settings.is_local_media_enabled()
        ):
            return await self.app(scope, receive, send)
        limit = (
            settings.MEDIA_VIDEO_MAX_BYTES + 64 * 1024
        )  # bounded multipart framing allowance
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = 0

        async def reject():
            request_id = scope.get("state", {}).get(
                "request_id", f"req_{uuid.uuid4().hex[:12]}"
            )
            response = create_error_response(
                "PAYLOAD_TOO_LARGE",
                "Request upload vượt giới hạn dung lượng",
                413,
                request_id,
            )
            await response(scope, receive, send)

        if declared > limit:
            return await reject()
        size = 0
        exceeded = False
        rejected = False

        async def bounded_receive():
            nonlocal size, exceeded
            message = await receive()
            size += len(message.get("body", b""))
            if size > limit:
                exceeded = True
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
