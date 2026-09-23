"""Safe, idempotent importer for the Ao Dai and Ao Tu Than pilot packages.

The package JSON is treated strictly as data. Package scripts, prompts, and
instructions are intentionally not bundled or executed.
"""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from typing import Any, Iterable

from app.core.config import settings
from app.core.database import db_transaction
from app.modules.cultural_data_v3.domain.models import (
    AttributeDefinition,
    AttributeValue,
    CulturalAssertion,
    Entity,
    EntityRelation,
    RelationDefinition,
    SourceRecord,
)
from app.modules.cultural_data_v3.domain.validators import (
    validate_attribute_value,
    validate_relation,
)
from app.modules.cultural_data_v3.services.rule_engine import validate_condition
from .pilot_catalog import import_catalog_options


FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "pilot_packages"
PACKAGE_FILES = {
    "ao-dai": "ao_dai_pilot_v1.json",
    "ao-tu-than": "ao_tu_than_pilot_v1.json",
}
SECTIONS = (
    "entities",
    "attribute_definitions",
    "attribute_values",
    "sources",
    "assertions",
    "relation_definitions",
    "relations",
    "rules",
    "generation_profiles",
    "media_candidates",
)
SEVERITY_MAP = {
    "strong_warning": "warning",
    "warning": "warning",
    "notice": "info",
    "info": "info",
}


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _identity(item: dict[str, Any]) -> str:
    value = item.get("id", item.get("key"))
    if not isinstance(value, str) or not value:
        raise ValueError("Pilot records require a non-empty id or key")
    return value


def _unique(values: Iterable[Any]) -> list[Any]:
    result: list[Any] = []
    seen: set[str] = set()
    for value in values:
        marker = _json(value)
        if marker not in seen:
            seen.add(marker)
            result.append(value)
    return result


def load_pilot_package(package_name: str) -> dict[str, Any]:
    try:
        filename = PACKAGE_FILES[package_name]
    except KeyError:
        raise ValueError(f"Unknown pilot package: {package_name}") from None
    return json.loads((FIXTURE_DIR / filename).read_text(encoding="utf-8"))


def validate_pilot_package(payload: dict[str, Any]) -> None:
    manifest = payload.get("manifest")
    if not isinstance(manifest, dict) or manifest.get("status") != "under_review":
        raise ValueError("Pilot package must be explicitly marked under_review")
    for section in SECTIONS:
        if not isinstance(payload.get(section), list):
            raise ValueError(f"Pilot package section must be a list: {section}")
        identifiers = [_identity(item) for item in payload[section]]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError(f"Duplicate identifiers in pilot package section: {section}")
        expected = manifest.get("counts", {}).get(section)
        if expected is not None and expected != len(identifiers):
            raise ValueError(f"Manifest count mismatch for {section}")

    entities = {item["id"]: Entity.model_validate(item) for item in payload["entities"]}
    definitions = {
        item["key"]: AttributeDefinition.model_validate(item)
        for item in payload["attribute_definitions"]
    }
    relation_definitions = {
        item["key"]: RelationDefinition.model_validate(item)
        for item in payload["relation_definitions"]
    }
    sources = {item["id"]: SourceRecord.model_validate(item) for item in payload["sources"]}
    assertions = {
        item["id"]: CulturalAssertion.model_validate({**item, "review_status": "under_review"})
        for item in payload["assertions"]
    }

    for assertion in assertions.values():
        if assertion.subject_id not in entities:
            raise ValueError(f"Unknown assertion subject: {assertion.subject_id}")
        for evidence in assertion.evidence:
            if evidence.source_id not in sources:
                raise ValueError(f"Unknown evidence source: {evidence.source_id}")

    for raw in payload["attribute_values"]:
        value = AttributeValue.model_validate(raw)
        errors = validate_attribute_value(
            value,
            definitions.get(value.attribute_key),
            entities.get(value.entity_id),
        )
        if errors:
            raise ValueError(f"Invalid attribute value {value.id}: {'; '.join(errors)}")
        if any(assertion_id not in assertions for assertion_id in value.assertion_ids):
            raise ValueError(f"Unknown assertion on attribute value: {value.id}")

    for raw in payload["relations"]:
        relation = EntityRelation.model_validate(raw)
        errors = validate_relation(
            relation,
            relation_definitions.get(relation.relation_type),
            entities.get(relation.subject_id),
            entities.get(relation.object_id),
        )
        if errors:
            raise ValueError(f"Invalid relation {relation.id}: {'; '.join(errors)}")
        if any(assertion_id not in assertions for assertion_id in relation.assertion_ids):
            raise ValueError(f"Unknown assertion on relation: {relation.id}")

    media_ids = {item["id"] for item in payload["media_candidates"]}
    for candidate in payload["media_candidates"]:
        if candidate.get("source_id") not in sources:
            raise ValueError(f"Unknown media candidate source: {candidate['id']}")
        if any(subject_id not in entities for subject_id in candidate.get("subject_ids", [])):
            raise ValueError(f"Unknown media candidate subject: {candidate['id']}")

    for rule in payload["rules"]:
        if rule.get("severity") not in SEVERITY_MAP or rule.get("status") != "draft":
            raise ValueError(f"Unsupported pilot rule state: {rule['id']}")
        if len(rule.get("scope", [])) != 1 or rule["scope"][0] not in entities:
            raise ValueError(f"Pilot rule must have exactly one known scope: {rule['id']}")
        validate_condition(rule.get("when"))
        if any(assertion_id not in assertions for assertion_id in rule.get("then", {}).get("assertion_ids", [])):
            raise ValueError(f"Unknown assertion on rule: {rule['id']}")

    for profile in payload["generation_profiles"]:
        if profile.get("subject_id") not in entities:
            raise ValueError(f"Unknown generation profile subject: {profile['id']}")
        if any(media_id not in media_ids for media_id in profile.get("reference_media_candidate_ids", [])):
            raise ValueError(f"Unknown media candidate on generation profile: {profile['id']}")
        constraints = [*profile.get("must_preserve", []), *profile.get("recommended", [])]
        constraints.extend(item for item in profile.get("forbidden", []) if isinstance(item, dict))
        if any(
            assertion_id not in assertions
            for constraint in constraints
            for assertion_id in constraint.get("assertion_ids", [])
        ):
            raise ValueError(f"Unknown assertion on generation profile: {profile['id']}")


def _enriched_entities(payload: dict[str, Any]) -> list[dict[str, Any]]:
    manifest = payload["manifest"]
    result = {item["id"]: deepcopy(item) for item in payload["entities"]}
    provenance = {
        "package": manifest["package"],
        "dataset_version": manifest["dataset_version"],
        "status": manifest["status"],
    }
    for entity in result.values():
        extensions = entity.setdefault("extensions", {})
        extensions["pilot_import"] = provenance

    for candidate in payload["media_candidates"]:
        for subject_id in candidate.get("subject_ids", []):
            result[subject_id]["extensions"].setdefault("media_candidates", []).append(candidate)

    for profile in payload["generation_profiles"]:
        metadata = {
            key: deepcopy(profile[key])
            for key in (
                "id",
                "mode",
                "strict_accuracy_mode",
                "semantic_grounding_ready",
                "generation_ready",
                "not_ready_reason",
                "recommended",
                "reference_media_candidate_ids",
            )
            if key in profile
        }
        result[profile["subject_id"]]["extensions"].setdefault("generation_profile_imports", []).append(metadata)
    return list(result.values())


def _inserted(cursor) -> int:
    return 1 if cursor.rowcount == 1 else 0


def _merge_attribute_definition(conn, raw: dict[str, Any]) -> tuple[int, int]:
    existing = conn.execute("SELECT * FROM attribute_definitions WHERE key=?", (raw["key"],)).fetchone()
    if not existing:
        cursor = conn.execute(
            """INSERT INTO attribute_definitions
            (key,label_vi,description,value_type,cardinality,allowed_values_json,applies_to_json,
             contextual,queryable,inheritable,default_missing_state,status,version)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                raw["key"], raw["label_vi"], raw.get("description"), raw["value_type"],
                raw.get("cardinality", "single"), _json(raw["allowed_values"]) if raw.get("allowed_values") is not None else None,
                _json(raw["applies_to"]), int(raw.get("contextual", True)), int(raw.get("queryable", True)),
                int(raw.get("inheritable", True)), raw.get("default_missing_state", "not_collected"),
                raw.get("status", "draft"), raw.get("version", 1),
            ),
        )
        return _inserted(cursor), 0
    if existing["value_type"] != raw["value_type"] or existing["cardinality"] != raw.get("cardinality", "single"):
        raise ValueError(f"Incompatible attribute definition collision: {raw['key']}")
    allowed = _unique([*json.loads(existing["allowed_values_json"] or "[]"), *(raw.get("allowed_values") or [])])
    applies_to = _unique([*json.loads(existing["applies_to_json"]), *raw["applies_to"]])
    changed = allowed != json.loads(existing["allowed_values_json"] or "[]") or applies_to != json.loads(existing["applies_to_json"])
    if changed:
        conn.execute(
            "UPDATE attribute_definitions SET allowed_values_json=?,applies_to_json=? WHERE key=?",
            (_json(allowed) if allowed else None, _json(applies_to), raw["key"]),
        )
    return 0, int(changed)


def _merge_relation_definition(conn, raw: dict[str, Any]) -> tuple[int, int]:
    existing = conn.execute("SELECT * FROM relation_definitions WHERE key=?", (raw["key"],)).fetchone()
    if not existing:
        cursor = conn.execute(
            """INSERT INTO relation_definitions
            (key,label_vi,source_types_json,target_types_json,directional,inverse_relation_key,
             contextual,inheritable,status,version) VALUES(?,?,?,?,?,?,?,?,?,?)""",
            (
                raw["key"], raw["label_vi"], _json(raw["source_types"]), _json(raw["target_types"]),
                int(raw.get("directional", True)), raw.get("inverse_relation_key"),
                int(raw.get("contextual", True)), int(raw.get("inheritable", True)),
                raw.get("status", "draft"), raw.get("version", 1),
            ),
        )
        return _inserted(cursor), 0
    if bool(existing["directional"]) != bool(raw.get("directional", True)):
        raise ValueError(f"Incompatible relation definition collision: {raw['key']}")
    source_types = _unique([*json.loads(existing["source_types_json"]), *raw["source_types"]])
    target_types = _unique([*json.loads(existing["target_types_json"]), *raw["target_types"]])
    changed = source_types != json.loads(existing["source_types_json"]) or target_types != json.loads(existing["target_types_json"])
    if changed:
        conn.execute(
            "UPDATE relation_definitions SET source_types_json=?,target_types_json=? WHERE key=?",
            (_json(source_types), _json(target_types), raw["key"]),
        )
    return 0, int(changed)


def _import_payload(conn, payload: dict[str, Any]) -> dict[str, Any]:
    report = {section: 0 for section in SECTIONS if section != "media_candidates"}
    report.update(merged_attribute_definitions=0, merged_relation_definitions=0)

    for raw in _enriched_entities(payload):
        Entity.model_validate(raw)
        existing = conn.execute("SELECT entity_type FROM entity_registry WHERE id=?", (raw["id"],)).fetchone()
        if existing and existing["entity_type"] != raw["entity_type"]:
            raise ValueError(f"Incompatible entity collision: {raw['id']}")
        report["entities"] += _inserted(conn.execute(
            """INSERT INTO entity_registry
            (id,entity_type,schema_version,identity_json,status,version,extensions_json)
            VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["entity_type"], raw.get("schema_version", "1.0"), _json(raw["identity"]),
             "under_review", raw.get("version", 1), _json(raw.get("extensions", {}))),
        ))

    for raw in payload["attribute_definitions"]:
        inserted, merged = _merge_attribute_definition(conn, raw)
        report["attribute_definitions"] += inserted
        report["merged_attribute_definitions"] += merged
    for raw in payload["relation_definitions"]:
        inserted, merged = _merge_relation_definition(conn, raw)
        report["relation_definitions"] += inserted
        report["merged_relation_definitions"] += merged

    for raw in payload["sources"]:
        report["sources"] += _inserted(conn.execute(
            """INSERT INTO cultural_sources_v3
            (id,source_type,title,creator,institution,publication_date,url,accessed_at,rights_json,trust_tier,review_status,version)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["source_type"], raw["title"], raw.get("creator"), raw.get("institution"),
             raw.get("publication_date"), raw.get("url"), raw["accessed_at"], _json(raw.get("rights", {})),
             raw.get("trust_tier", "F_UNVERIFIED"), "under_review", raw.get("version", 1)),
        ))

    for raw in payload["assertions"]:
        report["assertions"] += _inserted(conn.execute(
            """INSERT INTO cultural_assertions_v3
            (id,subject_id,predicate,value_json,qualifiers_json,statement_vi,confidence,consensus,review_status)
            VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["subject_id"], raw["predicate"], _json(raw.get("value")),
             _json(raw.get("qualifiers", {})), raw.get("statement_vi", ""), raw.get("confidence", 0.5),
             raw.get("consensus", "single_source"), "under_review"),
        ))
        for index, evidence in enumerate(raw.get("evidence", []), start=1):
            conn.execute(
                """INSERT INTO assertion_evidence_v3(id,assertion_id,source_id,locator)
                VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING""",
                (f"ev:{raw['id']}:{index}", raw["id"], evidence["source_id"], evidence.get("locator", "")),
            )

    for raw in payload["attribute_values"]:
        report["attribute_values"] += _inserted(conn.execute(
            """INSERT INTO attribute_values
            (id,entity_id,attribute_key,state,value_json,candidate_values_json,qualifiers_json,assertion_ids_json)
            VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["entity_id"], raw["attribute_key"], raw.get("state", "not_collected"),
             _json(raw.get("value")) if raw.get("value") is not None else None,
             _json(raw.get("candidate_values", [])), _json(raw.get("qualifiers", {})),
             _json(raw.get("assertion_ids", []))),
        ))

    for raw in payload["relations"]:
        report["relations"] += _inserted(conn.execute(
            """INSERT INTO entity_relations
            (id,subject_id,relation_type,object_id,state,qualifiers_json,assertion_ids_json)
            VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["subject_id"], raw["relation_type"], raw["object_id"], raw.get("state", "known"),
             _json(raw.get("qualifiers", {})), _json(raw.get("assertion_ids", []))),
        ))

    for raw in payload["rules"]:
        outcome = raw.get("then", {})
        report["rules"] += _inserted(conn.execute(
            """INSERT INTO cultural_rules_v3
            (id,entity_id,name,condition_json,severity,explanation,suggested_fix,qualifiers_json,assertion_ids_json,status,version)
            VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["scope"][0], raw.get("category", raw["id"]), _json(raw["when"]),
             SEVERITY_MAP[raw["severity"]], outcome.get("message_vi", ""), outcome.get("suggested_fix_vi"),
             "{}", _json(outcome.get("assertion_ids", [])), "draft", raw.get("version", 1)),
        ))

    for raw in payload["generation_profiles"]:
        may_vary = raw.get("may_vary", raw.get("user_overridable", []))
        forbidden = raw.get("do_not_invent", raw.get("forbidden", []))
        report["generation_profiles"] += _inserted(conn.execute(
            """INSERT INTO generation_profiles_v3
            (id,canonical_entity_id,must_preserve_json,may_vary_json,forbidden_json,reference_media_ids_json,version)
            VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
            (raw["id"], raw["subject_id"], _json(raw.get("must_preserve", [])), _json(may_vary),
             _json(forbidden), "[]", raw.get("version", 1)),
        ))

    report["media_candidates_retained"] = len(payload["media_candidates"])
    report.update(import_catalog_options(conn, payload["manifest"]["dataset_version"]))
    return {
        "package": payload["manifest"]["package"],
        "dataset_version": payload["manifest"]["dataset_version"],
        "inserted": report,
    }


def import_pilot_packages(package_names: Iterable[str] | None = None) -> list[dict[str, Any]]:
    names = list(package_names or PACKAGE_FILES)
    if not names or len(names) != len(set(names)):
        raise ValueError("Pilot package names must be unique and non-empty")
    payloads = [load_pilot_package(name) for name in names]
    for payload in payloads:
        validate_pilot_package(payload)
    with db_transaction() as conn:
        return [_import_payload(conn, payload) for payload in payloads]


def activate_pilot_packages_for_local_demo(
    package_names: Iterable[str] | None = None,
) -> dict[str, int]:
    """Publish only bundled pilot records for explicit local quality testing."""
    if settings.ENVIRONMENT not in ("development", "test"):
        raise ValueError("Pilot demo activation is only available in development/test")
    names = list(package_names or PACKAGE_FILES)
    payloads = [load_pilot_package(name) for name in names]
    counts = {
        "entities": 0,
        "attribute_definitions": 0,
        "relation_definitions": 0,
        "sources": 0,
        "assertions": 0,
        "rules": 0,
    }

    def update_ids(conn, table, column, ids, assignment):
        if not ids:
            return 0
        placeholders = ",".join("?" for _ in ids)
        cursor = conn.execute(
            f"UPDATE {table} SET {assignment} WHERE {column} IN ({placeholders})",
            tuple(ids),
        )
        return cursor.rowcount

    with db_transaction() as conn:
        for payload in payloads:
            counts["entities"] += update_ids(
                conn, "entity_registry", "id", [row["id"] for row in payload["entities"]], "status='published'"
            )
            counts["attribute_definitions"] += update_ids(
                conn, "attribute_definitions", "key", [row["key"] for row in payload["attribute_definitions"]], "status='active'"
            )
            counts["relation_definitions"] += update_ids(
                conn, "relation_definitions", "key", [row["key"] for row in payload["relation_definitions"]], "status='active'"
            )
            counts["sources"] += update_ids(
                conn, "cultural_sources_v3", "id", [row["id"] for row in payload["sources"]], "review_status='published'"
            )
            counts["assertions"] += update_ids(
                conn, "cultural_assertions_v3", "id", [row["id"] for row in payload["assertions"]], "review_status='published'"
            )
            counts["rules"] += update_ids(
                conn, "cultural_rules_v3", "id", [row["id"] for row in payload["rules"]], "status='published'"
            )
    return counts
