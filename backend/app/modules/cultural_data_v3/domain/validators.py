"""Registry validation logic for the V3 cultural data meta-model."""
from __future__ import annotations

import math
import re
from typing import Any

from .models import (
    AttributeDefinition,
    AttributeValue,
    Entity,
    EntityRelation,
    RelationDefinition,
)


def validate_attribute_value(
    value: AttributeValue,
    definition: AttributeDefinition | None,
    entity: Entity | None,
) -> list[str]:
    """Validate an attribute value against its registry definition and owning entity.

    Returns a list of error messages (empty if valid).
    """
    errors: list[str] = []

    if definition is None:
        errors.append(f"Unknown attribute key: {value.attribute_key}")
        return errors

    if entity is None:
        errors.append(f"Unknown entity: {value.entity_id}")
        return errors

    if entity.entity_type not in definition.applies_to:
        errors.append(
            f"Attribute '{value.attribute_key}' does not apply to entity type '{entity.entity_type}'"
        )

    if definition.status == "deprecated":
        errors.append("Cannot write values for a deprecated attribute")
    if not definition.contextual and any(value.qualifiers.model_dump().values()):
        errors.append("Non-contextual attribute cannot have qualifiers")
    candidates = value.candidate_values if value.state == "disputed" else [value.value]
    for candidate in candidates:
        actual = candidate.get("value") if value.state == "disputed" and isinstance(candidate, dict) else candidate
        if actual is None:
            if value.state == "disputed":
                errors.append("Disputed candidate requires a value")
            continue
        error = validate_typed_value(actual, definition)
        if error:
            errors.append(error)

    return errors


def validate_typed_value(actual: Any, definition: AttributeDefinition) -> str | None:
    kind = definition.value_type
    number = lambda x: isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)

    def measurement(value):
        if not isinstance(value, dict) or not isinstance(value.get("unit"), str) or not value["unit"]:
            return False
        if number(value.get("value")):
            return True
        return number(value.get("min")) and number(value.get("max")) and value["min"] <= value["max"]

    checks = {
        "string": lambda x: isinstance(x, str),
        "number": number,
        "boolean": lambda x: isinstance(x, bool),
        "enum": lambda x: definition.allowed_values is not None and any(type(x) is type(v) and x == v for v in definition.allowed_values),
        "entity_ref": lambda x: isinstance(x, str) and bool(x),
        "entity_ref_list": lambda x: isinstance(x, list) and all(isinstance(v, str) and bool(v) for v in x) and len(x) == len(set(x)),
        "measurement": measurement,
        "color": lambda x: isinstance(x, str) and re.fullmatch(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})", x) is not None,
        "date_range": lambda x: isinstance(x, dict) and number(x.get("start")) and number(x.get("end")) and x["start"] <= x["end"],
        "geo_ref": lambda x: isinstance(x, str) and bool(x),
        "structured": lambda x: isinstance(x, (dict, list)),
    }
    if not checks[kind](actual):
        return f"Value not in allowed_values for '{definition.key}'" if kind == "enum" else f"Invalid {kind} value for '{definition.key}'"
    return None


def validate_relation(
    relation: EntityRelation,
    definition: RelationDefinition | None,
    subject: Entity | None,
    obj: Entity | None,
) -> list[str]:
    """Validate a relation against its registry definition and endpoint entities.

    Returns a list of error messages (empty if valid).
    """
    errors: list[str] = []

    if definition is None:
        errors.append(f"Unknown relation type: {relation.relation_type}")
        return errors

    if subject is None:
        errors.append(f"Unknown subject entity: {relation.subject_id}")
        return errors

    if obj is None:
        errors.append(f"Unknown object entity: {relation.object_id}")
        return errors

    if subject.entity_type not in definition.source_types:
        errors.append(
            f"Entity type '{subject.entity_type}' is not a valid source for relation '{relation.relation_type}'"
        )

    if obj.entity_type not in definition.target_types:
        errors.append(
            f"Entity type '{obj.entity_type}' is not a valid target for relation '{relation.relation_type}'"
        )

    if definition.status == "deprecated":
        errors.append("Cannot use a deprecated relation")
    if not definition.contextual and any(relation.qualifiers.model_dump().values()):
        errors.append("Non-contextual relation cannot have qualifiers")

    return errors
