"""Integration tests for V3 Pilot Cultural Knowledge Dataset."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Database
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository
from scripts.seed_v3_pilot_data import seed_pilot_data

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_pilot_seeded():
    """Ensure pilot data is seeded into database before each test."""
    seed_pilot_data()
    # Simulate editorial publication only in the isolated test database.
    # The actual seed remains unapproved and must not become public implicitly.
    Database.execute("UPDATE entity_registry SET status='published'")
    Database.execute("UPDATE cultural_assertions_v3 SET review_status='published'")
    Database.execute("UPDATE cultural_sources_v3 SET review_status='published'")


def test_education_projection_ngu_than():
    """Verify Education Projection for Áo ngũ thân contains research assertions and attributes."""
    response = client.get("/api/v3/entities/garment_ngu_than/education")
    assert response.status_code == 200
    data = response.json()

    assert data["entity_id"] == "garment_ngu_than"
    assert data["title"] == "Áo ngũ thân"
    assert "Ngũ thân tay chẽn" in data["aliases"]

    # Verify attributes
    attr_keys = [a["attribute_key"] for a in data["attributes"]]
    assert "construction.closure.direction" in attr_keys
    assert "construction.body_panels" in attr_keys
    assert "construction.collar.type" in attr_keys
    assert "construction.buttons.count" in attr_keys

    # Verify relations
    related_objects = [r["object_id"] for r in data["relations"]]
    assert "period_nguyen" in related_objects
    assert "accessory_khan_van" in related_objects


def test_composer_bundle_ao_tac():
    """Verify Composer Bundle for Áo tấc returns canonical garment metadata."""
    response = client.get("/api/v3/composer/bundles/garment_ao_tac?period_ids=period_nguyen")
    assert response.status_code == 200
    data = response.json()

    assert data["projection_version"] == "composer-1"
    assert data["entity"]["id"] == "garment_ao_tac"

    # Check that sleeve type is wide (tay_thung)
    sleeve_attr = next(
        (a for a in data["attributes"] if a["attribute_key"] == "construction.sleeve.type"),
        None,
    )
    assert sleeve_attr is not None
    assert sleeve_attr["value"] == "tay_thung"


def test_generation_profile_ngu_than():
    """Verify Generation Profile for Áo ngũ thân protects cultural invariants."""
    response = client.get("/api/v3/generation/profiles/garment_ngu_than?period_ids=period_nguyen")
    assert response.status_code == 200
    data = response.json()

    must_preserve_features = [mp["feature"] for mp in data["must_preserve"]]
    assert "construction.closure.direction" in must_preserve_features
    assert "construction.body_panels" in must_preserve_features


def test_legacy_mapping_resolution():
    """Verify legacy items correctly resolve to canonical entities."""
    repo = CulturalDataV3Repository()

    # Legacy item mapping
    entity = repo.get_entity_by_legacy("items", "item_ngu_than_nam_xanh")
    assert entity is not None
    assert entity["id"] == "garment_ngu_than_nam"

    # Legacy garment_type mapping
    entity_gt = repo.get_entity_by_legacy("garment_types", "ngu_than")
    assert entity_gt is not None
    assert entity_gt["id"] == "garment_ngu_than"
