"""Resolve scoped facts and inheritance without turning uncertainty into fact."""
from __future__ import annotations

from copy import deepcopy
import json
from typing import Any, Dict
from pydantic import ValidationError

from app.core.database import Database
from app.core.errors import AppError
from app.modules.cultural_data_v3.domain.models import ContextQualifier
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository, canonical_qualifiers, decode_record
from app.modules.cultural_data_v3.services.publication import PublicationPolicy


INHERITANCE_RELATIONS = frozenset({"variant_of", "regional_variant_of", "derived_from"})


def normalize_context(context: dict | None) -> dict:
    # Presentation fields in outfit context are not cultural qualifiers.
    try:
        value = ContextQualifier.model_validate({k: v for k, v in (context or {}).items() if k in ContextQualifier.model_fields})
    except ValidationError:
        raise AppError("INVALID_CONTEXT", "Context văn hóa không hợp lệ.", 422) from None
    return canonical_qualifiers(value.model_dump())


def matches(scope: dict, context: dict) -> bool:
    # All selected contexts must be covered, not just any intersecting ID.
    return all(context.get(key) and set(context[key]).issubset(ids) for key, ids in scope.items() if ids)


def intersect_scopes(left: dict, right: dict) -> dict | None:
    result = canonical_qualifiers(left)
    for key, ids in canonical_qualifiers(right).items():
        values = set(ids).intersection(result[key]) if key in result else set(ids)
        if not values:
            return None
        result[key] = sorted(values)
    return result


def more_specific(left: dict, right: dict) -> bool:
    # Period-only and region-only facts are incomparable, not arbitrarily ranked.
    return left != right and all(key in left and set(left[key]).issubset(ids) for key, ids in right.items())


class EffectiveEntityResolver:
    """Resolves a canonical entity with its effective attributes and relations."""

    def __init__(self, repo: CulturalDataV3Repository | None = None, *, reader=Database):
        self.repo = repo or CulturalDataV3Repository()
        self.reader = reader

    def _definitions(self):
        return (
            {d["key"]: d for d in self.repo.list_attribute_definitions()},
            {d["key"]: d for d in self.reader.fetch_all("SELECT * FROM relation_definitions")},
        )

    def _read(self, entity_id, public_only, policy, definitions, relation_definitions):
        entity_row = self.repo.get_entity(entity_id)
        if not entity_row or (public_only and entity_row["status"] != "published"):
            raise AppError("ENTITY_NOT_FOUND", "Không tìm thấy tri thức đã công bố.", 404)

        attributes = self.repo.values_for(entity_id)
        relations = self.repo.relations_from(entity_id)
        entity_row = decode_record(entity_row)
        if public_only:
            attributes = policy.attributes(attributes, definitions)
            relations = policy.relations(relations, relation_definitions)
            entity_row["extensions"] = {}
        else:
            attributes = [decode_record(row) for row in attributes]
            relations = [decode_record(row) for row in relations]

        return {
            "entity": entity_row,
            "attributes": attributes,
            "relations": relations,
        }

    def describe(self, entity_id: str, *, public_only=True) -> dict:
        """Browse direct facts with their scopes, without asserting applicability."""
        definitions, relation_definitions = self._definitions()
        return self._read(entity_id, public_only, PublicationPolicy(self.reader), definitions, relation_definitions)

    def resolve(self, entity_id: str, context: Dict[str, Any] | None = None, *, public_only=True) -> dict:
        context = normalize_context(context)
        for key, ids in context.items():
            entity_type = key.removesuffix("_ids")
            for selected_id in ids:
                row = self.repo.get_entity(selected_id)
                if not row or row["entity_type"] != entity_type or (public_only and row["status"] != "published"):
                    raise AppError("INVALID_CONTEXT", "Context văn hóa chưa khả dụng.", 422)
        definitions, relation_definitions = self._definitions()
        policy = PublicationPolicy(self.reader)
        cache = {}
        assertion_scopes = {}
        attributes, relations = [], []
        visits = 0

        def fact_scope(fact):
            scope = canonical_qualifiers(fact.get("qualifiers", {}))
            # An imported fact may have broader qualifiers than its evidence.
            # Never promote the claim beyond the scope of its supporting claims.
            for assertion_id in fact.get("assertion_ids", []):
                if assertion_id not in assertion_scopes:
                    row = self.reader.fetch_one("SELECT qualifiers_json FROM cultural_assertions_v3 WHERE id=?", (assertion_id,))
                    assertion_scopes[assertion_id] = decode_record(row).get("qualifiers", {}) if row else None
                assertion_scope = assertion_scopes[assertion_id]
                if assertion_scope is None:
                    return None
                scope = intersect_scopes(scope, assertion_scope)
                if scope is None:
                    return None
            return scope

        def walk(current_id, path, edge_ids, path_scope, path_assertions):
            nonlocal visits
            if current_id in path:
                raise AppError("INHERITANCE_CYCLE", "Dữ liệu kế thừa có chu trình; cần biên tập lại.", 409)
            visits += 1
            if len(path) > 32 or visits > 256:
                raise AppError("RESOLUTION_LIMIT", "Đồ thị kế thừa vượt giới hạn xử lý.", 422)
            if current_id not in cache:
                cache[current_id] = self._read(current_id, public_only, policy, definitions, relation_definitions)
            data = cache[current_id]
            chain = [*path, current_id]

            def effective(fact, definition):
                if not definition or (path and not definition["inheritable"]):
                    return None
                own_scope = fact_scope(fact)
                scope = intersect_scopes(path_scope, own_scope) if own_scope is not None else None
                if scope is None or not matches(scope, context):
                    return None
                return {
                    **deepcopy(fact), "qualifiers": scope,
                    "provenance": [{
                        "entity_id": current_id, "fact_id": fact["id"],
                        "entity_path": chain, "relation_path": edge_ids,
                        "assertion_ids": fact.get("assertion_ids", []), "qualifiers": scope,
                        "relation_assertion_ids": sorted(set(path_assertions)),
                    }], "_depth": len(path),
                }

            for fact in data["attributes"]:
                value = effective(fact, definitions.get(fact["attribute_key"]))
                if value:
                    attributes.append(value)
            for fact in data["relations"]:
                definition = relation_definitions.get(fact["relation_type"])
                if fact["relation_type"] in INHERITANCE_RELATIONS:
                    # inheritable controls copying the edge, not parent facts.
                    if not path:
                        value = effective(fact, definition)
                        if value:
                            relations.append(value)
                    own_scope = fact_scope(fact)
                    scope = intersect_scopes(path_scope, own_scope) if own_scope is not None else None
                    if fact["state"] == "known" and definition and definition["status"] == "active" and scope is not None and matches(scope, context):
                        walk(fact["object_id"], chain, [*edge_ids, fact["id"]], scope, [*path_assertions, *fact.get("assertion_ids", [])])
                else:
                    value = effective(fact, definition)
                    if value:
                        relations.append(value)

        walk(entity_id, [], [], {}, [])
        grouped = {}
        for fact in attributes:
            grouped.setdefault(fact["attribute_key"], []).append(fact)
        resolved = []
        for key, facts in sorted(grouped.items()):
            if definitions[key]["cardinality"] == "multiple":
                resolved.extend(self._deduplicate(facts))
                continue
            depth = min(f["_depth"] for f in facts)
            nearest = [f for f in facts if f["_depth"] == depth]
            winners = [f for f in nearest if not any(more_specific(other["qualifiers"], f["qualifiers"]) for other in nearest)]
            merged = self._merge_scalar(winners)
            if len({json.dumps(f["qualifiers"], sort_keys=True) for f in winners}) > 1:
                merged["qualifiers"] = context
            resolved.append(merged)
        return {
            "entity": cache[entity_id]["entity"], "attributes": resolved,
            "relations": self._deduplicate(relations), "context": context,
            "lineage": sorted(cache),
        }

    @staticmethod
    def _deduplicate(facts):
        result = {}
        for fact in sorted(facts, key=lambda f: (f["id"], json.dumps(f["qualifiers"], sort_keys=True))):
            fact = {k: v for k, v in fact.items() if k != "_depth"}
            key = (fact["id"], json.dumps(fact["qualifiers"], sort_keys=True))
            if key in result:
                for source in fact["provenance"]:
                    if source not in result[key]["provenance"]:
                        result[key]["provenance"].append(source)
            else:
                result[key] = fact
        return list(result.values())

    @classmethod
    def _merge_scalar(cls, facts):
        facts = cls._deduplicate(facts)
        result = deepcopy(facts[0])
        provenance = [p for f in facts for p in f["provenance"]]
        result["provenance"] = sorted(provenance, key=lambda p: (p["fact_id"], p["entity_path"]))
        result["assertion_ids"] = sorted({a for f in facts for a in f["assertion_ids"]})
        if any(f["state"] == "withheld" for f in facts):
            result.update(state="withheld", value=None, candidate_values=[], assertion_ids=[], provenance=[])
            return result
        signatures = {json.dumps([f["state"], f["value"], f["candidate_values"]], sort_keys=True) for f in facts}
        if len(signatures) > 1:
            result.update(state="disputed", value=None, candidate_values=[{
                "state": f["state"], "value": f["value"], "candidate_values": f["candidate_values"],
                "assertion_ids": f["assertion_ids"], "provenance": f["provenance"],
            } for f in facts])
        return result
