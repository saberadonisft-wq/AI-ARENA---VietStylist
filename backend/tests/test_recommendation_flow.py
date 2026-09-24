import json

import httpx
import pytest

from app.core.database import Database
from app.core.http_client import close_shared_async_client, get_shared_async_client
from app.infrastructure.gemini.client import gemini_client
from app.modules.catalog.repository import CatalogRepository
from app.modules.recommendations.schemas import AIRecommendationRequest
from app.modules.recommendations.service import RecommendationService


@pytest.mark.asyncio
async def test_unspecified_gender_keeps_male_catalog_and_supplies_variants(monkeypatch):
    Database.execute("UPDATE items SET gender = 'male'")
    captured = {}

    async def provider(**kwargs):
        captured.update(kwargs)
        item = kwargs["available_items"][0]
        return {"source": "gemini", "model": "test", "recommendations": [{
            "title": "Test", "items": [{"item_id": item["id"]}],
        }]}

    monkeypatch.setattr(gemini_client, "get_styling_recommendations", provider)
    result = await RecommendationService.get_ai_recommendations(AIRecommendationRequest(prompt="Cổ phục nam"))
    assert captured["available_items"]
    assert all(i["gender"] == "male" for i in captured["available_items"])
    assert any(i["variants"] for i in captured["available_items"])
    assert result.source == "gemini" and result.outfits


@pytest.mark.asyncio
async def test_empty_catalog_does_not_call_provider(monkeypatch):
    Database.execute("UPDATE items SET is_published = 0")

    async def unexpected(**kwargs):
        pytest.fail("Empty catalogs must not spend provider quota")

    monkeypatch.setattr(gemini_client, "get_styling_recommendations", unexpected)
    result = await RecommendationService.get_ai_recommendations(AIRecommendationRequest(prompt="Cổ phục"))
    assert result.outfits == []
    assert "Chưa có trang phục" in result.notice


@pytest.mark.asyncio
async def test_provider_receives_schema_and_reads_non_thought_parts(monkeypatch):
    monkeypatch.setattr(gemini_client, "is_configured", True)
    items = CatalogRepository.get_items()
    answer = json.dumps({"outfits": [{"title": "Test", "items": [{"item_id": items[0]["id"]}]}]})

    async def response(*args, **kwargs):
        schema = kwargs["json"]["generationConfig"]["responseJsonSchema"]
        assert "outfits" in schema["required"]
        assert schema["properties"]["outfits"]["maxItems"] == 2
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [
            {"thought": True, "text": "private reasoning"},
            {"text": answer[:20]}, {"text": answer[20:]},
        ]}}]})

    monkeypatch.setattr(get_shared_async_client(25.0), "post", response)
    try:
        result = await gemini_client.get_styling_recommendations("test", None, items)
        assert result["source"] == "gemini"
        assert result["recommendations"][0]["items"][0]["item_id"] == items[0]["id"]
    finally:
        await close_shared_async_client()


@pytest.mark.asyncio
@pytest.mark.parametrize("status, message", [(404, "không khả dụng"), (429, "hạn mức"), (503, "tạm thời")])
async def test_provider_failure_keeps_honest_fallback_notice(monkeypatch, status, message):
    monkeypatch.setattr(gemini_client, "is_configured", True)

    async def response(*args, **kwargs):
        return httpx.Response(status, json={"error": {"message": "do not expose provider details"}})

    monkeypatch.setattr(get_shared_async_client(25.0), "post", response)
    try:
        result = await RecommendationService.get_ai_recommendations(AIRecommendationRequest(prompt="Cổ phục"))
        assert result.source == "cultural_rule_engine"
        assert result.outfits
        assert message in result.notice
        assert "do not expose" not in result.notice
        assert "chưa được thẩm định" in result.outfits[0].explanation
    finally:
        await close_shared_async_client()


def test_unknown_provider_item_keeps_specific_fallback_notice():
    result = RecommendationService._format_recommendation_result({
        "source": "gemini", "recommendations": [{"items": [{"item_id": "invented"}]}],
    }, CatalogRepository.get_items(), [])
    assert result.source == "cultural_rule_engine"
    assert "không có trong danh mục" in result.notice
