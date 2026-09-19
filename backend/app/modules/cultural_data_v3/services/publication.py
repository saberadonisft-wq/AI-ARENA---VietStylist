"""Publication boundary shared by every public cultural projection.

An entity's publication does not publish referenced entities or evidence.
This policy is evaluated per request; withdrawing a source takes effect immediately.
"""
from app.core.database import Database
from app.modules.cultural_data_v3.repository import decode_record


class PublicationPolicy:
    def __init__(self, reader=Database):
        self.reader = reader
        self._entities = {}
        self._assertions = {}

    def entity_is_public(self, entity_id):
        if entity_id not in self._entities:
            self._entities[entity_id] = bool(self.reader.fetch_one(
                "SELECT id FROM entity_registry WHERE id=? AND status='published'", (entity_id,)
            ))
        return self._entities[entity_id]

    def assertion_is_public(self, assertion_id):
        if assertion_id not in self._assertions:
            assertion = self.reader.fetch_one(
                "SELECT subject_id,qualifiers_json FROM cultural_assertions_v3 WHERE id=? AND review_status='published'", (assertion_id,)
            )
            evidence = self.reader.fetch_all(
                "SELECT s.review_status FROM assertion_evidence_v3 e JOIN cultural_sources_v3 s ON s.id=e.source_id WHERE e.assertion_id=?",
                (assertion_id,),
            )
            self._assertions[assertion_id] = bool(
                assertion and self.entity_is_public(assertion["subject_id"])
                and all(self.entity_is_public(entity_id) for ids in decode_record(assertion).get("qualifiers", {}).values() for entity_id in ids)
                and evidence and all(e["review_status"] == "published" for e in evidence)
            )
        return self._assertions[assertion_id]

    def fact_is_public(self, fact, definition):
        if not definition or definition["status"] != "active":
            return False
        if any(not self.entity_is_public(entity_id) for ids in fact.get("qualifiers", {}).values() for entity_id in ids):
            return False
        if any(not self.assertion_is_public(a) for a in fact.get("assertion_ids", [])):
            return False
        candidates = fact.get("candidate_values", [])
        for candidate in candidates:
            if isinstance(candidate, dict) and any(not self.assertion_is_public(a) for a in candidate.get("assertion_ids", [])):
                return False
        if definition.get("value_type") in ("entity_ref", "entity_ref_list", "geo_ref"):
            for raw in [fact.get("value"), *candidates]:
                value = raw.get("value") if isinstance(raw, dict) else raw
                if value is not None and any(not self.entity_is_public(e) for e in (value if isinstance(value, list) else [value])):
                    return False
        return True

    def attributes(self, rows, definitions):
        result = []
        for row in rows:
            fact = decode_record(row)
            if fact["state"] == "withheld":
                # Redact legacy stored payloads too, even if they bypassed today's validator.
                if definitions.get(fact["attribute_key"], {}).get("status") == "active":
                    result.append({"id": fact["id"], "entity_id": fact["entity_id"], "attribute_key": fact["attribute_key"], "state": "withheld", "value": None, "candidate_values": [], "qualifiers": {}, "assertion_ids": []})
            elif self.fact_is_public(fact, definitions.get(fact["attribute_key"])):
                result.append(fact)
        return result

    def relations(self, rows, definitions):
        result = []
        for row in rows:
            fact = decode_record(row)
            if fact["state"] == "withheld":
                continue
            if self.entity_is_public(fact["object_id"]) and self.fact_is_public(fact, definitions.get(fact["relation_type"])):
                result.append(fact)
        return result
