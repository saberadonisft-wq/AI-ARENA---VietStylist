from __future__ import annotations
from typing import Any
from app.repositories.memory import MemoryRepository

class EffectiveEntityResolver:
    def __init__(self, repo: MemoryRepository):
        self.repo = repo

    def resolve(self, entity_id: str, context: dict[str, Any] | None = None):
        entity = self.repo.entities[entity_id]
        return {
            "entity": entity.model_dump(),
            "attributes": [v.model_dump() for v in self.repo.values_for(entity_id)],
            "relations": [r.model_dump() for r in self.repo.relations_from(entity_id)],
            "context": context or {},
        }
