"""Integration and unit tests for V3 AI Generation Pipeline."""
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
        "options": {},
    })
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "GENERATION_UNAVAILABLE"
    assert "result_media_id" not in response.json()


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


@pytest.mark.asyncio
async def test_unaccepted_provider_cannot_synthesize_mock_media():
    from app.core.errors import AppError
    from app.modules.cultural_data_v3.providers.gemini import GeminiGenerationProvider
    with pytest.raises(AppError) as error:
        await GeminiGenerationProvider().generate(ProviderRequest(prompt="test"))
    assert error.value.status_code == 503
    assert error.value.code == "GENERATION_UNAVAILABLE"


def test_reference_permission_requires_explicit_purpose_and_review():
    assert ReferenceSelector.filter_references([
        {"id": "excerpt", "review_status": "published", "rights": {"public_excerpt": True}},
        {"id": "unreviewed", "review_status": "draft", "rights": {"ai_reference_allowed": True}},
        {"id": "string_flag", "review_status": "published", "rights": {"ai_reference_allowed": "true"}},
        {"id": "allowed", "review_status": "published", "rights": {"ai_reference_allowed": True}},
    ]) == ["allowed"]
