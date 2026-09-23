"""Migration script: Maps legacy V1 database entities to canonical V3 entities and sources."""
from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db_connection, init_database
from app.modules.media.validation import validate_svg


def _local_name(value: str) -> str:
    return value.rsplit("}", 1)[-1]


def normalize_legacy_svg(svg_content: str | None) -> str | None:
    """Convert trusted legacy SVG fragments into standalone, safe V3 assets."""
    if not svg_content:
        return None

    try:
        root = ET.fromstring(svg_content)
    except ET.ParseError as exc:
        raise ValueError("Legacy SVG is not valid XML") from exc

    gradients: dict[str, str] = {}
    for element in root.iter():
        if _local_name(element.tag) not in {"linearGradient", "radialGradient"}:
            continue
        gradient_id = element.attrib.get("id")
        color = next(
            (
                child.attrib.get("stop-color")
                for child in element
                if _local_name(child.tag) == "stop" and child.attrib.get("stop-color")
            ),
            None,
        )
        if gradient_id and color:
            gradients[gradient_id] = color

    if _local_name(root.tag) != "svg":
        wrapper = ET.Element("svg", {"viewBox": "0 0 800 1200"})
        wrapper.append(root)
        root = wrapper

    for parent in list(root.iter()):
        for child in list(parent):
            if _local_name(child.tag) == "defs":
                parent.remove(child)

    for element in root.iter():
        element.tag = _local_name(element.tag)
        cleaned = {}
        for raw_key, raw_value in element.attrib.items():
            key = _local_name(raw_key)
            if key == "id":
                continue
            value = raw_value
            if value.startswith("url(#") and value.endswith(")"):
                value = gradients.get(value[5:-1], "#000000")
            cleaned[key] = value
        element.attrib.clear()
        element.attrib.update(cleaned)

    root.set("xmlns", "http://www.w3.org/2000/svg")
    if "viewBox" not in root.attrib:
        root.set("viewBox", "0 0 800 1200")
    normalized = ET.tostring(root, encoding="utf-8")
    return validate_svg(normalized)[0].decode("utf-8")


def run_legacy_migration() -> dict[str, int]:
    """Inspects legacy items, garment_types, and heritage_sources and creates V3 mappings."""
    init_database(seed=False)
    results = {"garment_types": 0, "items": 0, "renderable_items": 0, "variants": 0, "profiles": 0, "sources": 0}

    with get_db_connection() as conn:
        with conn:
            conn.execute("BEGIN IMMEDIATE")

            # 1. Map garment_types -> entity_registry
            garment_types = conn.execute("SELECT * FROM garment_types").fetchall()
            for gt in garment_types:
                canonical_id = f"garment_{gt['id']}"
                # Ensure canonical entity exists
                conn.execute(
                    """
                    INSERT INTO entity_registry (id, entity_type, identity_json, status, version)
                    VALUES (?, 'garment', ?, 'draft', 1)
                    ON CONFLICT(id) DO NOTHING
                    """,
                    (
                        canonical_id,
                        json.dumps({
                            "name_vi": gt["name"],
                            "description": gt["description"],
                            "era_legacy": gt["era"],
                        }, ensure_ascii=False),
                    ),
                )
                conn.execute(
                    """
                    INSERT INTO legacy_entity_mappings_v3 (legacy_table, legacy_id, entity_id, mapping_kind)
                    VALUES ('garment_types', ?, ?, 'taxonomy')
                    ON CONFLICT(legacy_table, legacy_id) DO NOTHING
                    """,
                    (gt["id"], canonical_id),
                )
                results["garment_types"] += 1

            # 2. Map items -> canonical entity & renderable_items_v3
            items = conn.execute("SELECT * FROM items").fetchall()
            for item in items:
                gt_id = item["garment_type_id"]
                mapping = conn.execute("SELECT entity_id FROM legacy_entity_mappings_v3 WHERE legacy_table='items' AND legacy_id=?", (item["id"],)).fetchone()
                taxonomy = conn.execute("SELECT entity_id FROM legacy_entity_mappings_v3 WHERE legacy_table='garment_types' AND legacy_id=?", (gt_id,)).fetchone()
                canonical_gt_id = mapping["entity_id"] if mapping else taxonomy["entity_id"]
                renderable_id = f"renderable_{item['id']}"

                # Insert renderable item
                conn.execute(
                    """
                    INSERT INTO renderable_items_v3 (id, canonical_entity_id, slot, name, asset_format, is_active, metadata_json)
                    VALUES (?, ?, ?, ?, 'svg', ?, ?)
                    ON CONFLICT(id) DO NOTHING
                    """,
                    (renderable_id, canonical_gt_id, item["slot"], item["name"], item["is_published"], json.dumps({"legacy_item_id": item["id"]})),
                )
                # Publication withdrawal is authoritative; never reactivate a
                # renderable previously hidden by an editor on a repeat import.
                if not item["is_published"]:
                    conn.execute("UPDATE renderable_items_v3 SET is_active=0 WHERE id=?", (renderable_id,))
                stored = conn.execute("SELECT canonical_entity_id FROM renderable_items_v3 WHERE id=?", (renderable_id,)).fetchone()
                if stored["canonical_entity_id"] != canonical_gt_id:
                    raise ValueError("Existing renderable conflicts with curated mapping; reconcile explicitly")
                results["renderable_items"] += 1

                # Legacy mapping
                conn.execute(
                    """
                    INSERT INTO legacy_entity_mappings_v3 (legacy_table, legacy_id, entity_id, mapping_kind)
                    VALUES ('items', ?, ?, 'catalog_item')
                    ON CONFLICT(legacy_table, legacy_id) DO NOTHING
                    """,
                    (item["id"], canonical_gt_id),
                )
                results["items"] += 1

                variants = conn.execute("SELECT * FROM item_variants WHERE item_id=? ORDER BY id", (item["id"],)).fetchall()
                variant_ids = {}
                for variant in variants:
                    variant_id = f"render_variant_{variant['id']}"
                    variant_ids[variant["id"]] = variant_id
                    style = {key: variant[key] for key in ("secondary_hex", "thickness_level", "pattern_description", "price_tier")}
                    style["legacy_variant_id"] = variant["id"]
                    conn.execute("""INSERT INTO renderable_variants_v3(id,renderable_item_id,color_name,hex_color,material,style_json,is_default)
                        VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""", (variant_id, renderable_id, variant["color_name"], variant["hex_color"], variant["material"], json.dumps(style, ensure_ascii=False), variant["is_default"]))
                    results["variants"] += 1
                for layer in conn.execute("SELECT * FROM asset_layers WHERE item_id=? ORDER BY id", (item["id"],)).fetchall():
                    if layer["variant_id"] and layer["variant_id"] not in variant_ids:
                        raise ValueError("Legacy layer references a variant from a different item")
                    transform = {key: layer[key] for key in ("anchor_x", "anchor_y", "scale_x", "scale_y", "slot", "layer_type")}
                    transform["color_mask_rule"] = json.loads(layer["color_mask_rule"] or "{}")
                    conn.execute("""INSERT INTO render_profiles_v3(id,renderable_item_id,variant_id,avatar_id,pose,z_index,svg_content,media_asset_id,transform_json)
                        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""", (f"render_profile_{layer['id']}", renderable_id, variant_ids.get(layer["variant_id"]), layer["avatar_id"], "front_01", layer["z_index"], normalize_legacy_svg(layer["svg_content"]), layer["media_asset_id"], json.dumps(transform)))
                    results["profiles"] += 1

            # 3. Map heritage_sources -> cultural_sources_v3
            sources = conn.execute("SELECT * FROM heritage_sources").fetchall()
            for s in sources:
                conn.execute(
                    """
                    INSERT INTO cultural_sources_v3 (
                        id, source_type, title, creator, institution, publication_date, url, accessed_at, rights_json, trust_tier, review_status
                    ) VALUES (?, 'academic_book', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, '{}', 'F_UNVERIFIED', 'draft')
                    ON CONFLICT(id) DO NOTHING
                    """,
                    (
                        s["id"],
                        s["title"],
                        s["author"],
                        s["publisher"],
                        str(s["publication_year"]) if s["publication_year"] else None,
                        s["url"],
                    ),
                )
                results["sources"] += 1

    print(f"[SUCCESS] Legacy migration to V3 completed:")
    for k, v in results.items():
        print(f"  - {k}: {v}")
    return results


if __name__ == "__main__":
    run_legacy_migration()
