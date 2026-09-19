from __future__ import annotations
from app.services.resolver import EffectiveEntityResolver

class EducationProjectionBuilder:
    def __init__(self, resolver: EffectiveEntityResolver):
        self.resolver = resolver

    def build(self, entity_id: str):
        data = self.resolver.resolve(entity_id)
        entity = data["entity"]
        return {
            "projection_version": "education-1",
            "entity_id": entity_id,
            "title": entity["identity"].get("name_vi"),
            "aliases": entity["identity"].get("aliases", []),
            "attributes": data["attributes"],
            "relations": data["relations"],
        }

class ComposerBundleBuilder:
    def __init__(self, resolver: EffectiveEntityResolver):
        self.resolver = resolver

    def build(self, entity_id: str, dataset_version: str = "dev"):
        data = self.resolver.resolve(entity_id)
        return {
            "projection_version": "composer-1",
            "dataset_version": dataset_version,
            "entity": data["entity"],
            "attributes": data["attributes"],
            "relations": data["relations"],
            "renderables": [],
            "style_options": [],
            "rules": [],
        }

class GenerationProfileBuilder:
    def __init__(self, resolver: EffectiveEntityResolver):
        self.resolver = resolver

    def build(self, entity_id: str):
        data = self.resolver.resolve(entity_id)
        must_preserve = []
        may_vary = []

        for attr in data["attributes"]:
            if attr["state"] != "known":
                continue
            if attr["attribute_key"].startswith("construction."):
                must_preserve.append({
                    "feature": attr["attribute_key"],
                    "value": attr["value"],
                    "assertion_ids": attr["assertion_ids"],
                })
            elif attr["attribute_key"].startswith("visual."):
                may_vary.append(attr["attribute_key"])

        return {
            "projection_version": "generation-profile-1",
            "subject_id": entity_id,
            "must_preserve": must_preserve,
            "may_vary": may_vary,
            "forbidden": [],
            "reference_media_ids": [],
        }
