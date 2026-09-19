"""Unavailable until the image/media pipeline and provider acceptance are implemented.

Text advice is not an image result. Never substitute test media IDs in this adapter.
"""
from app.core.errors import AppError
from app.modules.cultural_data_v3.services.generation import ProviderRequest, ProviderResult


class GeminiGenerationProvider:
    async def generate(self, request: ProviderRequest) -> ProviderResult:
        raise AppError("GENERATION_UNAVAILABLE", "Provider ảnh chưa được nghiệm thu.", 503)
