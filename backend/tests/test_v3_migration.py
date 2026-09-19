"""Tests for V3 database migrations and repository registry enforcement."""
import pytest
from app.core.database import get_db_connection, init_database
from app.modules.cultural_data_v3.domain.models import (
    AttributeDefinition,
    AttributeValue,
    Entity,
    EntityRelation,
    RelationDefinition,
)
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database has all migrations applied."""
    init_database(seed=True)
    yield


def test_v3_tables_exist():
    """Verify all 15 new V3 tables exist in the database."""
    expected_v3_tables = {
        # 008_cultural_data_v3 (11 tables)
        "entity_registry",
        "attribute_definitions",
        "attribute_values",
        "relation_definitions",
        "entity_relations",
        "cultural_sources_v3",
        "cultural_assertions_v3",
        "assertion_evidence_v3",
        "cultural_media_bindings_v3",
        "dataset_snapshots_v3",
        "legacy_entity_mappings_v3",
        # 009_render_generation_v3 (4 tables)
        "renderable_items_v3",
        "renderable_variants_v3",
        "render_profiles_v3",
        "generation_profiles_v3",
    }

    with get_db_connection() as conn:
        tables = {
            r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        for table in expected_v3_tables:
            assert table in tables, f"V3 table '{table}' is missing from database schema"


def test_v1_legacy_tables_unmodified():
    """Verify key V1 tables still exist and maintain integrity."""
    expected_v1_tables = {
        "garment_types",
        "occasions",
        "items",
        "item_variants",
        "item_occasions",
        "avatars",
        "asset_layers",
        "media_assets",
        "heritage_sources",
        "heritage_articles",
        "cultural_rules",
        "outfits",
        "outfit_versions",
        "lookbooks",
    }
    with get_db_connection() as conn:
        tables = {
            r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        for table in expected_v1_tables:
            assert table in tables, f"V1 table '{table}' was unexpectedly removed"


def test_repository_registry_enforcement():
    """Verify repository enforces registry rules on attribute definitions and values."""
    repo = CulturalDataV3Repository()

    # 1. Add canonical entity
    entity = Entity(
        id="garment_ao_dai_migration_test",
        entity_type="garment",
        identity={"name_vi": "Áo dài test"},
    )
    repo.add_entity(entity)

    # 2. Add attribute definition for garment only
    attr_def = AttributeDefinition(
        key="test.collar_height",
        label_vi="Chiều cao cổ áo",
        value_type="number",
        applies_to=["garment"],
    )
    repo.add_attribute_definition(attr_def)

    # 3. Valid attribute value succeeds
    val = AttributeValue(
        id="av_test_collar_1",
        entity_id="garment_ao_dai_migration_test",
        attribute_key="test.collar_height",
        state="known",
        value=3.5,
    )
    repo.add_attribute_value(val)

    retrieved = repo.values_for("garment_ao_dai_migration_test")
    assert any(a["attribute_key"] == "test.collar_height" for a in retrieved)

    # 4. Unknown attribute key rejected
    bad_val = AttributeValue(
        id="av_test_bad_key",
        entity_id="garment_ao_dai_migration_test",
        attribute_key="nonexistent.key",
        state="not_collected",
    )
    with pytest.raises(ValueError, match="Unknown attribute key"):
        repo.add_attribute_value(bad_val)


def test_repository_relation_enforcement():
    """Verify repository enforces source/target entity types on relations."""
    repo = CulturalDataV3Repository()

    g1 = Entity(id="g_parent", entity_type="garment", identity={"name_vi": "Parent"})
    g2 = Entity(id="g_child", entity_type="garment_variant", identity={"name_vi": "Child"})
    p1 = Entity(id="p_nguyen", entity_type="period", identity={"name_vi": "Triều Nguyễn"})

    for e in [g1, g2, p1]:
        try:
            repo.add_entity(e)
        except Exception:
            pass

    rel_def = RelationDefinition(
        key="test_variant_of",
        label_vi="Biến thể của",
        source_types=["garment_variant"],
        target_types=["garment"],
    )
    repo.add_relation_definition(rel_def)

    # Valid: garment_variant -> garment
    valid_rel = EntityRelation(
        id="rel_valid_1",
        subject_id="g_child",
        relation_type="test_variant_of",
        object_id="g_parent",
    )
    repo.add_relation(valid_rel)
    assert len(repo.relations_from("g_child")) >= 1

    # Invalid: period -> garment (invalid source)
    invalid_rel = EntityRelation(
        id="rel_invalid_1",
        subject_id="p_nguyen",
        relation_type="test_variant_of",
        object_id="g_parent",
    )
    with pytest.raises(ValueError, match="not a valid source"):
        repo.add_relation(invalid_rel)


def test_legacy_entity_mapping():
    """Verify legacy_entity_mappings_v3 links legacy items to canonical entities."""
    repo = CulturalDataV3Repository()

    entity = Entity(
        id="garment_legacy_mapped",
        entity_type="garment",
        identity={"name_vi": "Canonical Mapped Item"},
    )
    try:
        repo.add_entity(entity)
    except Exception:
        pass

    repo.create_legacy_mapping(
        legacy_table="items",
        legacy_id="item_legacy_123",
        entity_id="garment_legacy_mapped",
        mapping_kind="identity",
    )

    resolved = repo.get_entity_by_legacy("items", "item_legacy_123")
    assert resolved is not None
    assert resolved["id"] == "garment_legacy_mapped"
