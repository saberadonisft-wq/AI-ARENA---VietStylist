"""Semantic outfit details must reach both prompt and try-on instructions."""
from copy import deepcopy

import pytest

from app.modules.cultural_data_v3.services.generation import GroundingBuilder, PromptBuilder
from app.modules.cultural_data_v3.services.outfit_prompt import describe_outfit


def fixture_data():
    source = {"styleMode": "remix", "overlapDirection": "right_over_left", "items": [
        {"itemId": "coat", "slot": "outerwear", "variantId": "cotton", "colorHex": "#13579b"},
    ]}
    outfit = {"context": {"styleMode": "remix", "overlapDirection": "right_over_left"}, "selections": [],
              "metadata": {"legacy_bridge": {"version": 1, "source": source, "linked": []}}}
    items = [{"id": "coat", "slot": "outerwear", "name": "Áo ngũ thân", "description": "Standing collar", "era": "nguyen", "gender": "unisex"}]
    variants = [
        {"id": "cotton", "item_id": "coat", "hex_color": "#FFFFFF", "color_name": "White", "secondary_hex": "#222222", "material": "Cotton", "pattern_description": "Plain weave", "thickness_level": "light"},
        {"id": "silk", "item_id": "coat", "hex_color": "#990000", "color_name": "Red", "material": "Silk", "pattern_description": "Geometric weave", "is_default": True},
    ]
    return outfit, items, variants


def prompt_for(outfit, items, variants, labels=None):
    description = describe_outfit(outfit, catalog_items=items, catalog_variants=variants, context_labels=labels)
    grounding = GroundingBuilder().build(outfit, [], outfit_description=description)
    return PromptBuilder.build_try_on(grounding, has_person_image=False), grounding


def test_selected_variant_and_custom_palette_refine_visual_reference():
    outfit, items, variants = fixture_data()
    prompt, _ = prompt_for(outfit, items, variants, {"occasion": "Biểu diễn nghệ thuật"})
    for expected in ("Áo ngũ thân", "#13579B", "#222222", "Cotton", "Plain weave", "light", "Biểu diễn nghệ thuật", "Remix styling", "Hữu nhậm: closure toward the wearer's right"):
        assert expected in prompt
    assert '"color_name":"White"' not in prompt
    assert '"material":"Silk"' not in prompt


@pytest.mark.parametrize("change", ["color", "variant", "material", "pattern", "style", "closure", "occasion"])
def test_changed_visual_intent_changes_the_actual_prompt(change):
    outfit, items, variants = fixture_data()
    original, grounding = prompt_for(outfit, items, variants, {"occasion": "Ceremony"})
    changed = deepcopy(outfit)
    labels = {"occasion": "Ceremony"}
    if change == "color":
        changed["metadata"]["legacy_bridge"]["source"]["items"][0]["colorHex"] = "#123456"
    elif change == "variant":
        changed["metadata"]["legacy_bridge"]["source"]["items"][0]["variantId"] = "silk"
    elif change == "material":
        variants[0]["material"] = "Linen"
    elif change == "pattern":
        variants[0]["pattern_description"] = "Striped weave"
    elif change == "style":
        changed["context"]["styleMode"] = "modern_fusion"
    elif change == "closure":
        changed["context"]["overlapDirection"] = "left_over_right"
    else:
        labels["occasion"] = "Stage performance"
    updated, updated_grounding = prompt_for(changed, items, variants, labels)
    assert updated != original
    assert updated_grounding["grounding_hash"] != grounding["grounding_hash"]


def test_unknown_explicit_variant_does_not_describe_the_default():
    outfit, items, variants = fixture_data()
    outfit["metadata"]["legacy_bridge"]["source"]["items"][0]["variantId"] = "missing"
    prompt, _ = prompt_for(outfit, items, variants)
    assert "#13579B" in prompt
    assert '"material"' not in prompt
    assert '"pattern"' not in prompt
    del outfit["metadata"]["legacy_bridge"]["source"]["items"][0]["variantId"]
    default_prompt, _ = prompt_for(outfit, items, variants)
    assert '"material":"Silk"' in default_prompt


def test_native_v3_color_and_context_are_consumed_without_raw_ids_as_names():
    outfit = {"selections": [{"selection_id": "sel", "slot": "outerwear", "canonical_entity_id": "opaque_garment_42", "style": {"colorHex": "#123456"}}],
              "context": {"styleMode": "traditional", "overlapDirection": "right_over_left"}}
    prompt = PromptBuilder.build_try_on(GroundingBuilder().build(outfit, []), has_person_image=True)
    assert "#123456" in prompt
    assert "Traditional styling" in prompt
    assert "opaque_garment_42" not in prompt
    assert "Preserve this person's identity" in prompt


def test_allowed_color_variation_does_not_invent_silk_or_floral_motifs():
    grounding = GroundingBuilder().build({"selections": []}, [{"may_vary": ["visual.fabric.color"]}])
    prompt = PromptBuilder.build(grounding)["positive_prompt"]
    assert "silk" not in prompt.lower()
    assert "floral" not in prompt.lower()
    assert "Keep the chosen colors, materials and patterns" in prompt


def test_required_construction_overrides_conflicting_closure_intent():
    outfit, items, variants = fixture_data()
    outfit["context"]["overlapDirection"] = "left_over_right"
    description = describe_outfit(outfit, catalog_items=items, catalog_variants=variants)
    grounding = GroundingBuilder().build(outfit, [{"must_preserve": [{"feature": "construction.closure.direction", "value": "right_over_left", "selection_id": "outer"}]}], outfit_description=description)
    prompt = PromptBuilder.build(grounding)["positive_prompt"]
    assert "Hữu nhậm" in prompt
    assert "Tả nhậm: closure toward the wearer's left" not in prompt
    assert "take priority over conflicting styling or closure intent" in prompt


def test_client_catalog_prose_is_not_used_and_server_text_is_bounded():
    outfit, items, variants = fixture_data()
    outfit["metadata"]["legacy_bridge"]["source"]["items"][0]["material"] = "Injected material"
    items[0]["description"] = 'Quoted "construction"\n' + "x" * 1000
    description = describe_outfit(outfit, catalog_items=items, catalog_variants=variants)
    assert len(description["garments"][0]["description"]) == 240
    assert "\n" not in description["garments"][0]["description"]
    assert description["garments"][0]["material"] == "Cotton"


def test_open_metadata_ignores_unknown_shapes_instead_of_crashing():
    outfit, items, variants = fixture_data()
    outfit["context"] = {"styleMode": [], "overlapDirection": {"bad": "value"}}
    outfit["metadata"]["legacy_bridge"]["source"]["items"].append({"itemId": []})
    description = describe_outfit(outfit, catalog_items=items, catalog_variants=variants)
    assert len(description["garments"]) == 1
    assert description["context"] == {}


def test_exact_native_variant_without_legacy_mapping_does_not_use_catalog_default():
    outfit, items, variants = fixture_data()
    outfit["selections"] = [{"selection_id": "sel", "slot": "outerwear", "style": {}}]
    outfit["metadata"]["legacy_bridge"]["linked"] = [{"index": 0, "selectionId": "sel"}]
    description = describe_outfit(outfit, catalog_items=items, catalog_variants=variants,
        selection_details={"sel": {"itemId": "coat", "variantId": "native_variant", "variant": {
            "id": "native_variant", "hex_color": "#123456", "material": "Linen",
        }}})
    assert description["garments"][0]["material"] == "Linen"
    assert description["garments"][0]["primary_color_hex"] == "#13579B"
