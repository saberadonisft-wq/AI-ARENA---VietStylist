"""Adversarial publication and write-boundary checks against an isolated database."""
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Database
from app.modules.cultural_data_v3.domain.models import AttributeDefinition, AttributeValue, Entity
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository as Repo
from conftest import auth_header as bearer_value


def auth_header(user_id):
    return {"Authorization": bearer_value(user_id)}

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def editor():
    Database.execute("INSERT INTO user_roles(id,user_id,role) VALUES('review-editor','dev-user-test-1','editor')")
    return auth_header("dev-user-test-1")


def entity(entity_id="public_garment", status="published", entity_type="garment"):
    Repo.add_entity(Entity(id=entity_id, entity_type=entity_type, identity={"name_vi": entity_id}, status=status))


def definition(key="construction.test", kind="string", **kwargs):
    Repo.add_attribute_definition(AttributeDefinition(key=key, label_vi="Test", value_type=kind, applies_to=["garment"], status="active", **kwargs))


def create_payload(status="draft"):
    return {"id": "created_entity", "entity_type": "garment", "identity": {"name_vi": "Test"}, "status": status}


def test_guest_and_regular_user_cannot_write():
    assert client.post("/api/v3/entities", json=create_payload("published")).status_code == 401
    assert client.post("/api/v3/entities", json=create_payload(), headers=auth_header("dev-user-test-1")).status_code == 403
    assert Repo.get_entity("created_entity") is None


def test_editor_drafts_admin_publication_and_stale_revision(editor):
    assert client.post("/api/v3/entities", json=create_payload("published"), headers=editor).status_code == 403
    assert client.post("/api/v3/entities", json=create_payload(), headers=editor).status_code == 201
    path = "/api/v3/editor/entities/created_entity/status"
    assert client.patch(path, json={"status": "published", "version": 1}, headers=editor).status_code == 403
    admin = auth_header("dev-user-admin")
    response = client.patch(path, json={"status": "published", "version": 1}, headers=admin)
    assert response.status_code == 200
    assert response.json()["version"] == 2
    assert client.patch(path, json={"status": "draft", "version": 1}, headers=admin).status_code == 409
    assert Repo.get_entity("created_entity")["status"] == "published"
    # Role revocation must take effect without waiting for JWT expiration.
    Database.execute("DELETE FROM user_roles WHERE id='review-editor'")
    assert client.get("/api/v3/editor/entities", headers=editor).status_code == 403


@pytest.mark.parametrize("status", ["draft", "under_review", "verified", "deprecated"])
def test_unpublished_entity_hidden_in_every_public_projection(status, editor):
    entity(status=status)
    assert client.get("/api/v3/entities").json() == []
    assert client.get(f"/api/v3/entities?status={status}").json() == []
    for path in ["entities/public_garment/education", "composer/bundles/public_garment", "generation/profiles/public_garment"]:
        assert client.get("/api/v3/" + path).status_code == 404
    assert client.get("/api/v3/editor/entities/public_garment/education").status_code == 401
    assert client.get("/api/v3/editor/entities/public_garment/education", headers=editor).status_code == 200
    response = client.post("/api/v3/outfits/validate", json={"dataset_version": "dev", "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "public_garment"}]})
    assert response.json()["missing_entities"] == ["public_garment"]


def test_invalid_payload_is_422_and_duplicate_does_not_leak_sql(editor):
    payload = create_payload()
    for patch in [{"status": "garbage"}, {"entity_type": "unknown_type"}, {"identity": {}}, {"id": "bad/id"}]:
        response = client.post("/api/v3/entities", json={**payload, **patch}, headers=editor)
        assert response.status_code == 422, response.text
    assert client.post("/api/v3/entities", json=payload, headers=editor).status_code == 201
    response = client.post("/api/v3/entities", json=payload, headers=editor)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ENTITY_EXISTS"
    assert "UNIQUE" not in response.text and "entity_registry" not in response.text
    assert client.get("/api/v3/entities", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_unexpected_database_error_is_not_reported_as_duplicate(editor, monkeypatch):
    def fail(_):
        raise sqlite3.OperationalError("private database path")
    monkeypatch.setattr(Repo, "add_entity", fail)
    response = client.post("/api/v3/entities", json=create_payload(), headers=editor)
    assert response.status_code == 500
    assert "private database path" not in response.text


@pytest.mark.parametrize("kind,actual,kwargs", [
    ("enum", "outside", {"allowed_values": ["inside"]}),
    ("number", True, {}), ("number", "5", {}), ("number", float("inf"), {}),
    ("boolean", 1, {}), ("string", {"text": "wrong"}, {}),
    ("entity_ref", "missing", {}), ("entity_ref_list", ["missing"], {}),
    ("color", "red", {}), ("measurement", {"value": 5}, {}),
    ("date_range", {"start": 10, "end": 1}, {}), ("structured", "not-structured", {}),
])
def test_repository_rejects_invalid_values_without_writing(kind, actual, kwargs):
    entity()
    definition(kind=kind, **kwargs)
    with pytest.raises(ValueError):
        Repo.add_attribute_value(AttributeValue(id="bad", entity_id="public_garment", attribute_key="construction.test", state="known", value=actual))
    assert Repo.values_for("public_garment") == []


def test_cardinality_context_and_disputed_candidates():
    entity()
    entity("period_one", entity_type="period")
    definition(kind="enum", allowed_values=["inside"])
    def value(value_id, **kwargs):
        return AttributeValue(id=value_id, entity_id="public_garment", attribute_key="construction.test", **kwargs)
    Repo.add_attribute_value(value("one", state="known", value="inside"))
    with pytest.raises(ValueError, match="Single-cardinality"):
        Repo.add_attribute_value(value("two", state="known", value="inside"))
    Repo.add_attribute_value(value("context", state="known", value="inside", qualifiers={"period_ids": ["period_one"]}))
    with pytest.raises(ValueError, match="allowed_values"):
        Repo.add_attribute_value(value("bad_candidate", state="disputed", candidate_values=[{"value": "outside"}]))
    with pytest.raises(ValueError, match="qualifier"):
        Repo.add_attribute_value(value("bad_context", state="known", value="inside", qualifiers={"period_ids": ["public_garment"]}))
    assert len(Repo.values_for("public_garment")) == 2


def test_legacy_withheld_payload_and_unpublished_references_are_redacted():
    entity()
    entity("private_target", status="draft")
    definition()
    definition(key="construction.ref", kind="entity_ref")
    # Simulate rows created by an older importer, before the new write validator.
    Database.execute("INSERT INTO attribute_values(id,entity_id,attribute_key,state,value_json,candidate_values_json,assertion_ids_json) VALUES('withheld','public_garment','construction.test','withheld',?,?,?)", (json.dumps("PRIVATE_VALUE"), json.dumps(["PRIVATE_CANDIDATE"]), json.dumps(["PRIVATE_ASSERTION"])))
    Repo.add_attribute_value(AttributeValue(id="ref", entity_id="public_garment", attribute_key="construction.ref", state="known", value="private_target"))
    Database.execute("INSERT INTO relation_definitions(key,label_vi,source_types_json,target_types_json,status) VALUES('related','Related','[\"garment\"]','[\"garment\"]','active')")
    Database.execute("INSERT INTO entity_relations(id,subject_id,relation_type,object_id) VALUES('secret_relation','public_garment','related','private_target')")
    for path in ["entities/public_garment/education", "composer/bundles/public_garment", "generation/profiles/public_garment"]:
        response = client.get("/api/v3/" + path)
        assert response.status_code == 200
        assert "PRIVATE_" not in response.text
        assert "private_target" not in response.text
        assert "secret_relation" not in response.text
    data = client.get("/api/v3/entities/public_garment/education").json()
    assert data["attributes"][0]["state"] == "withheld"
    assert data["attributes"][0]["value"] is None


def test_withdrawing_evidence_removes_fact_from_all_public_projections():
    entity()
    definition()
    Database.execute("INSERT INTO cultural_sources_v3(id,source_type,title,accessed_at,review_status) VALUES('source','academic_book','Test source','2026-09-19','published')")
    Database.execute("INSERT INTO cultural_assertions_v3(id,subject_id,predicate,value_json,review_status) VALUES('assertion','public_garment','construction.test','\"visible\"','published')")
    Database.execute("INSERT INTO assertion_evidence_v3(id,assertion_id,source_id,locator) VALUES('evidence','assertion','source','page 1')")
    Repo.add_attribute_value(AttributeValue(id="fact", entity_id="public_garment", attribute_key="construction.test", state="known", value="visible", assertion_ids=["assertion"]))
    assert len(client.get("/api/v3/entities/public_garment/education").json()["attributes"]) == 1
    Database.execute("UPDATE cultural_sources_v3 SET review_status='draft' WHERE id='source'")
    assert client.get("/api/v3/entities/public_garment/education").json()["attributes"] == []
    assert client.get("/api/v3/composer/bundles/public_garment").json()["attributes"] == []
    assert client.get("/api/v3/generation/profiles/public_garment").json()["must_preserve"] == []


def test_concurrent_single_cardinality_writes_do_not_race():
    from concurrent.futures import ThreadPoolExecutor
    entity()
    definition()
    def write(index):
        try:
            Repo.add_attribute_value(AttributeValue(id=f"race_{index}", entity_id="public_garment", attribute_key="construction.test", state="known", value="safe"))
            return "saved"
        except ValueError as exc:
            assert "Single-cardinality" in str(exc)
            return "rejected"
    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(write, [1, 2])) == ["rejected", "saved"]
    assert len(Repo.values_for("public_garment")) == 1


@pytest.mark.parametrize("state", ["unknown", "not_collected", "not_applicable", "withheld", "disputed"])
def test_unresolved_states_cannot_store_resolved_values(state):
    with pytest.raises(ValueError):
        AttributeValue(id="bad", entity_id="e", attribute_key="construction.test", state=state, value="must not leak", candidate_values=["candidate"] if state == "disputed" else [])
