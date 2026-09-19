"""Citation projection checks using synthetic source metadata, not real claims."""
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from app.modules.cultural_data_v3.domain.models import AttributeDefinition, AttributeValue, Entity, EntityRelation, RelationDefinition
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository as Repo

client = TestClient(app)


@pytest.fixture(autouse=True)
def evidence_graph():
    for id, type in [("evidence_base", "garment"), ("evidence_variant", "garment_variant"), ("evidence_period", "period")]:
        Repo.add_entity(Entity(id=id, entity_type=type, identity={"name_vi": "Synthetic example"}, status="published"))
    Repo.add_attribute_definition(AttributeDefinition(key="construction.evidence", label_vi="Example", value_type="number", applies_to=["garment"], status="active"))
    Database.execute("INSERT INTO cultural_sources_v3(id,source_type,title,accessed_at,rights_json,review_status) VALUES('example_source','example','Synthetic title','2026-09-19',?,'published')", (json.dumps({"public_excerpt": True, "ai_reference_allowed": False}),))
    Database.execute("INSERT INTO cultural_assertions_v3(id,subject_id,predicate,value_json,statement_vi,review_status) VALUES('example_claim','evidence_base','construction.evidence','5','DO NOT COPY SOURCE BODY','published')")
    Database.execute("INSERT INTO assertion_evidence_v3(id,assertion_id,source_id,locator) VALUES('example_evidence','example_claim','example_source','Synthetic section 2')")
    Repo.add_attribute_value(AttributeValue(id="example_fact", entity_id="evidence_base", attribute_key="construction.evidence", state="known", value=5, assertion_ids=["example_claim"]))
    Repo.add_relation_definition(RelationDefinition(key="variant_of", label_vi="Example", source_types=["garment_variant"], target_types=["garment"], inheritable=False, status="active"))
    Repo.add_relation(EntityRelation(id="example_parent", subject_id="evidence_variant", relation_type="variant_of", object_id="evidence_base"))


def test_public_projections_include_exact_locator_rights_and_inherited_citation():
    for path in ["entities/evidence_base/education", "composer/bundles/evidence_variant", "generation/profiles/evidence_variant"]:
        response = client.get("/api/v3/" + path)
        assert response.status_code == 200
        citation = response.json()["evidence"][0]
        assert citation["assertion_id"] == "example_claim"
        source = citation["sources"][0]
        assert source["source_id"] == "example_source"
        assert source["locator"] == "Synthetic section 2"
        assert source["rights"] == {"public_excerpt": True, "ai_reference_allowed": False}
        assert "DO NOT COPY SOURCE BODY" not in response.text


@pytest.mark.parametrize("target", ["source", "assertion", "context"])
def test_withdrawing_evidence_removes_fact_and_citation_on_next_request(target):
    path = "/api/v3/generation/profiles/evidence_variant"
    assert client.get(path).json()["evidence"]
    if target == "source":
        Database.execute("UPDATE cultural_sources_v3 SET review_status='draft' WHERE id='example_source'")
    elif target == "assertion":
        Database.execute("UPDATE cultural_assertions_v3 SET review_status='draft' WHERE id='example_claim'")
    else:
        Database.execute("UPDATE cultural_assertions_v3 SET qualifiers_json=? WHERE id='example_claim'", (json.dumps({"period_ids": ["evidence_period"]}),))
        Database.execute("UPDATE entity_registry SET status='draft' WHERE id='evidence_period'")
    projection = client.get(path).json()
    assert projection["evidence"] == []
    assert projection["must_preserve"] == []


def test_withheld_fact_does_not_publish_its_citation():
    Database.execute("UPDATE attribute_values SET state='withheld' WHERE id='example_fact'")
    data = client.get("/api/v3/entities/evidence_base/education").json()
    assert data["attributes"][0]["state"] == "withheld"
    assert data["evidence"] == []


def test_grounding_keeps_citation_metadata_without_granting_reference_rights():
    response = client.post("/api/v3/generation/grounding", json={"dataset_version": "dev", "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "evidence_base", "canonical_variant_id": "evidence_variant"}]})
    assert response.status_code == 200
    data = response.json()["grounding"]
    assert data["evidence"][0]["sources"][0]["locator"] == "Synthetic section 2"
    assert data["reference_media_ids"] == []
    assert data["must_preserve"][0]["assertion_ids"] == ["example_claim"]


def test_unqualified_fact_cannot_expand_scope_of_supporting_evidence():
    Database.execute("UPDATE cultural_assertions_v3 SET qualifiers_json=? WHERE id='example_claim'", (json.dumps({"period_ids": ["evidence_period"]}),))
    path = "/api/v3/generation/profiles/evidence_variant"
    assert client.get(path).json()["must_preserve"] == []
    scoped = client.get(path, params={"period_ids": "evidence_period"}).json()
    assert scoped["must_preserve"][0]["qualifiers"] == {"period_ids": ["evidence_period"]}
    assert scoped["evidence"][0]["qualifiers"] == {"period_ids": ["evidence_period"]}


@pytest.mark.parametrize("change,reason", [
    ("UPDATE cultural_assertions_v3 SET consensus='disputed'", "uncertain_evidence"),
    ("UPDATE cultural_assertions_v3 SET predicate='construction.different'", "mismatched_evidence"),
    ("UPDATE cultural_assertions_v3 SET value_json='9'", "mismatched_evidence"),
    ("UPDATE assertion_evidence_v3 SET locator=''", "missing_evidence_locator"),
    ("UPDATE attribute_values SET assertion_ids_json='[]'", "missing_evidence"),
])
def test_unsupported_known_fact_is_not_promoted_to_hard_constraint(change, reason):
    Database.execute(change)
    data = client.get("/api/v3/generation/profiles/evidence_variant").json()
    assert data["must_preserve"] == []
    assert data["unresolved"][0]["state"] == "known"
    assert data["unresolved"][0]["reason"] == reason
    assert data["unresolved"][0]["generation_status"] == "not_evaluated"
