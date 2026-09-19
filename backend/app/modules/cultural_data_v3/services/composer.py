"""Composer data comes from persisted, published graph and render records."""
from app.core.database import Database
from app.core.errors import AppError
from app.modules.media.validation import validate_svg
from app.modules.cultural_data_v3.repository import decode_record
from app.modules.cultural_data_v3.services.publication import PublicationPolicy
from app.modules.cultural_data_v3.services.resolver import matches, INHERITANCE_RELATIONS
from app.modules.cultural_data_v3.services.evidence import evidence_for_facts, constraint_evidence_issue
from app.modules.cultural_data_v3.services.rule_engine import validate_condition, evaluate_supported_condition


def public_rules(entity_ids, context, reader):
    placeholders = ",".join("?" for _ in entity_ids)
    rows = reader.fetch_all(f"SELECT * FROM cultural_rules_v3 WHERE status='published' AND (entity_id IS NULL OR entity_id IN ({placeholders})) ORDER BY id", tuple(entity_ids))
    policy = PublicationPolicy(reader)
    result = []
    for row in rows:
        rule = decode_record(row)
        if not rule["assertion_ids"] or not policy.fact_is_public(rule, {"status": "active"}) or not matches(rule["qualifiers"], context):
            continue
        citations = evidence_for_facts([rule], reader=reader)
        if len(citations) != len(set(rule["assertion_ids"])) or any(c["consensus"] not in ("single_source", "corroborated", "strong_consensus") or any(not source["locator"].strip() for source in c["sources"]) for c in citations):
            continue
        # Evidence qualifiers also scope a rule, even if its import omitted them.
        if any(not matches(c["qualifiers"], context) for c in citations):
            continue
        try:
            validate_condition(rule["condition"])
        except ValueError:
            raise AppError("INVALID_RULESET", "Bộ luật có điều kiện không hợp lệ; cần biên tập lại.", 409) from None
        result.append(rule)
    return result


def renderables_for(entity_id, reader):
    items = reader.fetch_all("SELECT id,canonical_entity_id,slot,name,asset_format FROM renderable_items_v3 WHERE canonical_entity_id=? AND is_active=1 ORDER BY id", (entity_id,))
    result, styles = [], []
    for item in items:
        variants = [decode_record(r) for r in reader.fetch_all("SELECT id,renderable_item_id,color_name,hex_color,material,style_json,is_default FROM renderable_variants_v3 WHERE renderable_item_id=? ORDER BY id", (item["id"],))]
        variant_ids = {v["id"] for v in variants}
        profiles = []
        for raw in reader.fetch_all("SELECT * FROM render_profiles_v3 WHERE renderable_item_id=? ORDER BY z_index,id", (item["id"],)):
            profile = decode_record(raw)
            if profile["variant_id"] and profile["variant_id"] not in variant_ids:
                continue
            svg = profile["svg_content"]
            if svg:
                if len(svg.encode("utf-8")) > 1024 * 1024:
                    continue
                try:
                    svg = validate_svg(svg.encode("utf-8"))[0].decode("utf-8")
                except AppError:
                    continue
            media_id = profile["media_asset_id"]
            if media_id and not Database.fetch_one("SELECT id FROM media_assets WHERE id=? AND status='ready' AND visibility='public'", (media_id,)):
                continue
            if not svg and not media_id:
                continue
            profiles.append({"id": profile["id"], "variant_id": profile["variant_id"], "avatar_id": profile["avatar_id"], "pose": profile["pose"], "z_index": profile["z_index"], "svg_content": svg, "media_asset_id": media_id, "transform": profile["transform"]})
        if profiles:
            result.append({**item, "variants": variants, "profiles": profiles})
            styles.extend(variants)
    return result, styles


def validate_spec(outfit, resolver, metadata):
    slots = {s.slot: s.model_dump() for s in outfit.selections}
    rules = {}
    missing, unchecked = [], []
    facts = {}
    definitions = {d["key"]: d for d in resolver.repo.list_attribute_definitions()}
    for selection in outfit.selections:
        base = resolver.repo.get_entity(selection.canonical_entity_id)
        if not base or base["status"] != "published":
            missing.append(selection.canonical_entity_id)
            continue
        entity_id = selection.canonical_variant_id or selection.canonical_entity_id
        entity = resolver.repo.get_entity(entity_id)
        if not entity or entity["status"] != "published":
            missing.append(entity_id)
            continue
        resolved = resolver.resolve(entity_id, outfit.context)
        if selection.canonical_variant_id and (entity["entity_type"] != "garment_variant" or not any(r["relation_type"] in INHERITANCE_RELATIONS and r["state"] == "known" and r["object_id"] == selection.canonical_entity_id for r in resolved["relations"])):
            raise AppError("INVALID_VARIANT", "Biến thể không thuộc trang phục đã chọn.", 422)
        if selection.renderable_item_id:
            renderable = resolver.reader.fetch_one("SELECT canonical_entity_id,slot FROM renderable_items_v3 WHERE id=? AND is_active=1", (selection.renderable_item_id,))
            if not renderable or renderable["canonical_entity_id"] not in (entity_id, selection.canonical_entity_id) or renderable["slot"] != selection.slot:
                raise AppError("INVALID_RENDERABLE", "Tài nguyên hiển thị không thuộc lựa chọn.", 422)
        if selection.render_variant_id and (not selection.renderable_item_id or not resolver.reader.fetch_one("SELECT id FROM renderable_variants_v3 WHERE id=? AND renderable_item_id=?", (selection.render_variant_id, selection.renderable_item_id))):
            raise AppError("INVALID_RENDER_VARIANT", "Màu hoặc kiểu hiển thị không thuộc tài nguyên đã chọn.", 422)
        selected_rules = public_rules(resolved["lineage"], resolved["context"], resolver.reader)
        if not selected_rules:
            unchecked.append(entity_id)
        rules.update({r["id"]: r for r in selected_rules})
        facts[selection.slot] = {}
        citations = {c["assertion_id"]: c for c in evidence_for_facts(resolved["attributes"], reader=resolver.reader)}
        uncertain_keys = {f["attribute_key"] for f in resolved["attributes"] if f["state"] != "known" or constraint_evidence_issue(f, citations, reader=resolver.reader)}
        for fact in resolved["attributes"]:
            if fact["attribute_key"] in uncertain_keys:
                continue
            current = facts[selection.slot]
            segments = fact["attribute_key"].split(".")
            for segment in segments[:-1]:
                if segment in current and not isinstance(current[segment], dict):
                    raise AppError("INVALID_FACT_PATH", "Đường dẫn thuộc tính bị xung đột trong bộ luật.", 409)
                current = current.setdefault(segment, {})
            if definitions[fact["attribute_key"]]["cardinality"] == "multiple":
                current.setdefault(segments[-1], []).append(fact["value"])
            else:
                current[segments[-1]] = fact["value"]
    context = {"outfit": outfit.model_dump(), "slots": slots, "facts": facts}
    evaluations = {id: evaluate_supported_condition(rule["condition"], context) for id, rule in rules.items()}
    unknown_rules = sorted(id for id, result in evaluations.items() if result is None)
    violations = [{"rule_id": rule["id"], "name": rule["name"], "severity": rule["severity"], "explanation": rule["explanation"], "suggested_fix": rule["suggested_fix"], "assertion_ids": rule["assertion_ids"]} for id, rule in rules.items() if evaluations[id] is True]
    status = "error" if any(v["severity"] == "strict" for v in violations) else "warning" if violations or missing else "not_evaluated" if unchecked or unknown_rules or not rules else "clear"
    return {"status": status, "missing_entities": missing, "unchecked_entities": unchecked, "unevaluated_rule_ids": unknown_rules, "evaluated_rule_count": len(rules) - len(unknown_rules), "violations": violations, "outfit": outfit.model_dump(), "dataset": metadata}
