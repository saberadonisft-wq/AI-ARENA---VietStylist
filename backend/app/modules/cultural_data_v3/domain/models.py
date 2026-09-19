"""V3 Cultural Knowledge Graph domain models.

Source of truth for the meta-model. Matches blueprint contracts/python/models.py
with additional validation and documentation.
"""
from __future__ import annotations

import json
from typing import Annotated, Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .vocabularies import ENTITY_TYPES

Identifier = Annotated[str, Field(min_length=1, max_length=160, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")]
EntityStatus = Literal["draft", "under_review", "verified", "published", "deprecated"]


MissingState = Literal[
    "known", "unknown", "not_collected", "not_applicable",
    "disputed", "inferred", "withheld",
]


class ContextQualifier(BaseModel):
    """Qualifiers that scope a fact to specific period/region/community/occasion."""
    model_config = ConfigDict(extra="forbid")
    period_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    region_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    place_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    community_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    occasion_ids: list[Identifier] = Field(default_factory=list, max_length=32)
    social_context_ids: list[Identifier] = Field(default_factory=list, max_length=32)


class Entity(BaseModel):
    """Canonical cultural entity (garment, accessory, material, period, etc.)."""
    id: Identifier
    entity_type: str = Field(min_length=1, max_length=64)
    schema_version: str = "1.0"
    identity: dict[str, Any]
    status: EntityStatus = "draft"
    version: int = Field(default=1, ge=1)
    extensions: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_identity(self):
        if self.entity_type not in ENTITY_TYPES:
            raise ValueError("Unknown entity type")
        name = self.identity.get("name_vi")
        if not isinstance(name, str) or not name.strip() or len(name) > 300:
            raise ValueError("identity.name_vi must contain 1-300 characters")
        aliases = self.identity.get("aliases", [])
        if not isinstance(aliases, list) or len(aliases) > 100 or any(
            not isinstance(alias, str) or len(alias) > 300 for alias in aliases
        ):
            raise ValueError("Invalid identity.aliases")
        if len(json.dumps([self.identity, self.extensions], ensure_ascii=False).encode()) > 65536:
            raise ValueError("Entity metadata exceeds 64 KiB")
        return self


class AttributeDefinition(BaseModel):
    """Registry entry defining a cultural attribute key."""
    key: str
    label_vi: str
    description: str | None = None
    value_type: Literal[
        "string", "number", "boolean", "enum", "entity_ref", "entity_ref_list",
        "measurement", "color", "date_range", "geo_ref", "structured",
    ]
    cardinality: Literal["single", "multiple"] = "single"
    allowed_values: list[Any] | None = None
    applies_to: list[str]
    contextual: bool = True
    queryable: bool = True
    inheritable: bool = True
    default_missing_state: Literal["unknown", "not_collected", "not_applicable"] = "not_collected"
    status: Literal["draft", "active", "deprecated"] = "draft"
    version: int = 1


class AttributeValue(BaseModel):
    """An attribute value attached to an entity, with explicit missing-state semantics."""
    id: str
    entity_id: str
    attribute_key: str
    state: MissingState
    value: Any = None
    candidate_values: list[Any] = Field(default_factory=list)
    qualifiers: ContextQualifier = Field(default_factory=ContextQualifier)
    assertion_ids: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_missing_semantics(self):
        if self.state in ("known", "inferred") and self.value is None:
            raise ValueError(f"state='{self.state}' requires a non-null value")
        if self.state == "disputed" and not self.candidate_values:
            raise ValueError("state='disputed' requires at least one candidate_values entry")
        if self.state in ("unknown", "not_collected", "not_applicable", "withheld", "disputed") and self.value is not None:
            raise ValueError(f"state='{self.state}' must not contain a resolved value")
        if self.state != "disputed" and self.candidate_values:
            raise ValueError("Only disputed values may contain candidates")
        return self


class RelationDefinition(BaseModel):
    """Registry entry defining a relation type between entities."""
    key: str
    label_vi: str
    source_types: list[str]
    target_types: list[str]
    directional: bool = True
    inverse_relation_key: str | None = None
    contextual: bool = True
    inheritable: bool = True
    status: Literal["draft", "active", "deprecated"] = "draft"
    version: int = 1


class EntityRelation(BaseModel):
    """A typed, directional relation between two entities."""
    id: str
    subject_id: str
    relation_type: str
    object_id: str
    state: MissingState = "known"
    qualifiers: ContextQualifier = Field(default_factory=ContextQualifier)
    assertion_ids: list[str] = Field(default_factory=list)


class EvidenceRef(BaseModel):
    """Reference to evidence within a source."""
    source_id: str
    locator: str


class SourceRecord(BaseModel):
    """A scholarly, institutional, or community source with rights management."""
    id: str
    source_type: str
    title: str
    creator: str | None = None
    institution: str | None = None
    publication_date: str | None = None
    url: str | None = None
    accessed_at: str
    rights: dict[str, Any]
    trust_tier: str = "F_UNVERIFIED"
    review_status: str = "draft"
    version: int = 1


class CulturalAssertion(BaseModel):
    """An atomic cultural claim backed by evidence."""
    id: str
    subject_id: str
    predicate: str
    value: Any
    qualifiers: ContextQualifier = Field(default_factory=ContextQualifier)
    statement_vi: str = ""
    evidence: list[EvidenceRef]
    confidence: float = Field(ge=0, le=1)
    consensus: Literal[
        "single_source", "corroborated", "strong_consensus",
        "mixed", "disputed", "uncertain",
    ]
    review_status: Literal[
        "draft", "under_review", "verified", "published",
        "disputed", "deprecated", "rejected",
    ]


class OutfitSelection(BaseModel):
    """A single garment selection in an outfit."""
    selection_id: Identifier
    slot: Identifier
    canonical_entity_id: Identifier
    canonical_variant_id: Identifier | None = None
    renderable_item_id: str | None = None
    render_variant_id: str | None = None
    style: dict[str, Any] = Field(default_factory=dict)
    transform: dict[str, Any] | None = None


class OutfitSpecV2(BaseModel):
    """V2 outfit specification referencing canonical entities and dataset version."""
    schema_version: Literal["2.0"] = "2.0"
    dataset_version: str = Field(min_length=1, max_length=160)
    ruleset_version: str | None = None
    selections: list[OutfitSelection] = Field(default_factory=list, max_length=32)
    context: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def unique_selections(self):
        if len({s.selection_id for s in self.selections}) != len(self.selections):
            raise ValueError("Duplicate selection IDs")
        if len({s.slot for s in self.selections}) != len(self.selections):
            raise ValueError("Duplicate selection slots")
        return self
