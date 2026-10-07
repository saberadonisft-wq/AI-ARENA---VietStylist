"""Concise visual descriptions; catalog facts are supplied by the server."""
from __future__ import annotations

import re
from typing import Any


STYLE_INTENTS = {
    "traditional": "Traditional styling; preserve the selected garment construction and layering.",
    "remix": "Remix styling of the selected garments; do not add or replace garments.",
    "modern_fusion": "Contemporary fusion styling of the selected garments; preserve their recognizable construction.",
}
CLOSURES = {
    "right_over_left": "Hữu nhậm: closure toward the wearer's right; preserve the referenced flap and button placement without mirroring.",
    "left_over_right": "Tả nhậm: closure toward the wearer's left; preserve the referenced flap and button placement without mirroring.",
}
CONTEXT_TYPES = {
    "period_ids": "period", "region_ids": "region", "place_ids": "place",
    "community_ids": "community", "occasion_ids": "occasion", "social_context_ids": "social_context",
}


def text(value: Any, limit: int = 240) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = re.sub(r"[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]", " ", value)
    cleaned = " ".join(cleaned.split())[:limit].strip()
    return cleaned or None


def color(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    hex_value = value.strip().removeprefix("#")
    if not re.fullmatch(r"(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})", hex_value):
        return None
    if len(hex_value) == 3:
        hex_value = "".join(character * 2 for character in hex_value)
    return "#" + hex_value.upper()


def snapshot_source(outfit: dict) -> dict:
    metadata = outfit.get("metadata")
    bridge = metadata.get("legacy_bridge") if isinstance(metadata, dict) else None
    source = bridge.get("source") if isinstance(bridge, dict) and bridge.get("version") == 1 else None
    return source if isinstance(source, dict) else {}


def describe_outfit(
    outfit: dict,
    *,
    catalog_items: list[dict] | None = None,
    catalog_variants: list[dict] | None = None,
    selection_details: dict[str, dict] | None = None,
    context_labels: dict[str, Any] | None = None,
) -> dict:
    """Use whitelisted visual fields, never client-supplied catalog prose."""
    source = snapshot_source(outfit)
    items = {item["id"]: item for item in catalog_items or []}
    variants = catalog_variants or []
    selections = [s for s in outfit.get("selections", [])[:32] if isinstance(s, dict)]
    details = selection_details or {}
    bridge = outfit.get("metadata", {}).get("legacy_bridge", {})
    links = bridge.get("linked", []) if isinstance(bridge, dict) else []
    by_id = {s.get("selection_id"): s for s in selections}
    chosen = []
    described_selections = set()
    described_items = set()
    source_items = source.get("items", [])
    for index, selected in enumerate(source_items[:32] if isinstance(source_items, list) else []):
        if not isinstance(selected, dict) or not isinstance(selected.get("itemId"), str) or selected["itemId"] not in items:
            continue
        candidate = dict(selected)
        link = next((entry for entry in links if isinstance(entry, dict) and entry.get("index") == index), None) if isinstance(links, list) else None
        selection = by_id.get(link["selectionId"]) if link and isinstance(link.get("selectionId"), str) else None
        binding = None
        if selection:
            binding = details.get(selection["selection_id"], {})
            candidate.update({k: v for k, v in binding.items() if k in ("itemId", "variantId")})
            candidate["slot"] = selection["slot"]
            if "colorHex" in selection.get("style", {}):
                candidate["colorHex"] = selection["style"]["colorHex"]
            described_selections.add(selection["selection_id"])
        chosen.append((candidate, binding))
        described_items.add(candidate.get("itemId"))
    for selection in selections:
        if selection["selection_id"] in described_selections:
            continue
        binding = details.get(selection["selection_id"], {})
        chosen.append(({**binding, "slot": selection["slot"], "colorHex": selection.get("style", {}).get("colorHex")}, binding))
        described_items.add(binding.get("itemId"))
    # Legacy requests without a bridge still have server-validated garment names.
    for item_id, item in items.items():
        if item_id not in described_items:
            chosen.append(({"itemId": item_id, "slot": item.get("slot")}, None))

    garments = []
    for selected, binding in chosen[:32]:
        item = items.get(selected.get("itemId"), {})
        garment = {"slot": text(selected.get("slot"), 80)}
        for key in ("name", "description", "era", "gender"):
            garment[key] = text(item.get(key) or (binding or {}).get(key))
        available = [v for v in variants if v.get("item_id") == item.get("id")] if item else []
        variant_id = selected.get("variantId")
        if variant_id:
            variant = next((v for v in available if v.get("id") == variant_id), None)
        else:
            variant = next((v for v in available if v.get("is_default")), available[0] if len(available) == 1 else None)
        variant = variant or (binding or {}).get("variant") or {}
        selected_color = color(selected.get("colorHex"))
        base_color = color(variant.get("hex_color"))
        garment["primary_color_hex"] = selected_color or base_color
        garment["secondary_color_hex"] = color(variant.get("secondary_hex"))
        if not selected_color or selected_color == base_color:
            garment["color_name"] = text(variant.get("color_name"), 80)
        for output_key, input_key in (("material", "material"), ("pattern", "pattern_description"), ("thickness", "thickness_level")):
            garment[output_key] = text(variant.get(input_key))
        garments.append({k: v for k, v in garment.items() if v})

    context = {**source, **(outfit.get("context") or {})}
    style = context.get("styleMode") or outfit.get("style_mode")
    overlap = context.get("overlapDirection")
    intent = STYLE_INTENTS.get(style) if isinstance(style, str) else None
    closure = CLOSURES.get(overlap) if isinstance(overlap, str) else None
    result_context = dict(context_labels or {})
    if intent:
        result_context["style_intent"] = intent
    if closure:
        result_context["closure"] = closure
    return {"garments": garments, "context": result_context}


def load_outfit_description(outfit: dict, *, resolver=None, published_items: list[dict] | None = None) -> dict:
    """Resolve human-readable published facts for legacy and native V3 outfits."""
    from app.modules.catalog.repository import CatalogRepository
    from app.modules.cultural_data_v3.repository import decode_record

    source = snapshot_source(outfit)
    source_items = source.get("items", [])
    item_ids = [i.get("itemId") for i in source_items[:32] if isinstance(i, dict) and isinstance(i.get("itemId"), str)] if isinstance(source_items, list) else []
    details = {}
    if resolver:
        for selection in outfit.get("selections", []):
            entity = resolver.repo.get_entity(selection.get("canonical_entity_id"))
            identity = decode_record(entity).get("identity", {}) if entity and entity.get("status") == "published" else {}
            binding = {"name": identity.get("name_vi") or identity.get("name_en")}
            render_id = selection.get("renderable_item_id")
            renderable = resolver.reader.fetch_one("SELECT * FROM renderable_items_v3 WHERE id=? AND canonical_entity_id=? AND is_active=1", (render_id, selection.get("canonical_entity_id"))) if render_id else None
            if renderable:
                binding["itemId"] = decode_record(renderable).get("metadata", {}).get("legacy_item_id")
                if isinstance(binding["itemId"], str):
                    item_ids.append(binding["itemId"])
                render_variants = [decode_record(v) for v in resolver.reader.fetch_all("SELECT * FROM renderable_variants_v3 WHERE renderable_item_id=? ORDER BY id", (render_id,))]
                variant_id = selection.get("render_variant_id")
                variant = next((v for v in render_variants if v["id"] == variant_id), None) if variant_id else next((v for v in render_variants if v.get("is_default")), render_variants[0] if len(render_variants) == 1 else None)
                if variant:
                    # Keep a native variant exact even if no legacy counterpart exists.
                    binding["variantId"] = variant.get("style", {}).get("legacy_variant_id") or variant["id"]
                    binding["variant"] = variant
                elif variant_id:
                    # Explicit unknown variants must not fall back to a default.
                    binding["variantId"] = variant_id
            details[selection["selection_id"]] = binding
    known = {i["id"]: i for i in published_items or []}
    missing = list(dict.fromkeys(i for i in item_ids if i not in known))
    known.update({i["id"]: i for i in CatalogRepository.get_published_items_by_ids(missing)})
    variants = CatalogRepository.get_variants_by_item_ids(list(known)) if known else []
    context = {**source, **(outfit.get("context") or {})}
    labels = {}
    occasion_id = context.get("occasionId")
    if isinstance(occasion_id, str) and not source.get("culturalSettings") and not context.get("occasion_ids"):
        occasion = next((o for o in CatalogRepository.get_occasions() if o["id"] == occasion_id), None)
        if occasion and text(occasion.get("name")):
            labels["occasion"] = text(occasion["name"])
    if resolver:
        for key, entity_type in CONTEXT_TYPES.items():
            ids = context.get(key, [])
            names = []
            unique_ids = list(dict.fromkeys(entity_id for entity_id in ids[:32] if isinstance(entity_id, str))) if isinstance(ids, list) else []
            for entity_id in unique_ids:
                entity = resolver.repo.get_entity(entity_id)
                if entity and entity.get("status") == "published" and entity.get("entity_type") == entity_type:
                    identity = decode_record(entity).get("identity", {})
                    name = text(identity.get("name_vi") or identity.get("name_en"))
                    if name:
                        names.append(name)
            if names:
                labels[entity_type] = names
    return describe_outfit(outfit, catalog_items=list(known.values()), catalog_variants=variants, selection_details=details, context_labels=labels)
