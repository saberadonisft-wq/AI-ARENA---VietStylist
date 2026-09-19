from app.services.generation import ProviderRequest, ProviderResult

class MockGenerationProvider:
    async def generate(self, request: ProviderRequest) -> ProviderResult:
        return ProviderResult(
            status="completed",
            model_id="mock-provider-v1",
            result_media_id="media_mock_generated_001",
            metadata={"idempotency_key": request.idempotency_key},
        )
