"""Tests for V3 API endpoints and projection builders."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from conftest import auth_header
from app.core.database import init_database
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository
from app.modules.cultural_data_v3.domain.models import (
    Entity,
    AttributeDefinition,
    AttributeValue,
)
from app.modules.cultural_data_v3.services.rule_engine import evaluate_condition


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database is initialized before each test."""
    init_database(seed=True)
    yield


def _seed_test_entity():
    """Seed a test entity with attributes for projection tests."""
    repo = CulturalDataV3Repository()
    try:
        repo.add_entity(Entity(
            id="test_garment_01",
            entity_type="garment",
            identity={"name_vi": "Áo test", "aliases": ["Test garment"]},
            status="published",
        ))
    except Exception:
        pass  # Already exists

    try:
        repo.add_attribute_definition(AttributeDefinition(
            key="construction.test_feature",
            label_vi="Đặc điểm test",
            value_type="string",
            status="active",
            applies_to=["garment"],
        ))
    except Exception:
        pass

    try:
        repo.add_attribute_definition(AttributeDefinition(
            key="visual.test_color",
            label_vi="Màu test",
            value_type="string",
            status="active",
            applies_to=["garment"],
        ))
    except Exception:
        pass

    try:
        repo.add_attribute_value(AttributeValue(
            id="av_test_01",
            entity_id="test_garment_01",
            attribute_key="construction.test_feature",
            state="known",
            value="test_value",
        ))
    except Exception:
        pass

    try:
        repo.add_attribute_value(AttributeValue(
            id="av_test_02",
            entity_id="test_garment_01",
            attribute_key="visual.test_color",
            state="known",
            value="red",
        ))
    except Exception:
        pass


def test_list_entities_empty():
    response = client.get("/api/v3/entities")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_entity():
    response = client.post("/api/v3/entities", headers={"Authorization": auth_header("dev-user-admin")}, json={
        "id": "test_entity_api",
        "entity_type": "garment",
        "identity": {"name_vi": "Áo test API"},
    })
    assert response.status_code == 201
    data = response.json()
    assert data["id"] == "test_entity_api"
    assert data["entity_type"] == "garment"


def test_education_projection():
    _seed_test_entity()
    response = client.get("/api/v3/entities/test_garment_01/education")
    assert response.status_code == 200
    data = response.json()
    assert data["projection_version"] == "education-1"
    assert data["title"] == "Áo test"
    assert isinstance(data["attributes"], list)


def test_composer_bundle():
    _seed_test_entity()
    response = client.get("/api/v3/composer/bundles/test_garment_01")
    assert response.status_code == 200
    data = response.json()
    assert data["projection_version"] == "composer-1"
    assert "dataset_version" in data


def test_generation_profile():
    _seed_test_entity()
    response = client.get("/api/v3/generation/profiles/test_garment_01")
    assert response.status_code == 200
    data = response.json()
    assert data["projection_version"] == "generation-profile-1"
    # Known attribute without source evidence is not a grounded hard constraint.
    assert data["must_preserve"] == []
    assert any(a["attribute_key"] == "construction.test_feature" and a["reason"] == "missing_evidence" for a in data["unresolved"])
    # visual.* attributes should be in may_vary
    assert "visual.test_color" in data["may_vary"]


def test_entity_not_found():
    response = client.get("/api/v3/entities/nonexistent/education")
    assert response.status_code == 404


def test_validate_outfit_v2():
    _seed_test_entity()
    response = client.post("/api/v3/outfits/validate", json={
        "schema_version": "2.0",
        "dataset_version": "dev",
        "selections": [
            {
                "selection_id": "sel_1",
                "slot": "outerwear",
                "canonical_entity_id": "test_garment_01",
                "style": {},
            },
            {
                "selection_id": "sel_2",
                "slot": "bottom",
                "canonical_entity_id": "nonexistent_entity",
                "style": {},
            },
        ],
        "context": {},
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "warning"
    assert "nonexistent_entity" in data["missing_entities"]


# --- Rule engine tests ---

def test_rule_engine_eq():
    assert evaluate_condition(
        {"field": "outfit.mode", "operator": "eq", "value": "remix"},
        {"outfit": {"mode": "remix"}},
    )


def test_rule_engine_reject_unknown_operator():
    with pytest.raises(ValueError, match="Unsupported"):
        evaluate_condition(
            {"field": "x", "operator": "python_eval", "value": "x"},
            {"x": 1},
        )


def test_rule_engine_all():
    assert evaluate_condition(
        {
            "operator": "all",
            "conditions": [
                {"field": "a", "operator": "eq", "value": 1},
                {"field": "b", "operator": "eq", "value": 2},
            ],
        },
        {"a": 1, "b": 2},
    )


def test_rule_engine_any():
    assert evaluate_condition(
        {
            "operator": "any",
            "conditions": [
                {"field": "a", "operator": "eq", "value": 1},
                {"field": "b", "operator": "eq", "value": 99},
            ],
        },
        {"a": 1, "b": 2},
    )
