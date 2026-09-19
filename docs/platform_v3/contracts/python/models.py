from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator

MissingState = Literal[
    "known","unknown","not_collected","not_applicable",
    "disputed","inferred","withheld"
]

class ContextQualifier(BaseModel):
    period_ids: list[str] = Field(default_factory=list)
    region_ids: list[str] = Field(default_factory=list)
    place_ids: list[str] = Field(default_factory=list)
    community_ids: list[str] = Field(default_factory=list)
    occasion_ids: list[str] = Field(default_factory=list)
    social_context_ids: list[str] = Field(default_factory=list)

class Entity(BaseModel):
    id: str
    entity_type: str
    schema_version: str = "1.0"
    identity: dict[str, Any]
    status: Literal["draft","under_review","verified","published","deprecated"] = "draft"
    version: int = Field(default=1, ge=1)
    extensions: dict[str, Any] = Field(default_factory=dict)

class AttributeDefinition(BaseModel):
    key: str
    label_vi: str
    description: str | None = None
    value_type: Literal[
        "string","number","boolean","enum","entity_ref","entity_ref_list",
        "measurement","color","date_range","geo_ref","structured"
    ]
    cardinality: Literal["single","multiple"] = "single"
    allowed_values: list[Any] | None = None
    applies_to: list[str]
    contextual: bool = True
    queryable: bool = True
    inheritable: bool = True
    default_missing_state: Literal["unknown","not_collected","not_applicable"] = "not_collected"
    status: Literal["draft","active","deprecated"] = "draft"
    version: int = 1

class AttributeValue(BaseModel):
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
        if self.state == "known" and self.value is None:
            raise ValueError("known requires value")
        if self.state == "disputed" and not self.candidate_values:
            raise ValueError("disputed requires candidate_values")
        return self

class RelationDefinition(BaseModel):
    key: str
    label_vi: str
    source_types: list[str]
    target_types: list[str]
    directional: bool = True
    inverse_relation_key: str | None = None
    contextual: bool = True
    inheritable: bool = True
    status: Literal["draft","active","deprecated"] = "draft"
    version: int = 1

class EntityRelation(BaseModel):
    id: str
    subject_id: str
    relation_type: str
    object_id: str
    state: MissingState = "known"
    qualifiers: ContextQualifier = Field(default_factory=ContextQualifier)
    assertion_ids: list[str] = Field(default_factory=list)

class EvidenceRef(BaseModel):
    source_id: str
    locator: str

class CulturalAssertion(BaseModel):
    id: str
    subject_id: str
    predicate: str
    value: Any
    qualifiers: ContextQualifier = Field(default_factory=ContextQualifier)
    statement_vi: str = ""
    evidence: list[EvidenceRef]
    confidence: float = Field(ge=0, le=1)
    consensus: Literal["single_source","corroborated","strong_consensus","mixed","disputed","uncertain"]
    review_status: Literal["draft","under_review","verified","published","disputed","deprecated","rejected"]

class OutfitSelection(BaseModel):
    selection_id: str
    slot: str
    canonical_entity_id: str
    canonical_variant_id: str | None = None
    renderable_item_id: str | None = None
    render_variant_id: str | None = None
    style: dict[str, Any] = Field(default_factory=dict)
    transform: dict[str, Any] | None = None

class OutfitSpecV2(BaseModel):
    schema_version: Literal["2.0"] = "2.0"
    dataset_version: str
    ruleset_version: str | None = None
    selections: list[OutfitSelection] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
