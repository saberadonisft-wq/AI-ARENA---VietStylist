from __future__ import annotations
from app.domain.models import (
    Entity, AttributeDefinition, AttributeValue,
    RelationDefinition, EntityRelation
)

class MemoryRepository:
    def __init__(self):
        self.entities: dict[str, Entity] = {}
        self.attribute_definitions: dict[str, AttributeDefinition] = {}
        self.attribute_values: list[AttributeValue] = []
        self.relation_definitions: dict[str, RelationDefinition] = {}
        self.relations: list[EntityRelation] = []

    def add_entity(self, entity: Entity):
        self.entities[entity.id] = entity

    def add_attribute_definition(self, definition: AttributeDefinition):
        self.attribute_definitions[definition.key] = definition

    def add_attribute_value(self, value: AttributeValue):
        definition = self.attribute_definitions.get(value.attribute_key)
        if not definition:
            raise ValueError(f"Unknown attribute key: {value.attribute_key}")
        entity = self.entities.get(value.entity_id)
        if not entity:
            raise ValueError(f"Unknown entity: {value.entity_id}")
        if entity.entity_type not in definition.applies_to:
            raise ValueError(
                f"{value.attribute_key} does not apply to {entity.entity_type}"
            )
        self.attribute_values.append(value)

    def add_relation_definition(self, definition: RelationDefinition):
        self.relation_definitions[definition.key] = definition

    def add_relation(self, relation: EntityRelation):
        definition = self.relation_definitions.get(relation.relation_type)
        if not definition:
            raise ValueError(f"Unknown relation type: {relation.relation_type}")
        subject = self.entities.get(relation.subject_id)
        obj = self.entities.get(relation.object_id)
        if not subject or not obj:
            raise ValueError("Unknown relation endpoint")
        if subject.entity_type not in definition.source_types:
            raise ValueError("Invalid relation source type")
        if obj.entity_type not in definition.target_types:
            raise ValueError("Invalid relation target type")
        self.relations.append(relation)

    def values_for(self, entity_id: str):
        return [v for v in self.attribute_values if v.entity_id == entity_id]

    def relations_from(self, entity_id: str):
        return [r for r in self.relations if r.subject_id == entity_id]
