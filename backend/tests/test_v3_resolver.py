"""Resolve real database graphs; fixtures are examples, not historical claims."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Database
from app.modules.cultural_data_v3.domain.models import AttributeDefinition, AttributeValue, Entity, EntityRelation, RelationDefinition
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository as Repo
from app.modules.cultural_data_v3.services.projections import GenerationProfileBuilder
from app.modules.cultural_data_v3.services.resolver import EffectiveEntityResolver

resolver = EffectiveEntityResolver()
client = TestClient(app)
KEY = "construction.resolver_test"


def entity(id, type="garment", status="published"):
    Repo.add_entity(Entity(id=id, entity_type=type, identity={"name_vi": id}, status=status))


def fact(id, owner, value=None, *, state="known", qualifiers=None, key=KEY, candidates=None):
    Repo.add_attribute_value(AttributeValue(id=id, entity_id=owner, attribute_key=key, state=state, value=value, qualifiers=qualifiers or {}, candidate_values=candidates or []))


def edge(id, child, parent, *, state="known", qualifiers=None, kind="variant_of"):
    Repo.add_relation(EntityRelation(id=id, subject_id=child, object_id=parent, relation_type=kind, state=state, qualifiers=qualifiers or {}))


@pytest.fixture(autouse=True)
def graph():
    for id, type in [("base", "garment"), ("variant", "garment_variant"), ("other", "garment"), ("p1", "period"), ("p2", "period"), ("r1", "region")]:
        entity(id, type)
    Repo.add_attribute_definition(AttributeDefinition(key=KEY, label_vi="Example", value_type="string", applies_to=["garment", "garment_variant"], status="active"))
    Repo.add_relation_definition(RelationDefinition(key="variant_of", label_vi="Example", source_types=["garment", "garment_variant"], target_types=["garment", "garment_variant"], status="active", inheritable=False))


def test_context_does_not_promote_period_fact_to_universal_constraint():
    fact("general", "base", "general")
    fact("p1_fact", "base", "period-one", qualifiers={"period_ids": ["p1"]})
    fact("p2_fact", "base", "period-two", qualifiers={"period_ids": ["p2"]})
    assert resolver.resolve("base")["attributes"][0]["value"] == "general"
    assert resolver.resolve("base", {"period_ids": ["p1"]})["attributes"][0]["value"] == "period-one"
    assert resolver.resolve("base", {"period_ids": ["p2"]})["attributes"][0]["value"] == "period-two"
    assert resolver.resolve("base", {"period_ids": ["p1", "p2"]})["attributes"][0]["value"] == "general"
    # Education without selected context browses all scoped facts.
    assert len(client.get("/api/v3/entities/base/education").json()["attributes"]) == 3
    scoped = client.get("/api/v3/entities/base/education?period_ids=p1").json()
    assert [a["value"] for a in scoped["attributes"]] == ["period-one"]


def test_inherited_fact_records_path_and_direct_unknown_masks_parent():
    edge("parent", "variant", "base")
    fact("base_fact", "base", "inherited")
    result = resolver.resolve("variant")["attributes"][0]
    assert result["value"] == "inherited"
    assert result["provenance"][0]["entity_path"] == ["variant", "base"]
    assert result["provenance"][0]["relation_path"] == ["parent"]
    fact("unknown", "variant", state="unknown")
    assert resolver.resolve("variant")["attributes"][0]["state"] == "unknown"
    profile = GenerationProfileBuilder(resolver).build("variant")
    assert profile["must_preserve"] == []
    assert profile["unresolved"][0]["state"] == "unknown"


def test_non_inheritable_fact_does_not_propagate():
    edge("parent", "variant", "base")
    fact("base_fact", "base", "only-base")
    Database.execute("UPDATE attribute_definitions SET inheritable=0 WHERE key=?", (KEY,))
    assert resolver.resolve("variant")["attributes"] == []


def test_equal_priority_conflict_preserves_candidates_and_never_becomes_invariant():
    edge("parent_a", "variant", "base")
    edge("parent_b", "variant", "other")
    fact("a", "base", "a")
    fact("b", "other", "b")
    result = resolver.resolve("variant")["attributes"][0]
    assert result["state"] == "disputed" and result["value"] is None
    assert {c["value"] for c in result["candidate_values"]} == {"a", "b"}
    assert {p["entity_id"] for p in result["provenance"]} == {"base", "other"}
    assert GenerationProfileBuilder(resolver).build("variant")["must_preserve"] == []
    spec = {"dataset_version": "dev", "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "variant"}]}
    grounding = client.post("/api/v3/generation/grounding", json=spec).json()["grounding"]
    assert grounding["unresolved"][0]["state"] == "disputed"
    assert grounding["unresolved"][0]["selection_id"] == "s1"


def test_context_partial_order_keeps_incomparable_facts_disputed():
    fact("period", "base", "a", qualifiers={"period_ids": ["p1"]})
    fact("region", "base", "b", qualifiers={"region_ids": ["r1"]})
    context = {"period_ids": ["p1"], "region_ids": ["r1"]}
    assert resolver.resolve("base", context)["attributes"][0]["state"] == "disputed"
    fact("combined", "base", "specific", qualifiers=context)
    assert resolver.resolve("base", context)["attributes"][0]["value"] == "specific"


def test_scoped_parent_link_requires_context_and_keeps_scope_on_inherited_fact():
    edge("parent", "variant", "base", qualifiers={"period_ids": ["p1"]})
    fact("base_fact", "base", "scoped-through-edge")
    assert resolver.resolve("variant")["attributes"] == []
    assert resolver.resolve("variant", {"period_ids": ["p2"]})["attributes"] == []
    value = resolver.resolve("variant", {"period_ids": ["p1"]})["attributes"][0]
    assert value["qualifiers"] == {"period_ids": ["p1"]}


@pytest.mark.parametrize("state", ["unknown", "inferred", "disputed"])
def test_uncertain_parent_link_is_not_traversed(state):
    edge("parent", "variant", "base", state=state)
    fact("base_fact", "base", "no-inference")
    assert resolver.resolve("variant")["attributes"] == []


def test_withdrawn_ancestor_cannot_leak_through_previously_resolved_variant():
    edge("parent", "variant", "base")
    fact("base_fact", "base", "private-after-withdrawal")
    assert resolver.resolve("variant")["attributes"]
    Database.execute("UPDATE entity_registry SET status='draft' WHERE id='base'")
    value = resolver.resolve("variant")
    assert value["attributes"] == [] and value["relations"] == []


def test_withheld_child_masks_known_parent_without_payload_or_candidate_leak():
    edge("parent", "variant", "base")
    fact("base_fact", "base", "secret")
    fact("child_fact", "variant", state="withheld")
    value = resolver.resolve("variant")["attributes"][0]
    assert value["state"] == "withheld" and value["value"] is None
    assert value["candidate_values"] == []
    assert "secret" not in str(value)


def test_cycle_is_controlled_error_but_diamond_keeps_both_paths():
    edge("up", "variant", "base")
    edge("down", "base", "variant")
    response = client.get("/api/v3/generation/profiles/variant")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "INHERITANCE_CYCLE"
    Database.execute("DELETE FROM entity_relations WHERE id='down'")
    entity("ancestor")
    edge("branch", "variant", "other")
    edge("left_join", "base", "ancestor")
    edge("right_join", "other", "ancestor")
    fact("base_fact", "ancestor", "common")
    resolved = resolver.resolve("variant")["attributes"][0]
    assert resolved["value"] == "common"
    assert {tuple(p["entity_path"]) for p in resolved["provenance"]} == {("variant", "base", "ancestor"), ("variant", "other", "ancestor")}


def test_generation_endpoint_uses_variant_inheritance_and_outfit_context():
    edge("parent", "variant", "base")
    fact("p1_fact", "base", "period-one", qualifiers={"period_ids": ["p1"]})
    Database.execute("INSERT INTO cultural_sources_v3(id,source_type,title,accessed_at,review_status) VALUES('resolver_source','example','Synthetic example','2026-09-19','published')")
    Database.execute("INSERT INTO cultural_assertions_v3(id,subject_id,predicate,value_json,review_status) VALUES('resolver_claim','base',?,'\"period-one\"','published')", (KEY,))
    Database.execute("INSERT INTO assertion_evidence_v3(id,assertion_id,source_id,locator) VALUES('resolver_evidence','resolver_claim','resolver_source','Example section')")
    Database.execute("UPDATE attribute_values SET assertion_ids_json='[\"resolver_claim\"]' WHERE id='p1_fact'")
    spec = {"dataset_version": "dev", "context": {"period_ids": ["p1"]}, "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "base", "canonical_variant_id": "variant"}]}
    response = client.post("/api/v3/generation/grounding", json=spec)
    assert response.status_code == 200, response.text
    constraint = response.json()["grounding"]["must_preserve"][0]
    assert constraint["value"] == "period-one" and constraint["selection_id"] == "s1"
    assert constraint["provenance"][0]["entity_path"] == ["variant", "base"]
    spec["context"] = {}
    assert client.post("/api/v3/generation/grounding", json=spec).json()["grounding"]["must_preserve"] == []


def test_malformed_context_is_422():
    response = client.post("/api/v3/generation/grounding", json={"dataset_version": "dev", "context": {"period_ids": "p1"}, "selections": [{"selection_id": "s1", "slot": "outerwear", "canonical_entity_id": "base"}]})
    assert response.status_code == 422


@pytest.mark.parametrize("ids", [["missing"], ["base"], ["p1"]])
def test_unknown_wrong_type_or_unpublished_context_is_not_accepted(ids):
    Database.execute("UPDATE entity_registry SET status='draft' WHERE id='p1'")
    response = client.get("/api/v3/generation/profiles/base", params={"period_ids": ids})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_CONTEXT"


def test_narrower_context_dominates_broader_context_without_sort_order_bias():
    fact("a_broad", "base", "broad", qualifiers={"period_ids": ["p1", "p2"]})
    fact("z_narrow", "base", "narrow", qualifiers={"period_ids": ["p1"]})
    assert resolver.resolve("base", {"period_ids": ["p1"]})["attributes"][0]["value"] == "narrow"
    assert resolver.resolve("base", {"period_ids": ["p2"]})["attributes"][0]["value"] == "broad"


def test_multiple_cardinality_keeps_additive_values_and_inherited_relations_obey_flag():
    Database.execute("UPDATE attribute_definitions SET cardinality='multiple' WHERE key=?", (KEY,))
    edge("parent", "variant", "base")
    fact("parent_value", "base", "a")
    fact("child_value", "variant", "b")
    Repo.add_relation_definition(RelationDefinition(key="example_link", label_vi="Example", source_types=["garment"], target_types=["garment"], status="active", inheritable=True))
    edge("linked", "base", "other", kind="example_link")
    resolved = resolver.resolve("variant")
    assert {a["value"] for a in resolved["attributes"]} == {"a", "b"}
    assert any(r["id"] == "linked" and r["provenance"][0]["entity_path"] == ["variant", "base"] for r in resolved["relations"])
    Database.execute("UPDATE relation_definitions SET inheritable=0 WHERE key='example_link'")
    assert all(r["id"] != "linked" for r in resolver.resolve("variant")["relations"])


def test_graph_depth_limit_returns_controlled_error():
    previous = "base"
    for i in range(34):
        current = f"ancestor_{i}"
        entity(current)
        edge(f"link_{i}", previous, current)
        previous = current
    response = client.get("/api/v3/generation/profiles/base")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "RESOLUTION_LIMIT"
