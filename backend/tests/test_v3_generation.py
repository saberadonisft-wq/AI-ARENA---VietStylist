"""Integration and unit tests for V3 AI Generation Pipeline."""
import base64
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Database
from app.core.errors import AppError
from conftest import auth_header
from app.modules.cultural_data_v3.domain.models import OutfitSpecV2, OutfitSelection
from app.modules.cultural_data_v3.services.generation import (
    GroundingBuilder,
    PromptBuilder,
    ReferenceSelector,
    PostValidationService,
    ProviderRequest,
    ProviderResult,
    validate_provider_result,
)
from app.modules.cultural_data_v3.providers.mock import MockGenerationProvider
from scripts.seed_v3_pilot_data import seed_pilot_data

client = TestClient(app)


def ready_private_image(media_id, owner_id="dev-user-test-1"):
    from app.core.config import settings
    from app.modules.media.repository import MediaRepository

    bucket = settings.R2_BUCKET_PRIVATE
    object_key = f"assets/{media_id}/image.png"
    MediaRepository.create_pending_media(
        media_id, bucket, object_key, "image", "image/png", owner_id,
        "private", 4, bucket, f"staging/{media_id}/image.png", 9999999999,
    )
    Database.execute("UPDATE media_assets SET status='ready' WHERE id=?", (media_id,))


@pytest.fixture(autouse=True)
def setup_db():
    seed_pilot_data()
    # Editorial publication is simulated in the isolated test DB, never in real seed.
    Database.execute("UPDATE entity_registry SET status='published'")
    Database.execute("UPDATE cultural_assertions_v3 SET review_status='published'")
    Database.execute("UPDATE cultural_sources_v3 SET review_status='published'")


def test_reference_selector_filters_unlicensed():
    """Verify ReferenceSelector only approves media with scholarly/public rights."""
    media_records = [
        {"id": "med_1", "review_status": "published", "rights": {"ai_reference_allowed": True}},
        {"id": "med_2", "rights": {"license": "Commercial Unlicensed"}},
        {"id": "med_3", "rights": {"public_excerpt": True}},
        {"id": "med_4", "rights": {}},
    ]
    approved = ReferenceSelector.filter_references(media_records)
    assert "med_1" in approved
    assert "med_3" not in approved
    assert "med_2" not in approved
    assert "med_4" not in approved


def test_prompt_builder_synthesizes_strict_invariants():
    """Verify PromptBuilder enforces Hữu nhậm and standing collar in synthesized prompt."""
    grounding = {
        "outfit": {"style_mode": "traditional"},
        "must_preserve": [
            {"feature": "construction.closure.direction", "value": "right_over_left"},
            {"feature": "construction.body_panels", "value": 5},
            {"feature": "construction.collar.type", "value": "standing"},
        ],
        "may_vary": ["visual.fabric.color"],
        "forbidden": ["left_over_right_closure"],
        "grounding_hash": "testhash123",
    }
    prompts = PromptBuilder.build(grounding)

    pos = prompts["positive_prompt"]
    neg = prompts["negative_prompt"]

    assert "Hữu nhậm" in pos
    assert "five-panel" in pos or "ngũ thân" in pos
    assert "standing collar" in pos
    assert "left_over_right_closure" in neg

    without_person = PromptBuilder.build_try_on(grounding, has_person_image=False)
    with_person = PromptBuilder.build_try_on(grounding, has_person_image=True)
    assert "Image 1 is the outfit board" in without_person
    assert "Choose one adult wearer" in without_person
    assert "Image 2 is the person" in with_person
    assert "Preserve this person's identity" in with_person


def test_completed_job_does_not_imply_cultural_compliance():
    """A provider success flag must never be presented as cultural review."""
    grounding = {
        "must_preserve": [{"feature": "f1", "value": "v1"}],
        "grounding_hash": "hash123",
    }
    result = ProviderResult(
        status="completed",
        model_id="gemini-2.5-flash",
        result_media_id="media_test",
    )
    pv = PostValidationService.validate_generation(grounding, result)
    assert pv["is_compliant"] is None
    assert pv["invariants_checked"] == 0
    assert pv["review_status"] == "not_evaluated"


@pytest.mark.parametrize(
    ("result", "media", "probe", "error_code"),
    [
        (
            ProviderResult(status="failed", model_id="provider", result_media_id="media_1"),
            {"status": "ready", "media_type": "image", "mime_type": "image/png"},
            lambda _media: True,
            "GENERATION_FAILED",
        ),
        (
            ProviderResult(status="completed", model_id="provider"),
            {"status": "ready", "media_type": "image", "mime_type": "image/png"},
            lambda _media: True,
            "GENERATION_INVALID_RESULT",
        ),
        (
            ProviderResult(status="completed", model_id="provider", result_media_id="media_1"),
            {"status": "pending", "media_type": "image", "mime_type": "image/png"},
            lambda _media: True,
            "GENERATION_MEDIA_NOT_READY",
        ),
        (
            ProviderResult(status="completed", model_id="provider", result_media_id="media_1"),
            {"status": "ready", "media_type": "video", "mime_type": "video/mp4"},
            lambda _media: True,
            "GENERATION_MEDIA_NOT_READY",
        ),
        (
            ProviderResult(status="completed", model_id="provider", result_media_id="media_1"),
            {"status": "ready", "media_type": "image", "mime_type": "text/html"},
            lambda _media: True,
            "GENERATION_INVALID_MEDIA",
        ),
        (
            ProviderResult(status="completed", model_id="provider", result_media_id="media_1"),
            {"status": "ready", "media_type": "image", "mime_type": "image/png"},
            lambda _media: False,
            "GENERATION_MEDIA_INVALID",
        ),
    ],
)
def test_provider_result_validation_rejects_untrusted_success(
    result, media, probe, error_code
):
    with pytest.raises(AppError) as error:
        validate_provider_result(
            result,
            media_lookup=lambda _media_id: media,
            media_probe=probe,
        )
    assert error.value.code == error_code
    assert error.value.status_code == 502


def test_provider_result_validation_requires_decoder_and_returns_ready_image():
    result = ProviderResult(
        status="completed", model_id="provider", result_media_id="media_1"
    )
    media = {"status": "ready", "media_type": "image", "mime_type": "image/png"}

    with pytest.raises(AppError) as error:
        validate_provider_result(
            result, media_lookup=lambda _media_id: media, media_probe=None
        )
    assert error.value.code == "GENERATION_MEDIA_INVALID"

    assert (
        validate_provider_result(
            result,
            media_lookup=lambda _media_id: media,
            media_probe=lambda candidate: candidate is media,
        )
        is media
    )


def test_api_generation_grounding_endpoint():
    """Verify POST /api/v3/generation/grounding generates hash and constraints."""
    response = client.post("/api/v3/generation/grounding", json={
        "schema_version": "2.0",
        "dataset_version": "dev",
        "context": {"period_ids": ["period_nguyen"]},
        "selections": [
            {
                "selection_id": "sel_1",
                "slot": "outerwear",
                "canonical_entity_id": "garment_ngu_than",
            }
        ],
    })
    assert response.status_code == 200
    data = response.json()["grounding"]
    assert "grounding_hash" in data
    assert any(mp["feature"] == "construction.closure.direction" for mp in data["must_preserve"])


def test_api_generation_prompt_endpoint():
    """Verify POST /api/v3/generation/prompt returns positive and negative prompts."""
    response = client.post("/api/v3/generation/prompt", json={
        "schema_version": "2.0",
        "dataset_version": "dev",
        "context": {"period_ids": ["period_nguyen"]},
        "selections": [
            {
                "selection_id": "sel_1",
                "slot": "outerwear",
                "canonical_entity_id": "garment_ngu_than",
            }
        ],
    })
    assert response.status_code == 200
    data = response.json()
    assert "positive_prompt" in data
    assert "negative_prompt" in data
    assert "Hữu nhậm" in data["positive_prompt"]


def test_api_generation_synthesize_endpoint():
    """Provider acceptance is not done: authenticated callers receive honest unavailability."""
    ready_private_image("user_face_01")
    ready_private_image("private-outfit-board")
    response = client.post("/api/v3/generation/synthesize", headers={"Authorization": auth_header("dev-user-test-1")}, json={
        "outfit": {
            "schema_version": "2.0",
            "dataset_version": "dev",
            "selections": [
                {
                    "selection_id": "sel_1",
                    "slot": "outerwear",
                    "canonical_entity_id": "garment_ngu_than",
                }
            ],
        },
        "user_image_id": "user_face_01",
        "outfit_image_id": "private-outfit-board",
        "options": {},
    })
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "GENERATION_UNAVAILABLE"
    assert "result_media_id" not in response.json()
    assert Database.fetch_one(
        "SELECT COUNT(*) AS n FROM ai_jobs WHERE owner_id=? AND task_type='v3_generation'",
        ("dev-user-test-1",),
    )["n"] == 0


def test_grounding_rejects_unpublished_entities_and_duplicate_slots():
    outfit = {"dataset_version": "dev", "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "garment_ngu_than"}]}
    Database.execute("UPDATE entity_registry SET status='draft' WHERE id='garment_ngu_than'")
    for path in ("grounding", "prompt"):
        response = client.post("/api/v3/generation/" + path, json=outfit)
        assert response.status_code == 404
        assert "must_preserve" not in response.json()
    outfit["selections"].append({**outfit["selections"][0], "selection_id": "s2"})
    assert client.post("/api/v3/generation/grounding", json=outfit).status_code == 422


def test_synthesis_requires_login():
    response = client.post("/api/v3/generation/synthesize", json={"outfit": {"dataset_version": "dev"}})
    assert response.status_code == 401


def test_generation_status_reports_configured_flag(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", False)
    assert client.get("/api/v3/generation/status").json() == {"enabled": False}
    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    assert client.get("/api/v3/generation/status").json() == {"enabled": True}


def test_synthesis_requires_outfit_board_even_with_a_person_photo(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    response = client.post(
        "/api/v3/generation/synthesize",
        headers={"Authorization": auth_header("dev-user-test-1")},
        json={
            "outfit": {"schema_version": "2.0", "dataset_version": "dev", "selections": []},
            "user_image_id": "person-1",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_unaccepted_provider_cannot_synthesize_mock_media():
    from app.core.errors import AppError
    from app.modules.cultural_data_v3.providers.gemini import GeminiGenerationProvider
    with pytest.raises(AppError) as error:
        await GeminiGenerationProvider("dev-user-test-1").generate(ProviderRequest(prompt="test"))
    assert error.value.status_code == 503
    assert error.value.code == "GENERATION_UNAVAILABLE"


@pytest.mark.asyncio
async def test_gemini_provider_stores_a_real_private_image(monkeypatch, png_bytes):
    from app.core.config import settings
    from app.modules.cultural_data_v3.providers import gemini as gemini_module
    from app.modules.media.repository import MediaRepository
    from app.modules.media.service import MediaService

    captured = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "inlineData": {
                                        "mimeType": "image/png",
                                        "data": base64.b64encode(png_bytes).decode("ascii"),
                                    }
                                }
                            ]
                        }
                    }
                ]
            }

    class FakeClient:
        async def post(self, url, *, headers, json):
            captured.update(url=url, headers=headers, payload=json)
            return FakeResponse()

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    monkeypatch.setattr(gemini_module, "get_shared_async_client", lambda timeout: FakeClient())
    requested = []
    def read_image(media_id, owner_id):
        requested.append((media_id, owner_id))
        return png_bytes, "image/png"
    monkeypatch.setattr(MediaService, "read_owned_image", read_image)

    result = await gemini_module.GeminiGenerationProvider("dev-user-test-1").generate(
        ProviderRequest(prompt="Generate Vietnamese attire", outfit_image_id="board-1", user_image_id="person-1", idempotency_key="idem-1")
    )

    media = MediaRepository.get_media_by_id(result.result_media_id)
    assert result.status == "completed"
    assert media["status"] == "ready"
    assert media["visibility"] == "private"
    assert media["owner_id"] == "dev-user-test-1"
    assert "test-only-key" not in captured["url"]
    assert captured["headers"]["X-goog-api-key"] == "test-only-key"
    assert captured["payload"]["generationConfig"]["responseModalities"] == ["Image"]
    assert requested == [("board-1", "dev-user-test-1"), ("person-1", "dev-user-test-1")]
    parts = captured["payload"]["contents"][0]["parts"]
    assert len(parts) == 3
    assert [base64.b64decode(part["inlineData"]["data"]) for part in parts[1:]] == [png_bytes, png_bytes]


@pytest.mark.asyncio
async def test_gemini_provider_uses_requested_image_model(monkeypatch, png_bytes):
    from app.core.config import settings
    from app.modules.cultural_data_v3.providers import gemini as gemini_module
    from app.modules.media.service import MediaService

    captured = {}

    class FakeResponse:
        status_code = 200

        def json(self):
            return {
                "candidates": [{
                    "content": {
                        "parts": [{
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": base64.b64encode(png_bytes).decode("ascii"),
                            }
                        }]
                    }
                }]
            }

    class FakeClient:
        async def post(self, url, *, headers, json):
            captured["url"] = url
            captured["payload"] = json
            return FakeResponse()

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    monkeypatch.setattr(gemini_module, "get_shared_async_client", lambda timeout: FakeClient())
    monkeypatch.setattr(MediaService, "read_owned_image", lambda media_id, owner_id: (png_bytes, "image/png"))

    result = await gemini_module.GeminiGenerationProvider(
        "dev-user-test-1", model_id="gemini-3.1-flash-image"
    ).generate(ProviderRequest(prompt="Generate Vietnamese attire", outfit_image_id="board-1"))

    assert result.model_id == "gemini-3.1-flash-image"
    assert captured["url"].endswith("/v1/models/gemini-3.1-flash-image:generateContent")
    assert len(captured["payload"]["contents"][0]["parts"]) == 2


@pytest.mark.asyncio
async def test_gemini_rejects_foreign_outfit_board_before_provider_call(monkeypatch):
    from app.core.config import settings
    from app.modules.cultural_data_v3.providers import gemini as gemini_module
    from app.modules.media.service import MediaService

    def reject_foreign(_media_id, _owner_id):
        raise AppError("MEDIA_NOT_FOUND", "Không tìm thấy file", 404)

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    monkeypatch.setattr(MediaService, "read_owned_image", reject_foreign)
    monkeypatch.setattr(gemini_module, "get_shared_async_client", lambda timeout: pytest.fail("Provider must not be called"))

    with pytest.raises(AppError) as error:
        await gemini_module.GeminiGenerationProvider("owner-1").generate(
            ProviderRequest(prompt="Try on", outfit_image_id="foreign-board")
        )
    assert error.value.code == "MEDIA_NOT_FOUND"


def test_synthesis_rejects_unknown_image_model():
    response = client.post(
        "/api/v3/generation/synthesize",
        headers={"Authorization": auth_header("dev-user-test-1")},
        json={
            "outfit": {"schema_version": "2.0", "dataset_version": "dev", "selections": []},
            "model_id": "gemini-unknown-image",
        },
    )

    assert response.status_code == 422


def test_api_generation_synthesize_success(monkeypatch, png_bytes):
    ready_private_image("private-outfit-board")
    from app.core.config import settings
    from app.modules.cultural_data_v3.providers.gemini import GeminiGenerationProvider
    from app.modules.media.service import MediaService

    async def generate(_self, request):
        assert request.outfit_image_id == "private-outfit-board"
        assert request.user_image_id is None
        assert "Choose one adult wearer" in request.prompt
        media = MediaService.ingest_generated_image(
            "dev-user-test-1", png_bytes, "image/png"
        )
        return ProviderResult(
            status="completed",
            model_id="gemini-test-image",
            result_media_id=media.id,
            prompt_used=request.prompt,
            metadata={"provider": "gemini"},
        )

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    monkeypatch.setattr(GeminiGenerationProvider, "generate", generate)
    response = client.post(
        "/api/v3/generation/synthesize",
        headers={"Authorization": auth_header("dev-user-test-1")},
        json={
            "outfit": {
                "schema_version": "2.0",
                "dataset_version": "dev",
                "selections": [
                    {
                        "selection_id": "sel_1",
                        "slot": "outerwear",
                        "canonical_entity_id": "garment_ngu_than",
                    }
                ],
            },
            "options": {},
            "outfit_image_id": "private-outfit-board",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "completed"
    assert payload["result_media_id"]
    assert payload["post_validation"]["review_status"] == "not_evaluated"


def test_synthesis_uses_published_catalog_when_v3_has_no_mapping(monkeypatch, png_bytes):
    from app.core.config import settings
    from app.modules.cultural_data_v3.providers.gemini import GeminiGenerationProvider
    from app.modules.media.service import MediaService

    item_id = f"published_{uuid.uuid4().hex[:10]}"
    Database.execute(
        "INSERT INTO items(id,garment_type_id,name,slot,gender,era,is_published) VALUES(?,?,?,?,?,?,1)",
        (item_id, "ngu_than", "Áo bào đã duyệt", "outerwear", "unisex", "nguyen"),
    )
    seen = {}

    async def generate(_self, request):
        seen["prompt"] = request.prompt
        media = MediaService.ingest_generated_image("dev-user-test-1", png_bytes, "image/png")
        return ProviderResult(status="completed", model_id="gemini-test-image", result_media_id=media.id)

    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    monkeypatch.setattr(GeminiGenerationProvider, "generate", generate)
    ready_private_image("private-board")
    response = client.post(
        "/api/v3/generation/synthesize",
        headers={"Authorization": auth_header("dev-user-test-1")},
        json={
            "outfit": {"schema_version": "2.0", "dataset_version": "dev", "selections": []},
            "legacy_item_ids": [item_id],
            "outfit_image_id": "private-board",
        },
    )
    assert response.status_code == 200
    assert "Áo bào đã duyệt" in seen["prompt"]
    assert "Image 1 is the outfit board" in seen["prompt"]
    assert response.json()["post_validation"]["review_status"] == "not_evaluated"


def test_synthesis_rejects_unpublished_catalog_item(monkeypatch):
    from app.core.config import settings

    item_id = f"unpublished_{uuid.uuid4().hex[:10]}"
    Database.execute(
        "INSERT INTO items(id,garment_type_id,name,slot,gender,era,is_published) VALUES(?,?,?,?,?,?,0)",
        (item_id, "ngu_than", "Bản nháp không công khai", "outerwear", "unisex", "nguyen"),
    )
    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only-key")
    response = client.post(
        "/api/v3/generation/synthesize",
        headers={"Authorization": auth_header("dev-user-test-1")},
        json={
            "outfit": {"schema_version": "2.0", "dataset_version": "dev", "selections": []},
            "legacy_item_ids": [item_id],
            "outfit_image_id": "private-board",
        },
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_reference_permission_requires_explicit_purpose_and_review():
    assert ReferenceSelector.filter_references([
        {"id": "excerpt", "review_status": "published", "rights": {"public_excerpt": True}},
        {"id": "unreviewed", "review_status": "draft", "rights": {"ai_reference_allowed": True}},
        {"id": "string_flag", "review_status": "published", "rights": {"ai_reference_allowed": "true"}},
        {"id": "allowed", "review_status": "published", "rights": {"ai_reference_allowed": True}},
    ]) == ["allowed"]
