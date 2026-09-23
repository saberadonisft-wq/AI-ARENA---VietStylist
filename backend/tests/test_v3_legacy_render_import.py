"""Legacy render import preserves editorial decisions and actual geometry."""
import json
import xml.etree.ElementTree as ET
import pytest
from app.core.database import Database
from app.modules.media.validation import validate_svg
from app.modules.cultural_data_v3.domain.models import Entity
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository as Repo
from scripts.migrate_legacy_to_v3 import run_legacy_migration


def test_import_uses_curated_mapping_and_copies_variants_and_profiles():
    item = Database.fetch_one("SELECT * FROM items ORDER BY id LIMIT 1")
    Repo.add_entity(Entity(id="curated_import", entity_type="garment_variant", identity={"name_vi": "Reviewed example"}, status="published"))
    Repo.create_legacy_mapping("items", item["id"], "curated_import", "catalog_item")
    result = run_legacy_migration()
    assert result["variants"] > 0 and result["profiles"] > 0
    render = Database.fetch_one("SELECT * FROM renderable_items_v3 WHERE id=?", (f"renderable_{item['id']}",))
    assert render["canonical_entity_id"] == "curated_import"
    metadata = render["metadata_json"]
    assert (json.loads(metadata) if isinstance(metadata, str) else metadata)["legacy_item_id"] == item["id"]
    for layer in Database.fetch_all("SELECT * FROM asset_layers WHERE item_id=?", (item["id"],)):
        profile = Database.fetch_one("SELECT * FROM render_profiles_v3 WHERE id=?", (f"render_profile_{layer['id']}",))
        validate_svg(profile["svg_content"].encode("utf-8"))
        legacy_root = ET.fromstring(layer["svg_content"])
        profile_root = ET.fromstring(profile["svg_content"])
        shape_tags = {"path", "rect", "circle", "ellipse", "line", "polyline", "polygon"}
        legacy_shapes = [node for node in legacy_root.iter() if node.tag.rsplit("}", 1)[-1] in shape_tags]
        profile_shapes = [node for node in profile_root.iter() if node.tag.rsplit("}", 1)[-1] in shape_tags]
        assert len(profile_shapes) == len(legacy_shapes)
        assert profile["avatar_id"] == layer["avatar_id"]
        assert profile["variant_id"] == (f"render_variant_{layer['variant_id']}" if layer["variant_id"] else None)
        transform = profile["transform_json"]
        if isinstance(transform, str):
            transform = json.loads(transform)
        assert transform["anchor_x"] == layer["anchor_x"]
        assert transform["scale_y"] == layer["scale_y"]

    for profile in Database.fetch_all("SELECT svg_content FROM render_profiles_v3 WHERE svg_content IS NOT NULL"):
        validate_svg(profile["svg_content"].encode("utf-8"))


def test_repeat_import_preserves_edits_and_does_not_publish_or_reactivate():
    run_legacy_migration()
    assert {r["status"] for r in Database.fetch_all("SELECT status FROM entity_registry")} == {"draft"}
    assert {r["review_status"] for r in Database.fetch_all("SELECT review_status FROM cultural_sources_v3")} == {"draft"}
    Database.execute("UPDATE renderable_items_v3 SET name='Reviewed name',is_active=0")
    Database.execute("UPDATE renderable_variants_v3 SET hex_color='#123456'")
    Database.execute("UPDATE render_profiles_v3 SET transform_json='{\"dx\":123}'")
    Database.execute("UPDATE cultural_sources_v3 SET title='Reviewed source',review_status='published'")
    tables = ["renderable_items_v3", "renderable_variants_v3", "render_profiles_v3", "cultural_sources_v3", "legacy_entity_mappings_v3"]
    before = {t: Database.fetch_all(f"SELECT * FROM {t}") for t in tables}
    run_legacy_migration()
    assert {t: Database.fetch_all(f"SELECT * FROM {t}") for t in tables} == before


def test_unpublished_item_hides_imported_renderable():
    run_legacy_migration()
    item = Database.fetch_one("SELECT id FROM items ORDER BY id LIMIT 1")["id"]
    Database.execute("UPDATE items SET is_published=0 WHERE id=?", (item,))
    run_legacy_migration()
    assert Database.fetch_one("SELECT is_active FROM renderable_items_v3 WHERE id=?", (f"renderable_{item}",))["is_active"] == 0


def test_changed_mapping_conflict_rolls_back_instead_of_overwriting_reviewed_render():
    run_legacy_migration()
    item = Database.fetch_one("SELECT id FROM items ORDER BY id LIMIT 1")["id"]
    Repo.add_entity(Entity(id="replacement", entity_type="garment", identity={"name_vi": "Replacement"}))
    Database.execute("UPDATE legacy_entity_mappings_v3 SET entity_id='replacement' WHERE legacy_table='items' AND legacy_id=?", (item,))
    before = Database.fetch_all("SELECT * FROM renderable_items_v3")
    with pytest.raises(ValueError, match="curated mapping"):
        run_legacy_migration()
    assert Database.fetch_all("SELECT * FROM renderable_items_v3") == before
