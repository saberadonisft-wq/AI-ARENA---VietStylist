"""The external pilot packages import without bypassing editorial review."""
from app.core.database import Database
from app.modules.cultural_data_v3.importers.pilot_packages import (
    activate_pilot_packages_for_local_demo,
    import_pilot_packages,
    load_pilot_package,
    validate_pilot_package,
)


TABLES = {
    "entities": "entity_registry",
    "attribute_definitions": "attribute_definitions",
    "attribute_values": "attribute_values",
    "sources": "cultural_sources_v3",
    "assertions": "cultural_assertions_v3",
    "relation_definitions": "relation_definitions",
    "relations": "entity_relations",
    "rules": "cultural_rules_v3",
    "generation_profiles": "generation_profiles_v3",
}


def count(table):
    return Database.fetch_one(f"SELECT COUNT(*) AS count FROM {table}")["count"]


def test_both_packages_validate_import_and_reimport_without_duplication():
    packages = [load_pilot_package("ao-dai"), load_pilot_package("ao-tu-than")]
    for package in packages:
        validate_pilot_package(package)

    reports = import_pilot_packages()
    assert [report["dataset_version"] for report in reports] == ["ao-dai-pilot-1", "ao-tu-than-pilot-1"]
    expected = {
        section: sum(len(package[section]) for package in packages)
        for section in TABLES
    }
    assert {section: count(table) for section, table in TABLES.items()} == expected
    assert count("media_assets") == 0

    assert {row["status"] for row in Database.fetch_all("SELECT DISTINCT status FROM entity_registry")} == {"under_review"}
    assert {row["review_status"] for row in Database.fetch_all("SELECT DISTINCT review_status FROM cultural_sources_v3")} == {"under_review"}
    assert {row["review_status"] for row in Database.fetch_all("SELECT DISTINCT review_status FROM cultural_assertions_v3")} == {"under_review"}
    assert {row["status"] for row in Database.fetch_all("SELECT DISTINCT status FROM cultural_rules_v3")} == {"draft"}
    assert all(row["reference_media_ids_json"] == [] for row in Database.fetch_all("SELECT reference_media_ids_json FROM generation_profiles_v3"))

    ao_dai = Database.fetch_one("SELECT extensions_json FROM entity_registry WHERE id='variant_ao_dai_modern_classic'")
    assert ao_dai["extensions_json"]["pilot_import"]["dataset_version"] == "ao-dai-pilot-1"
    assert ao_dai["extensions_json"]["generation_profile_imports"][0]["generation_ready"] is False
    ao_tu_than = Database.fetch_one("SELECT extensions_json FROM entity_registry WHERE id='garment_ao_tu_than'")
    assert ao_tu_than["extensions_json"]["media_candidates"][0]["may_use_for_ai_reference"] is False

    before = {table: count(table) for table in TABLES.values()}
    second = import_pilot_packages()
    assert all(
        value == 0
        for report in second
        for key, value in report["inserted"].items()
        if key not in {"media_candidates_retained"}
    )
    assert {table: count(table) for table in TABLES.values()} == before


def test_import_preserves_existing_entity_and_additively_merges_registry_values():
    Database.execute(
        """INSERT INTO entity_registry(id,entity_type,identity_json,status,version)
        VALUES('region_hue','region','{\"name_vi\":\"Tên đã biên tập\"}','published',7)"""
    )
    Database.execute(
        """INSERT INTO attribute_definitions
        (key,label_vi,value_type,cardinality,allowed_values_json,applies_to_json,status)
        VALUES('construction.collar.type','Nhãn đã biên tập','enum','single','[\"standing\"]','[\"garment\"]','active')"""
    )

    report = import_pilot_packages(["ao-dai"])[0]
    region = Database.fetch_one("SELECT * FROM entity_registry WHERE id='region_hue'")
    assert region["identity_json"] == {"name_vi": "Tên đã biên tập"}
    assert region["status"] == "published" and region["version"] == 7

    definition = Database.fetch_one("SELECT * FROM attribute_definitions WHERE key='construction.collar.type'")
    assert definition["label_vi"] == "Nhãn đã biên tập"
    assert definition["allowed_values_json"][0] == "standing"
    assert "standing_high" in definition["allowed_values_json"]
    assert report["inserted"]["entities"] == 25
    assert report["inserted"]["merged_attribute_definitions"] == 1


def test_explicit_local_demo_activation_publishes_only_pilot_records():
    import_pilot_packages()
    counts = activate_pilot_packages_for_local_demo()

    assert counts["entities"] > 0
    assert {row["status"] for row in Database.fetch_all("SELECT DISTINCT status FROM entity_registry")} == {"published"}
    assert {row["review_status"] for row in Database.fetch_all("SELECT DISTINCT review_status FROM cultural_sources_v3")} == {"published"}
    assert {row["review_status"] for row in Database.fetch_all("SELECT DISTINCT review_status FROM cultural_assertions_v3")} == {"published"}
    assert {row["status"] for row in Database.fetch_all("SELECT DISTINCT status FROM cultural_rules_v3")} == {"published"}

    from app.modules.cultural_data_v3.repository import CulturalDataV3Repository
    from app.modules.cultural_data_v3.services.projections import GenerationProfileBuilder
    from app.modules.cultural_data_v3.services.resolver import EffectiveEntityResolver

    profile = GenerationProfileBuilder(
        EffectiveEntityResolver(CulturalDataV3Repository())
    ).build("variant_ao_dai_modern_classic")
    constraints = {item["feature"]: item["value"] for item in profile["must_preserve"]}
    assert constraints["garment_identity"] == "Vietnamese áo dài"
    assert constraints["construction.sleeve.assembly"] == "raglan"
    assert constraints["construction.tail.count"] == 2
    assert profile["evidence"]
