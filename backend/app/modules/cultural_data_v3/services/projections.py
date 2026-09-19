"""Projection builders that transform the cultural graph into feature-specific views."""
from __future__ import annotations

from typing import Any, Dict, List

from app.modules.cultural_data_v3.services.resolver import EffectiveEntityResolver
from app.modules.cultural_data_v3.services.evidence import evidence_for_facts, constraint_evidence_issue
from app.modules.cultural_data_v3.services.composer import public_rules, renderables_for


class EducationProjectionBuilder:
    """Builds an education/detail view projection for a canonical entity."""

    def __init__(self, resolver: EffectiveEntityResolver):
        self.resolver = resolver

    def build(self, entity_id: str, *, public_only: bool = True, context: dict | None = None) -> Dict[str, Any]:
        data = self.resolver.describe(entity_id, public_only=public_only) if context is None else self.resolver.resolve(entity_id, context, public_only=public_only)
        entity = data["entity"]
        identity = entity.get("identity_json", entity.get("identity", {}))
        if isinstance(identity, str):
            import json
            identity = json.loads(identity)

        return {
            "projection_version": "education-1",
            "entity_id": entity_id,
            "title": identity.get("name_vi"),
            "aliases": identity.get("aliases", []),
            "entity_type": entity.get("entity_type"),
            "status": entity.get("status"),
            "attributes": data["attributes"],
            "relations": data["relations"],
            "context": data.get("context"),
            "evidence": evidence_for_facts([*data["attributes"], *data["relations"]], reader=self.resolver.reader),
        }


class ComposerBundleBuilder:
    """Builds a composer bundle projection for the outfit studio."""

    def __init__(self, resolver: EffectiveEntityResolver):
        self.resolver = resolver

    def build(self, entity_id: str, dataset_version: str = "dev", *, context: dict | None = None) -> Dict[str, Any]:
        data = self.resolver.resolve(entity_id, context)
        renderables, styles = renderables_for(entity_id, self.resolver.reader)
        rules = public_rules(data["lineage"], data["context"], self.resolver.reader)

        return {
            "projection_version": "composer-1",
            "dataset_version": dataset_version,
            "entity": data["entity"],
            "attributes": data["attributes"],
            "relations": data["relations"],
            "context": data["context"],
            "evidence": evidence_for_facts([*data["attributes"], *data["relations"], *rules], reader=self.resolver.reader),
            "renderables": renderables,
            "style_options": styles,
            "rules": rules,
        }


class GenerationProfileBuilder:
    """Builds an AI generation profile from canonical cultural data."""

    def __init__(self, resolver: EffectiveEntityResolver):
        self.resolver = resolver

    def build(self, entity_id: str, *, context: dict | None = None) -> Dict[str, Any]:
        data = self.resolver.resolve(entity_id, context)
        must_preserve: List[Dict[str, Any]] = []
        may_vary: List[str] = []
        evidence = evidence_for_facts([*data["attributes"], *data["relations"]], reader=self.resolver.reader)
        citations = {c["assertion_id"]: c for c in evidence}
        unresolved = [a for a in data["attributes"] if a["state"] != "known"]

        for attr in data["attributes"]:
            state = attr.get("state")
            key = attr.get("attribute_key")
            if state != "known" or not key:
                continue

            value = attr.get("value_json", attr.get("value"))
            assertion_ids = attr.get("assertion_ids_json", attr.get("assertion_ids", []))
            if isinstance(assertion_ids, str):
                import json
                assertion_ids = json.loads(assertion_ids)

            if key.startswith("construction."):
                issue = constraint_evidence_issue(attr, citations, reader=self.resolver.reader)
                if issue:
                    unresolved.append({**attr, "generation_status": "not_evaluated", "reason": issue})
                    continue
                must_preserve.append({
                    "feature": key,
                    "value": value,
                    "assertion_ids": assertion_ids,
                    "provenance": attr.get("provenance", []),
                    "qualifiers": attr.get("qualifiers", {}),
                    "subject_id": entity_id,
                })
            elif key.startswith("visual."):
                may_vary.append(key)

        return {
            "projection_version": "generation-profile-1",
            "subject_id": entity_id,
            "must_preserve": must_preserve,
            "may_vary": may_vary,
            "forbidden": [],
            "reference_media_ids": [],
            "context": data["context"],
            "unresolved": unresolved,
            "evidence": evidence,
        }
