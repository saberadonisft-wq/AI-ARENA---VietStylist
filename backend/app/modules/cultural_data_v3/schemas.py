"""Pydantic response schemas for V3 API endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.modules.cultural_data_v3.domain.models import Entity, EntityStatus, Identifier, OutfitSpecV2


class EntityCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Identifier
    entity_type: str
    identity: Dict[str, Any]
    status: EntityStatus = "draft"
    extensions: Dict[str, Any] = {}

    @model_validator(mode="after")
    def validate_entity(self):
        Entity(**self.model_dump())
        return self


class DatasetCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: str = Field(min_length=1, max_length=160)


class DatasetMetadataResponse(BaseModel):
    dataset_version: str
    label: str
    entity_count: int
    attribute_count: int
    relation_count: int
    content_hash: str
    format_version: int
    ruleset_version: str
    created_at: str


class LegacyMappingResponse(BaseModel):
    legacy_table: str
    legacy_id: str
    canonical_entity_id: str
    canonical_entity_type: str
    renderable_item_id: Optional[str] = None
    render_variants: Dict[str, str] = {}


class LegacyMappingBundleResponse(BaseModel):
    dataset_version: str
    ruleset_version: str
    reproducible: bool
    mappings: List[LegacyMappingResponse]


class EntityStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: EntityStatus
    version: int = Field(ge=1)


class EntityResponse(BaseModel):
    id: str
    entity_type: str
    schema_version: str = "1.0"
    identity: Dict[str, Any]
    status: str
    version: int
    extensions: Dict[str, Any] = {}


class CitationSource(BaseModel):
    source_id: str
    title: str
    creator: Optional[str] = None
    institution: Optional[str] = None
    publication_date: Optional[str] = None
    url: Optional[str] = None
    trust_tier: str
    version: int
    rights: Dict[str, Any]
    locator: str


class EvidenceCitation(BaseModel):
    assertion_id: str
    subject_id: str
    predicate: str
    qualifiers: Dict[str, List[str]]
    confidence: float
    consensus: str
    sources: List[CitationSource]


class EducationProjectionResponse(BaseModel):
    evidence: List[EvidenceCitation] = []
    context: Optional[Dict[str, Any]] = None
    projection_version: str
    entity_id: str
    title: Optional[str] = None
    aliases: List[str] = []
    entity_type: Optional[str] = None
    status: Optional[str] = None
    attributes: List[Dict[str, Any]] = []
    relations: List[Dict[str, Any]] = []


class ComposerBundleResponse(BaseModel):
    ruleset_version: str = "dev"
    reproducible: bool = False
    evidence: List[EvidenceCitation] = []
    context: Dict[str, Any] = {}
    projection_version: str
    dataset_version: str
    entity: Dict[str, Any]
    attributes: List[Dict[str, Any]] = []
    relations: List[Dict[str, Any]] = []
    renderables: List[Any] = []
    style_options: List[Any] = []
    rules: List[Any] = []


class GenerationProfileResponse(BaseModel):
    evidence: List[EvidenceCitation] = []
    context: Dict[str, Any] = {}
    unresolved: List[Dict[str, Any]] = []
    projection_version: str
    subject_id: str
    must_preserve: List[Dict[str, Any]] = []
    may_vary: List[str] = []
    forbidden: List[Any] = []
    reference_media_ids: List[str] = []


class OutfitValidationResponse(BaseModel):
    status: Literal["clear", "warning", "error", "not_evaluated"]
    missing_entities: List[str] = []
    unchecked_entities: List[str] = []
    unevaluated_rule_ids: List[str] = []
    evaluated_rule_count: int = 0
    violations: List[Dict[str, Any]] = []
    dataset: Dict[str, Any] = {}
    outfit: Dict[str, Any] = {}


class GroundingResponse(BaseModel):
    grounding: Dict[str, Any]


class PromptSynthesisResponse(BaseModel):
    positive_prompt: str
    negative_prompt: str
    grounding_hash: str


class SynthesizeRequest(BaseModel):
    outfit: OutfitSpecV2
    legacy_item_ids: List[str] = Field(default_factory=list, max_length=32)
    outfit_image_id: str
    user_image_id: Optional[str] = None
    model_id: Optional[
        Literal[
            "gemini-3.1-flash-image",
            "gemini-3.1-flash-lite-image",
            "gemini-3-pro-image",
            "gemini-2.5-flash-image",
        ]
    ] = None
    options: Dict[str, Any] = {}
    idempotency_key: Optional[str] = Field(default=None, min_length=1, max_length=160)


class SynthesizeResponse(BaseModel):
    status: str
    model_id: str
    result_media_id: Optional[str] = None
    prompt_used: str = ""
    post_validation: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}


class GenerationAvailabilityResponse(BaseModel):
    enabled: bool


class GenerationJobResponse(BaseModel):
    job_id: str
    status: Literal["running", "completed", "failed"]
    result: Optional[SynthesizeResponse] = None
    error: Optional[Dict[str, Any]] = None
