"""V3 Cultural Data repository with registry validation."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from app.core.database import Database, get_db_connection, db_transaction
from app.modules.cultural_data_v3.domain.models import (
    Entity,
    AttributeDefinition,
    AttributeValue,
    RelationDefinition,
    EntityRelation,
)
from app.modules.cultural_data_v3.domain.validators import validate_attribute_value, validate_relation


def decode_record(row: Dict[str, Any]) -> Dict[str, Any]:
    """Convert storage columns to domain fields, including scalar JSON values."""
    result = {}
    for key, value in row.items():
        if key.endswith("_json"):
            if isinstance(value, str):
                value = json.loads(value)
            key = key[:-5]
        result[key] = value
    return result


def canonical_qualifiers(qualifiers: dict) -> dict:
    return {key: sorted(set(values)) for key, values in qualifiers.items() if values}


class GraphReadRepository:
    """The same graph queries against live DB or an immutable dataset reader."""
    def __init__(self, reader=Database):
        self.reader = reader

    def get_entity(self, entity_id):
        return self.reader.fetch_one("SELECT * FROM entity_registry WHERE id=?", (entity_id,))

    def values_for(self, entity_id):
        return self.reader.fetch_all("SELECT * FROM attribute_values WHERE entity_id=? ORDER BY attribute_key,id", (entity_id,))

    def relations_from(self, entity_id):
        return self.reader.fetch_all("SELECT * FROM entity_relations WHERE subject_id=? ORDER BY relation_type,id", (entity_id,))

    def list_attribute_definitions(self):
        return self.reader.fetch_all("SELECT * FROM attribute_definitions ORDER BY key")


def validate_references(value, definition, conn):
    """Validate references in the same write transaction as their owning fact."""
    qualifier_types = {
        "period_ids": "period", "region_ids": "region", "place_ids": "place",
        "community_ids": "community", "occasion_ids": "occasion", "social_context_ids": "social_context",
    }
    for key, ids in value.qualifiers.model_dump().items():
        for entity_id in ids:
            row = Database.fetch_one("SELECT entity_type FROM entity_registry WHERE id=?", (entity_id,), conn)
            if not row or row["entity_type"] != qualifier_types[key]:
                raise ValueError(f"Invalid qualifier reference: {key}")
    assertion_ids = list(value.assertion_ids)
    if isinstance(value, AttributeValue):
        for candidate in value.candidate_values:
            if isinstance(candidate, dict):
                ids = candidate.get("assertion_ids", [])
                if not isinstance(ids, list) or any(not isinstance(x, str) for x in ids):
                    raise ValueError("Invalid candidate assertion references")
                assertion_ids.extend(ids)
        candidates = value.candidate_values if value.state == "disputed" else [value.value]
        for candidate in candidates:
            actual = candidate.get("value") if value.state == "disputed" and isinstance(candidate, dict) else candidate
            if actual is None:
                continue
            if definition.value_type in ("entity_ref", "entity_ref_list", "geo_ref"):
                for entity_id in actual if isinstance(actual, list) else [actual]:
                    row = Database.fetch_one("SELECT entity_type FROM entity_registry WHERE id=?", (entity_id,), conn)
                    if not row or (definition.value_type == "geo_ref" and row["entity_type"] not in ("place", "region")):
                        raise ValueError("Invalid entity reference")
    for assertion_id in assertion_ids:
        if not Database.fetch_one("SELECT id FROM cultural_assertions_v3 WHERE id=?", (assertion_id,), conn):
            raise ValueError("Unknown assertion reference")


class CulturalDataV3Repository:
    """Repository for V3 cultural knowledge graph with registry enforcement."""

    # --- Entity ---

    @staticmethod
    def add_entity(entity: Entity) -> None:
        entity = Entity.model_validate(entity.model_dump())
        Database.execute(
            "INSERT INTO entity_registry (id, entity_type, schema_version, identity_json, status, version, extensions_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                entity.id,
                entity.entity_type,
                entity.schema_version,
                json.dumps(entity.identity, ensure_ascii=False),
                entity.status,
                entity.version,
                json.dumps(entity.extensions, ensure_ascii=False),
            ),
        )

    @staticmethod
    def get_entity(entity_id: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM entity_registry WHERE id = ?", (entity_id,))

    @staticmethod
    def list_entities(
        entity_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        query = "SELECT * FROM entity_registry WHERE 1=1"
        params: list[Any] = []
        if entity_type:
            query += " AND entity_type = ?"
            params.append(entity_type)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY created_at ASC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return Database.fetch_all(query, tuple(params))

    # --- Attribute Definition ---

    @staticmethod
    def add_attribute_definition(definition: AttributeDefinition) -> None:
        Database.execute(
            "INSERT OR IGNORE INTO attribute_definitions (key, label_vi, description, value_type, cardinality, allowed_values_json, applies_to_json, contextual, queryable, inheritable, default_missing_state, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                definition.key,
                definition.label_vi,
                definition.description,
                definition.value_type,
                definition.cardinality,
                json.dumps(definition.allowed_values, ensure_ascii=False) if definition.allowed_values else None,
                json.dumps(definition.applies_to, ensure_ascii=False),
                1 if definition.contextual else 0,
                1 if definition.queryable else 0,
                1 if definition.inheritable else 0,
                definition.default_missing_state,
                definition.status,
                definition.version,
            ),
        )

    @staticmethod
    def get_attribute_definition(key: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM attribute_definitions WHERE key = ?", (key,))

    @staticmethod
    def list_attribute_definitions() -> List[Dict[str, Any]]:
        return Database.fetch_all("SELECT * FROM attribute_definitions ORDER BY key")

    # --- Attribute Value ---

    @staticmethod
    def add_attribute_value(value: AttributeValue) -> None:
        """Add an attribute value with registry validation."""
        value = AttributeValue.model_validate(value.model_dump())
        with db_transaction() as conn:
            row = Database.fetch_one("SELECT * FROM attribute_definitions WHERE key=?", (value.attribute_key,), conn)
            definition = AttributeDefinition.model_validate(decode_record(row)) if row else None
            row = Database.fetch_one("SELECT * FROM entity_registry WHERE id=?", (value.entity_id,), conn)
            entity = Entity.model_validate(decode_record(row)) if row else None
            errors = validate_attribute_value(value, definition, entity)
            if errors:
                raise ValueError("; ".join(errors))
            validate_references(value, definition, conn)
            qualifiers = canonical_qualifiers(value.qualifiers.model_dump())
            if definition.cardinality == "single":
                existing = Database.fetch_all("SELECT qualifiers_json FROM attribute_values WHERE entity_id=? AND attribute_key=?", (value.entity_id, value.attribute_key), conn)
                if any(canonical_qualifiers(decode_record(r)["qualifiers"]) == qualifiers for r in existing):
                    raise ValueError("Single-cardinality attribute already has a value in this context")
            Database.execute(
            "INSERT INTO attribute_values (id, entity_id, attribute_key, state, value_json, candidate_values_json, qualifiers_json, assertion_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                value.id,
                value.entity_id,
                value.attribute_key,
                value.state,
                json.dumps(value.value, ensure_ascii=False) if value.value is not None else None,
                json.dumps(value.candidate_values, ensure_ascii=False),
                json.dumps(qualifiers, sort_keys=True),
                json.dumps(value.assertion_ids, ensure_ascii=False),
            ), conn,
            )

    @staticmethod
    def values_for(entity_id: str) -> List[Dict[str, Any]]:
        rows = Database.fetch_all(
            "SELECT * FROM attribute_values WHERE entity_id = ? ORDER BY attribute_key",
            (entity_id,),
        )
        for r in rows:
            if "value" not in r or r["value"] is None:
                v_raw = r.get("value_json")
                if v_raw is not None:
                    try:
                        r["value"] = json.loads(v_raw) if isinstance(v_raw, str) else v_raw
                    except Exception:
                        r["value"] = v_raw
        return rows

    # --- Relation Definition ---

    @staticmethod
    def add_relation_definition(definition: RelationDefinition) -> None:
        Database.execute(
            "INSERT OR IGNORE INTO relation_definitions (key, label_vi, source_types_json, target_types_json, directional, inverse_relation_key, contextual, inheritable, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                definition.key,
                definition.label_vi,
                json.dumps(definition.source_types, ensure_ascii=False),
                json.dumps(definition.target_types, ensure_ascii=False),
                1 if definition.directional else 0,
                definition.inverse_relation_key,
                1 if definition.contextual else 0,
                1 if definition.inheritable else 0,
                definition.status,
                definition.version,
            ),
        )

    @staticmethod
    def get_relation_definition(key: str) -> Optional[Dict[str, Any]]:
        return Database.fetch_one("SELECT * FROM relation_definitions WHERE key = ?", (key,))

    # --- Entity Relation ---

    @staticmethod
    def add_relation(relation: EntityRelation) -> None:
        """Add a relation with registry validation."""
        relation = EntityRelation.model_validate(relation.model_dump())
        with db_transaction() as conn:
            row = Database.fetch_one("SELECT * FROM relation_definitions WHERE key=?", (relation.relation_type,), conn)
            definition = RelationDefinition.model_validate(decode_record(row)) if row else None
            row = Database.fetch_one("SELECT * FROM entity_registry WHERE id=?", (relation.subject_id,), conn)
            subject = Entity.model_validate(decode_record(row)) if row else None
            row = Database.fetch_one("SELECT * FROM entity_registry WHERE id=?", (relation.object_id,), conn)
            obj = Entity.model_validate(decode_record(row)) if row else None
            errors = validate_relation(relation, definition, subject, obj)
            if errors:
                raise ValueError("; ".join(errors))
            validate_references(relation, definition, conn)
            Database.execute(
            "INSERT INTO entity_relations (id, subject_id, relation_type, object_id, state, qualifiers_json, assertion_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                relation.id,
                relation.subject_id,
                relation.relation_type,
                relation.object_id,
                relation.state,
                json.dumps(canonical_qualifiers(relation.qualifiers.model_dump()), sort_keys=True),
                json.dumps(relation.assertion_ids, ensure_ascii=False),
            ), conn,
            )

    @staticmethod
    def relations_from(entity_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all(
            "SELECT * FROM entity_relations WHERE subject_id = ? ORDER BY relation_type",
            (entity_id,),
        )

    @staticmethod
    def relations_to(entity_id: str) -> List[Dict[str, Any]]:
        return Database.fetch_all(
            "SELECT * FROM entity_relations WHERE object_id = ? ORDER BY relation_type",
            (entity_id,),
        )

    # --- Legacy Mapping ---

    @staticmethod
    def create_legacy_mapping(
        legacy_table: str, legacy_id: str, entity_id: str, mapping_kind: str
    ) -> None:
        Database.execute(
            "INSERT OR IGNORE INTO legacy_entity_mappings_v3 (legacy_table, legacy_id, entity_id, mapping_kind) VALUES (?, ?, ?, ?)",
            (legacy_table, legacy_id, entity_id, mapping_kind),
        )

    @staticmethod
    def get_entity_by_legacy(
        legacy_table: str, legacy_id: str
    ) -> Optional[Dict[str, Any]]:
        mapping = Database.fetch_one(
            "SELECT entity_id FROM legacy_entity_mappings_v3 WHERE legacy_table = ? AND legacy_id = ?",
            (legacy_table, legacy_id),
        )
        if not mapping:
            return None
        return CulturalDataV3Repository.get_entity(mapping["entity_id"])
