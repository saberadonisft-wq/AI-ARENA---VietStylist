"""Snapshot replay uses frozen content, with current publication revocation."""
import json
import sqlite3
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from app.modules.cultural_data_v3.domain.models import Entity, AttributeDefinition, AttributeValue
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository as Repo
from app.modules.cultural_data_v3.services.datasets import create_dataset, load_content
from conftest import auth_header

client = TestClient(app)


@pytest.fixture(autouse=True)
def graph():
    Repo.add_entity(Entity(id="snapshot_garment", entity_type="garment", identity={"name_vi": "Synthetic garment"}, status="published", extensions={"internal_note": "MUST NOT ARCHIVE"}))
    Repo.add_entity(Entity(id="draft_garment", entity_type="garment", identity={"name_vi": "PRIVATE DRAFT"}))
    Repo.add_attribute_definition(AttributeDefinition(key="construction.snapshot", label_vi="Example", value_type="number", applies_to=["garment"], status="active"))
    Database.execute("INSERT INTO cultural_sources_v3(id,source_type,title,accessed_at,rights_json,review_status) VALUES('snapshot_source','example','Example source','2026-09-19','{}','published')")
    Database.execute("INSERT INTO cultural_assertions_v3(id,subject_id,predicate,value_json,review_status) VALUES('snapshot_claim','snapshot_garment','construction.snapshot','5','published')")
    Database.execute("INSERT INTO assertion_evidence_v3(id,assertion_id,source_id,locator) VALUES('snapshot_evidence','snapshot_claim','snapshot_source','Example section')")
    Repo.add_attribute_value(AttributeValue(id="snapshot_fact", entity_id="snapshot_garment", attribute_key="construction.snapshot", state="known", value=5, assertion_ids=["snapshot_claim"]))


def freeze():
    return create_dataset("Example dataset", "dev-user-admin")


def test_entity_picker_uses_selected_dataset_and_respects_withdrawal():
    Repo.add_entity(Entity(id="period_example", entity_type="period", identity={"name_vi": "Period before"}, status="published"))
    version = freeze()["dataset_version"]
    Database.execute("UPDATE entity_registry SET identity_json=? WHERE id='period_example'", ('{"name_vi":"Period after"}',))
    frozen = client.get("/api/v3/entities", params={"dataset_version": version, "entity_type": "period"})
    assert frozen.status_code == 200, frozen.text
    assert frozen.json()[0]["identity"]["name_vi"] == "Period before"
    assert frozen.json()[0]["extensions"] == {}
    assert client.get("/api/v3/entities", params={"entity_type": "period"}).json()[0]["identity"]["name_vi"] == "Period after"
    Database.execute("UPDATE entity_registry SET status='draft' WHERE id='period_example'")
    assert client.get("/api/v3/entities", params={"dataset_version": version, "entity_type": "period"}).status_code == 409


def grounding(version, ruleset=None):
    return client.post("/api/v3/generation/grounding", json={"dataset_version": version, "ruleset_version": ruleset, "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "snapshot_garment"}]})


def test_frozen_grounding_replays_after_live_facts_and_citations_change():
    metadata = freeze()
    version = metadata["dataset_version"]
    before = grounding(version, metadata["ruleset_version"])
    assert before.status_code == 200, before.text
    data = before.json()["grounding"]
    assert data["must_preserve"][0]["value"] == 5
    assert data["dataset"]["reproducible"] is True
    Database.execute("UPDATE attribute_values SET value_json='9' WHERE id='snapshot_fact'")
    Database.execute("UPDATE cultural_assertions_v3 SET value_json='9' WHERE id='snapshot_claim'")
    Database.execute("UPDATE assertion_evidence_v3 SET locator='Updated section' WHERE id='snapshot_evidence'")
    assert grounding("dev").json()["grounding"]["must_preserve"][0]["value"] == 9
    assert grounding(version, metadata["ruleset_version"]).json() == before.json()
    newer = freeze()
    assert newer["dataset_version"] != version
    assert grounding(newer["dataset_version"]).json()["grounding"]["must_preserve"][0]["value"] == 9


def test_snapshot_creation_is_idempotent_and_content_excludes_private_data():
    first = freeze()
    assert freeze() == first
    content = load_content(first["dataset_version"])
    text = json.dumps(content)
    assert "PRIVATE DRAFT" not in text and "MUST NOT ARCHIVE" not in text
    assert "users" not in content["tables"] and "media_assets" not in content["tables"]
    assert client.get("/api/v3/datasets").json()[0]["dataset_version"] == first["dataset_version"]


@pytest.mark.parametrize("statement", [
    "UPDATE cultural_sources_v3 SET review_status='draft' WHERE id='snapshot_source'",
    "UPDATE entity_registry SET status='draft' WHERE id='snapshot_garment'",
    "UPDATE cultural_assertions_v3 SET review_status='deprecated' WHERE id='snapshot_claim'",
    "UPDATE attribute_values SET state='withheld' WHERE id='snapshot_fact'",
    "UPDATE attribute_definitions SET status='deprecated' WHERE key='construction.snapshot'",
    "UPDATE cultural_sources_v3 SET rights_json='{\"ai_reference_allowed\":false}' WHERE id='snapshot_source'",
])
def test_frozen_version_cannot_bypass_live_withdrawal(statement):
    version = freeze()["dataset_version"]
    Database.execute(statement)
    response = grounding(version)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "DATASET_WITHDRAWN"
    # The original content still exists for editor audit; it was not rewritten.
    assert load_content(version)["tables"]["attribute_values"][0]["value_json"] == "5"


def test_snapshot_content_and_manifest_cannot_be_updated_or_deleted():
    freeze()
    for table in ("dataset_snapshots_v3", "dataset_contents_v3"):
        for statement in (f"DELETE FROM {table}", f"UPDATE {table} SET created_at='tampered'"):
            with pytest.raises(sqlite3.IntegrityError, match="immutable dataset"):
                Database.execute(statement)


@pytest.mark.parametrize("table,key", [("dataset_snapshots_v3", "id"), ("dataset_contents_v3", "dataset_id")])
def test_replace_cannot_change_immutable_snapshot_even_without_recursive_triggers(table, key):
    from app.core.database import get_db_connection
    metadata = freeze()
    before = grounding(metadata["dataset_version"]).json()
    with get_db_connection() as conn:
        conn.execute("PRAGMA recursive_triggers=OFF")
        row = dict(conn.execute(f"SELECT * FROM {table} WHERE {key}=?", (metadata["dataset_version"],)).fetchone())
        row["created_at"] = "tampered"
        columns = list(row)
        with pytest.raises(sqlite3.IntegrityError, match="immutable dataset"):
            conn.execute(f"INSERT OR REPLACE INTO {table} ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", [row[c] for c in columns])
        conn.rollback()
    assert grounding(metadata["dataset_version"]).json() == before


def test_creation_requires_admin_and_export_requires_editor():
    endpoint = "/api/v3/editor/datasets"
    assert client.post(endpoint, json={"label": "test"}).status_code == 401
    regular = {"Authorization": auth_header("dev-user-test-1")}
    assert client.post(endpoint, json={"label": "test"}, headers=regular).status_code == 403
    admin = {"Authorization": auth_header("dev-user-admin")}
    created = client.post(endpoint, json={"label": "test"}, headers=admin)
    assert created.status_code == 201, created.text
    path = f"{endpoint}/{created.json()['dataset_version']}/content"
    assert client.get(path).status_code == 401
    assert client.get(path, headers=regular).status_code == 403
    assert client.get(path, headers=admin).status_code == 200


def test_unknown_versions_and_mismatched_rulesets_are_not_echoed_as_valid():
    assert grounding("nonexistent").status_code == 404
    metadata = freeze()
    response = grounding(metadata["dataset_version"], "wrong_rules")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "RULESET_VERSION_MISMATCH"
    assert grounding("dev", "pretend_stable_version").status_code == 422


def test_legacy_manifest_without_content_is_not_reproducible():
    Database.execute("INSERT INTO dataset_snapshots_v3(id,label,snapshot_hash) VALUES('legacy','Old counter only','not_content')")
    assert grounding("legacy").status_code == 404


def test_projection_uses_frozen_identity_and_evidence():
    version = freeze()["dataset_version"]
    Database.execute("UPDATE entity_registry SET identity_json='{\"name_vi\":\"Renamed live\"}' WHERE id='snapshot_garment'")
    for path in ("entities/snapshot_garment/education", "composer/bundles/snapshot_garment", "generation/profiles/snapshot_garment"):
        response = client.get("/api/v3/" + path, params={"dataset_version": version})
        assert response.status_code == 200, response.text
        assert "Renamed live" not in response.text
        assert response.json()["evidence"][0]["sources"][0]["locator"] == "Example section"
