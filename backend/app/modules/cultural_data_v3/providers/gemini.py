"""Gemini image generation adapter with strict media validation and storage."""

from __future__ import annotations

import base64
import binascii
import re

import anyio
import httpx

from app.core.config import settings
from app.core.errors import AppError
from app.core.http_client import get_shared_async_client
from app.modules.cultural_data_v3.services.generation import ProviderRequest, ProviderResult
from app.modules.media.service import MediaService


_provider_slots = anyio.CapacityLimiter(2)
_MODEL_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class GeminiGenerationProvider:
    def __init__(self, owner_id: str, model_id: str | None = None):
        self.owner_id = owner_id
        self.model_id = model_id or settings.GEMINI_MODEL_IMAGE

    async def generate(self, request: ProviderRequest) -> ProviderResult:
        if not settings.GEMINI_TRY_ON_ENABLED or not settings.GEMINI_API_KEY:
            raise AppError(
                "GENERATION_UNAVAILABLE",
                "Dịch vụ sinh ảnh chưa được cấu hình.",
                503,
            )
        if not _MODEL_NAME.fullmatch(self.model_id):
            raise AppError(
                "GENERATION_CONFIGURATION_INVALID",
                "Tên model sinh ảnh không hợp lệ.",
                503,
            )

        parts = [{"text": self._combined_prompt(request)}]
        if request.user_image_id:
            image_bytes, mime_type = await anyio.to_thread.run_sync(
                MediaService.read_owned_image, request.user_image_id, self.owner_id
            )
            parts.append(
                {
                    "inlineData": {
                        "mimeType": mime_type,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["Image"]},
        }
        url = (
            "https://generativelanguage.googleapis.com/v1/models/"
            f"{self.model_id}:generateContent"
        )

        try:
            _provider_slots.acquire_nowait()
        except anyio.WouldBlock as exc:
            raise AppError(
                "GENERATION_BUSY", "Dịch vụ sinh ảnh đang bận, vui lòng thử lại.", 429
            ) from exc

        try:
            client = get_shared_async_client(timeout=55.0)
            with anyio.fail_after(60):
                response = await client.post(
                    url,
                    headers={
                        "Content-Type": "application/json",
                        "X-goog-api-key": settings.GEMINI_API_KEY,
                    },
                    json=payload,
                )
            if response.status_code == 429:
                raise AppError(
                    "GENERATION_RATE_LIMITED",
                    "Gemini đang giới hạn lượt gọi, vui lòng thử lại sau.",
                    429,
                )
            if response.status_code != 200:
                raise AppError(
                    "GENERATION_PROVIDER_ERROR",
                    "Gemini không thể sinh ảnh ở thời điểm này.",
                    502,
                )
            image_bytes, mime_type = self._extract_image(response.json())
            try:
                stored = await anyio.to_thread.run_sync(
                    MediaService.ingest_generated_image,
                    self.owner_id,
                    image_bytes,
                    mime_type,
                )
            except AppError as exc:
                if exc.code in {
                    "INVALID_MEDIA_CONTENT",
                    "PAYLOAD_TOO_LARGE",
                    "GENERATION_INVALID_MEDIA",
                }:
                    raise AppError(
                        "GENERATION_INVALID_RESULT",
                        "Gemini trả về dữ liệu ảnh không hợp lệ.",
                        502,
                    ) from exc
                raise
            return ProviderResult(
                status="completed",
                model_id=self.model_id,
                result_media_id=stored.id,
                prompt_used=request.prompt,
                metadata={
                    "provider": "gemini",
                    "mime_type": mime_type,
                    "idempotency_key": request.idempotency_key,
                },
            )
        except AppError:
            raise
        except (httpx.HTTPError, TimeoutError) as exc:
            raise AppError(
                "GENERATION_PROVIDER_UNAVAILABLE",
                "Không thể kết nối dịch vụ sinh ảnh.",
                503,
            ) from exc
        except (ValueError, TypeError) as exc:
            raise AppError(
                "GENERATION_INVALID_RESULT",
                "Gemini trả về dữ liệu ảnh không hợp lệ.",
                502,
            ) from exc
        finally:
            _provider_slots.release()

    @staticmethod
    def _combined_prompt(request: ProviderRequest) -> str:
        prompt = request.prompt.strip()
        if request.negative_prompt:
            prompt += (
                "\n\nDo not introduce any of these traits: "
                + request.negative_prompt.strip()
                + "."
            )
        if request.user_image_id:
            prompt += (
                "\n\nEdit the supplied person photo. Preserve the person's identity, pose, "
                "body proportions, and background unless the clothing requires a natural occlusion."
            )
        return prompt

    @staticmethod
    def _extract_image(payload):
        for candidate in payload.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                inline = part.get("inlineData") or part.get("inline_data")
                if not isinstance(inline, dict):
                    continue
                mime_type = inline.get("mimeType") or inline.get("mime_type")
                encoded = inline.get("data")
                if mime_type not in _SUPPORTED_IMAGE_TYPES or not isinstance(encoded, str):
                    continue
                if len(encoded) > ((settings.MEDIA_IMAGE_MAX_BYTES + 2) // 3) * 4 + 16:
                    raise AppError(
                        "GENERATION_RESULT_TOO_LARGE",
                        "Ảnh Gemini trả về vượt giới hạn dung lượng.",
                        502,
                    )
                try:
                    decoded = base64.b64decode(encoded, validate=True)
                except (binascii.Error, ValueError) as exc:
                    raise AppError(
                        "GENERATION_INVALID_RESULT",
                        "Gemini trả về dữ liệu ảnh không hợp lệ.",
                        502,
                    ) from exc
                if not decoded:
                    break
                return decoded, mime_type
        raise AppError(
            "GENERATION_INVALID_RESULT",
            "Gemini không trả về ảnh.",
            502,
        )
