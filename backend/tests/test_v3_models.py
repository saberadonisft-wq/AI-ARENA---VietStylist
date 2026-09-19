"""Tests for V3 cultural data meta-model contracts and validators."""
import pytest
from app.modules.cultural_data_v3.domain.models import (
    AttributeValue,
    Entity,
    AttributeDefinition,
    EntityRelation,
    RelationDefinition,
    OutfitSpecV2,
    OutfitSelection,
    ContextQualifier,
)
from app.modules.cultural_data_v3.domain.validators import (
    validate_attribute_value,
    validate_relation,
)


# --- Missing-state semantics ---

def test_known_requires_value():
    with pytest.raises(ValueError, match="known"):
        AttributeValue(
            id="av1", entity_id="e1",
            attribute_key="material.primary",
            state="known", value=None,
        )


def test_disputed_requires_candidates():
    with pytest.raises(ValueError, match="disputed"):
        AttributeValue(
            id="av2", entity_id="e1",
            attribute_key="material.primary",
            state="disputed", candidate_values=[],
        )


def test_known_with_value_passes():
    av = AttributeValue(
        id="av3", entity_id="e1",
        attribute_key="construction.closure.direction",
        state="known", value="right_over_left",
    )
    assert av.value == "right_over_left"


def test_not_collected_allows_null_value():
    av = AttributeValue(
        id="av4", entity_id="e1",
        attribute_key="material.primary",
        state="not_collected", value=None,
    )
    assert av.state == "not_collected"


def test_disputed_with_candidates_passes():
    av = AttributeValue(
        id="av5", entity_id="e1",
        attribute_key="material.primary",
        state="disputed",
        candidate_values=[
            {"value": "silk", "assertion_ids": ["a1"]},
            {"value": "cotton", "assertion_ids": ["a2"]},
        ],
    )
    assert len(av.candidate_values) == 2


# --- Registry validation ---

def test_unknown_attribute_key_rejected():
    entity = Entity(
        id="e1", entity_type="garment",
        identity={"name_vi": "Test"},
    )
    value = AttributeValue(
        id="av1", entity_id="e1",
        attribute_key="nonexistent.key",
        state="not_collected",
    )
    errors = validate_attribute_value(value, definition=None, entity=entity)
    assert any("Unknown attribute key" in e for e in errors)


def test_attribute_wrong_entity_type_rejected():
    entity = Entity(
        id="e1", entity_type="period",
        identity={"name_vi": "Triều Nguyễn"},
    )
    definition = AttributeDefinition(
        key="construction.closure.direction",
        label_vi="Hướng khép vạt",
        value_type="enum",
        applies_to=["garment", "garment_variant"],
    )
    value = AttributeValue(
        id="av1", entity_id="e1",
        attribute_key="construction.closure.direction",
        state="not_collected",
    )
    errors = validate_attribute_value(value, definition=definition, entity=entity)
    assert any("does not apply" in e for e in errors)


def test_valid_attribute_value_passes():
    entity = Entity(
        id="e1", entity_type="garment",
        identity={"name_vi": "Áo ngũ thân"},
    )
    definition = AttributeDefinition(
        key="construction.closure.direction",
        label_vi="Hướng khép vạt",
        value_type="enum",
        allowed_values=["right_over_left", "left_over_right"],
        applies_to=["garment", "garment_variant"],
    )
    value = AttributeValue(
        id="av1", entity_id="e1",
        attribute_key="construction.closure.direction",
        state="known", value="right_over_left",
    )
    errors = validate_attribute_value(value, definition=definition, entity=entity)
    assert errors == []


def test_enum_value_not_in_allowed_rejected():
    entity = Entity(
        id="e1", entity_type="garment",
        identity={"name_vi": "Test"},
    )
    definition = AttributeDefinition(
        key="construction.closure.direction",
        label_vi="Hướng khép vạt",
        value_type="enum",
        allowed_values=["right_over_left", "left_over_right"],
        applies_to=["garment"],
    )
    value = AttributeValue(
        id="av1", entity_id="e1",
        attribute_key="construction.closure.direction",
        state="known", value="upside_down",
    )
    errors = validate_attribute_value(value, definition=definition, entity=entity)
    assert any("not in allowed_values" in e for e in errors)


# --- Relation validation ---

def test_unknown_relation_type_rejected():
    subject = Entity(id="s1", entity_type="garment_variant", identity={"name_vi": "A"})
    obj = Entity(id="o1", entity_type="garment", identity={"name_vi": "B"})
    rel = EntityRelation(
        id="r1", subject_id="s1",
        relation_type="nonexistent_relation",
        object_id="o1",
    )
    errors = validate_relation(rel, definition=None, subject=subject, obj=obj)
    assert any("Unknown relation type" in e for e in errors)


def test_invalid_relation_source_type_rejected():
    subject = Entity(id="s1", entity_type="period", identity={"name_vi": "Nguyễn"})
    obj = Entity(id="o1", entity_type="garment", identity={"name_vi": "Áo ngũ thân"})
    definition = RelationDefinition(
        key="regional_variant_of",
        label_vi="Biến thể vùng của",
        source_types=["garment_variant"],
        target_types=["garment"],
    )
    rel = EntityRelation(
        id="r1", subject_id="s1",
        relation_type="regional_variant_of",
        object_id="o1",
    )
    errors = validate_relation(rel, definition=definition, subject=subject, obj=obj)
    assert any("not a valid source" in e for e in errors)


def test_valid_relation_passes():
    subject = Entity(id="s1", entity_type="garment_variant", identity={"name_vi": "Ngũ thân Huế"})
    obj = Entity(id="o1", entity_type="garment", identity={"name_vi": "Áo ngũ thân"})
    definition = RelationDefinition(
        key="regional_variant_of",
        label_vi="Biến thể vùng của",
        source_types=["garment_variant"],
        target_types=["garment"],
    )
    rel = EntityRelation(
        id="r1", subject_id="s1",
        relation_type="regional_variant_of",
        object_id="o1",
    )
    errors = validate_relation(rel, definition=definition, subject=subject, obj=obj)
    assert errors == []


# --- OutfitSpecV2 ---

def test_outfit_spec_v2_creation():
    spec = OutfitSpecV2(
        dataset_version="dev",
        selections=[
            OutfitSelection(
                selection_id="sel_1",
                slot="outerwear",
                canonical_entity_id="garment_ngu_than",
            ),
        ],
    )
    assert spec.schema_version == "2.0"
    assert len(spec.selections) == 1


def test_context_qualifier_defaults():
    cq = ContextQualifier()
    assert cq.period_ids == []
    assert cq.region_ids == []
