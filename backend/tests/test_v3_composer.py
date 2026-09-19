"""Persisted render records/rules are used by bundles and outfit validation."""
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from app.modules.cultural_data_v3.services.datasets import create_dataset
from test_v3_datasets import graph

client = TestClient(app)


@pytest.fixture(autouse=True)
def render_records(graph):
    Database.execute("INSERT INTO renderable_items_v3(id,canonical_entity_id,slot,name) VALUES('render_one','snapshot_garment','outerwear','Example render')")
    Database.execute("INSERT INTO renderable_variants_v3(id,renderable_item_id,color_name,hex_color) VALUES('variant_one','render_one','Red','#990000')")
    Database.execute("INSERT INTO render_profiles_v3(id,renderable_item_id,variant_id,svg_content) VALUES('profile_one','render_one','variant_one',?)", ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="50" height="80" fill="#990000"/></svg>',))


def rule(condition=None, status="published"):
    Database.execute("INSERT INTO cultural_rules_v3(id,entity_id,name,condition_json,severity,explanation,assertion_ids_json,status) VALUES('example_rule','snapshot_garment','Example rule',?,'warning','Synthetic test rule','[\"snapshot_claim\"]',?)", (json.dumps(condition or {"field": "slots.headwear", "operator": "missing"}), status))


def spec(version="dev"):
    return {"dataset_version": version, "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "snapshot_garment", "renderable_item_id": "render_one", "render_variant_id": "variant_one"}]}


def test_bundle_returns_actual_renderable_variant_profile_and_rule():
    rule()
    response = client.get("/api/v3/composer/bundles/snapshot_garment")
    assert response.status_code == 200
    bundle = response.json()
    assert bundle["renderables"][0]["id"] == "render_one"
    assert bundle["renderables"][0]["profiles"][0]["svg_content"]
    assert bundle["style_options"][0]["id"] == "variant_one"
    assert bundle["rules"][0]["id"] == "example_rule"
    assert bundle["evidence"][0]["sources"][0]["locator"] == "Example section"


def test_no_rules_is_not_evaluated_and_evaluated_violation_is_real():
    path = "/api/v3/outfits/validate"
    result = client.post(path, json=spec()).json()
    assert result["status"] == "not_evaluated" and result["evaluated_rule_count"] == 0
    rule()
    result = client.post(path, json=spec()).json()
    assert result["status"] == "warning" and result["evaluated_rule_count"] == 1
    assert result["violations"][0]["rule_id"] == "example_rule"
    Database.execute("UPDATE cultural_rules_v3 SET condition_json=?", (json.dumps({"field": "slots.outerwear", "operator": "missing"}),))
    assert client.post(path, json=spec()).json()["status"] == "clear"


@pytest.mark.parametrize("statement", [
    "UPDATE cultural_rules_v3 SET status='draft'",
    "UPDATE cultural_assertions_v3 SET review_status='draft'",
    "UPDATE cultural_assertions_v3 SET consensus='disputed'",
    "UPDATE cultural_sources_v3 SET review_status='draft'",
])
def test_unpublished_or_unsupported_rule_does_not_claim_validation(statement):
    rule()
    Database.execute(statement)
    result = client.post("/api/v3/outfits/validate", json=spec()).json()
    assert result["status"] == "not_evaluated"
    assert result["evaluated_rule_count"] == 0


def test_frozen_rules_and_render_styles_replay_original_values():
    rule()
    snapshot = create_dataset("Example", "dev-user-admin")
    version = snapshot["dataset_version"]
    Database.execute("UPDATE renderable_variants_v3 SET hex_color='#000099' WHERE id='variant_one'")
    Database.execute("UPDATE cultural_rules_v3 SET condition_json=?", (json.dumps({"field": "slots.outerwear", "operator": "missing"}),))
    bundle = client.get("/api/v3/composer/bundles/snapshot_garment", params={"dataset_version": version}).json()
    assert bundle["style_options"][0]["hex_color"] == "#990000"
    assert bundle["ruleset_version"] == snapshot["ruleset_version"]
    assert client.post("/api/v3/outfits/validate", json=spec(version)).json()["status"] == "warning"
    assert client.post("/api/v3/outfits/validate", json=spec()).json()["status"] == "clear"


def test_active_svg_and_inactive_renderables_are_not_served():
    Database.execute("UPDATE render_profiles_v3 SET svg_content='<svg><script>alert(1)</script></svg>'")
    assert client.get("/api/v3/composer/bundles/snapshot_garment").json()["renderables"] == []
    Database.execute("UPDATE renderable_items_v3 SET is_active=0")
    assert client.get("/api/v3/composer/bundles/snapshot_garment").json()["style_options"] == []


def test_invalid_rule_ast_returns_controlled_error():
    rule({"operator": "eval", "field": "__import__"})
    response = client.post("/api/v3/outfits/validate", json=spec())
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INVALID_RULESET"


def test_render_selection_cannot_use_unrelated_or_nonexistent_ids():
    for patch, code in [({"renderable_item_id": "missing"}, "INVALID_RENDERABLE"), ({"render_variant_id": "missing"}, "INVALID_RENDER_VARIANT"), ({"slot": "headwear"}, "INVALID_RENDERABLE")]:
        payload = spec()
        payload["selections"][0].update(patch)
        response = client.post("/api/v3/outfits/validate", json=payload)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == code


@pytest.mark.parametrize("state", ["unknown", "disputed", "withheld", "inferred"])
def test_unknown_fact_is_neither_a_violation_nor_clear_compliance(state):
    rule({"field": "facts.outerwear.construction.snapshot", "operator": "eq", "value": 5})
    Database.execute("UPDATE attribute_values SET state=?", (state,))
    result = client.post("/api/v3/outfits/validate", json=spec()).json()
    assert result["status"] == "not_evaluated"
    assert result["evaluated_rule_count"] == 0
    assert result["unevaluated_rule_ids"] == ["example_rule"]
    assert result["violations"] == []


def test_known_without_matching_evidence_does_not_prove_compliance():
    rule({"field": "facts.outerwear.construction.snapshot", "operator": "neq", "value": 5})
    Database.execute("UPDATE attribute_values SET assertion_ids_json='[]'")
    assert client.post("/api/v3/outfits/validate", json=spec()).json()["status"] == "not_evaluated"


def test_multiple_values_are_evaluated_as_set_without_overwriting_first():
    rule({"field": "facts.outerwear.construction.snapshot", "operator": "contains", "value": 5})
    Database.execute("UPDATE attribute_definitions SET cardinality='multiple'")
    Database.execute("INSERT INTO cultural_assertions_v3(id,subject_id,predicate,value_json,review_status) VALUES('second_claim','snapshot_garment','construction.snapshot','7','published')")
    Database.execute("INSERT INTO assertion_evidence_v3(id,assertion_id,source_id,locator) VALUES('second_evidence','second_claim','snapshot_source','Example section 2')")
    Database.execute("INSERT INTO attribute_values(id,entity_id,attribute_key,state,value_json,assertion_ids_json) VALUES('second_fact','snapshot_garment','construction.snapshot','known','7','[\"second_claim\"]')")
    result = client.post("/api/v3/outfits/validate", json=spec()).json()
    assert result["status"] == "warning"
    assert result["violations"][0]["rule_id"] == "example_rule"


def test_legacy_mapping_comes_from_records_and_never_invents_render_id():
    Database.execute("INSERT INTO legacy_entity_mappings_v3(legacy_table,legacy_id,entity_id) VALUES('items','legacy_one','snapshot_garment')")
    Database.execute("INSERT INTO legacy_entity_mappings_v3(legacy_table,legacy_id,entity_id) VALUES('items','hidden','draft_garment')")
    before = client.get("/api/v3/legacy-mappings").json()["mappings"]
    assert len(before) == 1 and before[0]["renderable_item_id"] is None
    Database.execute("UPDATE renderable_items_v3 SET metadata_json='{\"legacy_item_id\":\"legacy_one\"}'")
    Database.execute("UPDATE renderable_variants_v3 SET style_json='{\"legacy_variant_id\":\"legacy_red\"}'")
    mapping = client.get("/api/v3/legacy-mappings").json()["mappings"][0]
    assert mapping["canonical_entity_id"] == "snapshot_garment"
    assert mapping["renderable_item_id"] == "render_one"
    assert mapping["render_variants"] == {"legacy_red": "variant_one"}
