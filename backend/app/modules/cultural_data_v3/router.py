"""V3 API router — cultural knowledge graph endpoints.

All endpoints are under /api/v3 and coexist with V1 endpoints.
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from starlette.concurrency import run_in_threadpool
from app.core.config import settings
from app.core.database import Database, db_transaction, INTEGRITY_ERRORS, is_unique_violation
from app.core.errors import AppError
from app.core.security import AuthenticatedUser, get_current_user_optional, require_current_user, require_role

from app.modules.cultural_data_v3.domain.models import Entity, Identifier, OutfitSpecV2
from app.modules.cultural_rules.schemas import CulturalCheckRequest
from app.modules.cultural_data_v3.repository import CulturalDataV3Repository, decode_record
from app.modules.cultural_data_v3.schemas import (
    EntityCreateRequest,
    EntityResponse,
    EducationProjectionResponse,
    ComposerBundleResponse,
    GenerationProfileResponse,
    OutfitValidationResponse,
    EntityStatusRequest,
    GroundingResponse,
    PromptSynthesisResponse,
    SynthesizeRequest,
    SynthesizeResponse,
    GenerationAvailabilityResponse,
    GenerationJobResponse,
    DatasetCreateRequest,
    DatasetMetadataResponse,
    LegacyMappingBundleResponse,
)
from app.modules.cultural_data_v3.services.resolver import EffectiveEntityResolver, INHERITANCE_RELATIONS
from app.modules.cultural_data_v3.services.datasets import create_dataset, dataset_metadata, dataset_resolver, load_content
from app.modules.cultural_data_v3.services.projections import (
    EducationProjectionBuilder,
    ComposerBundleBuilder,
    GenerationProfileBuilder,
)

router = APIRouter(prefix="/v3", tags=["Cultural Data V3"], dependencies=[Depends(get_current_user_optional)])

repo = CulturalDataV3Repository()
resolver = EffectiveEntityResolver(repo)

education_builder = EducationProjectionBuilder(resolver)
composer_builder = ComposerBundleBuilder(resolver)
generation_builder = GenerationProfileBuilder(resolver)


def projection_context(
    period_ids: Optional[List[Identifier]] = Query(None, max_length=32),
    region_ids: Optional[List[Identifier]] = Query(None, max_length=32),
    place_ids: Optional[List[Identifier]] = Query(None, max_length=32),
    community_ids: Optional[List[Identifier]] = Query(None, max_length=32),
    occasion_ids: Optional[List[Identifier]] = Query(None, max_length=32),
    social_context_ids: Optional[List[Identifier]] = Query(None, max_length=32),
):
    context = {k: v for k, v in locals().items() if v is not None}
    return context or None


def build_grounding(outfit: OutfitSpecV2):
    with dataset_resolver(outfit.dataset_version, outfit.ruleset_version) as (selected_resolver, metadata):
        return build_grounding_from_dataset(outfit, selected_resolver, metadata)


def build_grounding_from_dataset(outfit, selected_resolver, metadata):
    from app.modules.cultural_data_v3.services.generation import GroundingBuilder

    profiles = []
    for selection in outfit.selections:
        root = selected_resolver.repo.get_entity(selection.canonical_entity_id)
        if not root or root["status"] != "published":
            raise HTTPException(404, "Entity not found")
        if selection.canonical_variant_id:
            variant = selected_resolver.repo.get_entity(selection.canonical_variant_id)
            if not variant or variant["status"] != "published":
                raise HTTPException(404, "Entity not found")
            if variant["entity_type"] != "garment_variant" or not any(
                r["object_id"] == selection.canonical_entity_id
                and r["relation_type"] in INHERITANCE_RELATIONS
                and r["state"] == "known"
                for r in selected_resolver.resolve(selection.canonical_variant_id, outfit.context)["relations"]
            ):
                raise AppError("INVALID_VARIANT", "Biến thể không thuộc trang phục đã chọn.", 422)
        profile = GenerationProfileBuilder(selected_resolver).build(selection.canonical_variant_id or selection.canonical_entity_id, context=outfit.context)
        profile["selection_id"] = selection.selection_id
        for fact in profile["must_preserve"]:
            fact["selection_id"] = selection.selection_id
            fact["slot"] = selection.slot
        profiles.append(profile)
    return GroundingBuilder().build(outfit.model_dump(), profiles, dataset=metadata)


@router.post("/editor/datasets", response_model=DatasetMetadataResponse, status_code=201)
def freeze_dataset(req: DatasetCreateRequest, user: AuthenticatedUser = Depends(require_role(["admin"]))):
    return create_dataset(req.label, user.user_id)


@router.get("/datasets", response_model=List[DatasetMetadataResponse])
def list_datasets(limit: int = Query(50, ge=1, le=200)):
    rows = Database.fetch_all("SELECT dataset_id FROM dataset_contents_v3 ORDER BY created_at DESC,dataset_id LIMIT ?", (limit,))
    return [dataset_metadata(row["dataset_id"]) for row in rows]


@router.get("/datasets/{dataset_version}", response_model=DatasetMetadataResponse)
def get_dataset_metadata(dataset_version: str):
    return dataset_metadata(dataset_version)


@router.get("/editor/datasets/{dataset_version}/content")
def export_dataset_content(dataset_version: str, user: AuthenticatedUser = Depends(require_role(["editor"]))):
    return load_content(dataset_version)


@router.get("/legacy-mappings", response_model=LegacyMappingBundleResponse)
def legacy_mappings(dataset_version: str = Query("dev", max_length=160)):
    with dataset_resolver(dataset_version) as (selected_resolver, metadata):
        reader = selected_resolver.reader
        mappings = []
        for row in reader.fetch_all("SELECT m.*,e.entity_type FROM legacy_entity_mappings_v3 m JOIN entity_registry e ON e.id=m.entity_id WHERE e.status='published' AND m.legacy_table IN ('items','garment_types','occasions') ORDER BY m.legacy_table,m.legacy_id"):
            # Mapping IDs come from stored records; missing renderables stay null.
            renderables = reader.fetch_all("SELECT * FROM renderable_items_v3 WHERE canonical_entity_id=? AND is_active=1 ORDER BY id", (row["entity_id"],)) if row["legacy_table"] == "items" else []
            match = next((r for r in renderables if decode_record(r).get("metadata", {}).get("legacy_item_id") == row["legacy_id"]), None)
            variants = {}
            if match:
                for variant in reader.fetch_all("SELECT * FROM renderable_variants_v3 WHERE renderable_item_id=? ORDER BY id", (match["id"],)):
                    legacy_id = decode_record(variant).get("style", {}).get("legacy_variant_id")
                    if isinstance(legacy_id, str):
                        variants[legacy_id] = variant["id"]
            mappings.append({"legacy_table": row["legacy_table"], "legacy_id": row["legacy_id"], "canonical_entity_id": row["entity_id"], "canonical_entity_type": row["entity_type"], "renderable_item_id": match["id"] if match else None, "render_variants": variants})
        return {"dataset_version": metadata["dataset_version"], "ruleset_version": metadata["ruleset_version"], "reproducible": metadata["reproducible"], "mappings": mappings}


def published_entity(entity_id: str):
    entity = repo.get_entity(entity_id)
    if not entity or entity["status"] != "published":
        raise HTTPException(404, "Entity not found")
    return entity


def entity_response(row, *, public=True):
    data = decode_record(row)
    if public:
        data["extensions"] = {}
    return EntityResponse(**data)


@router.get("/entities", response_model=List[EntityResponse])
def list_entities(
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    dataset_version: str = Query("dev", max_length=160),
):
    """Liệt kê các canonical entities trong Cultural Knowledge Graph."""
    if status not in (None, "published"):
        return []
    with dataset_resolver(dataset_version) as (selected_resolver, _):
        rows = selected_resolver.reader.fetch_all(
            "SELECT * FROM entity_registry WHERE status='published' "
            "AND (CAST(? AS TEXT) IS NULL OR entity_type=?) ORDER BY id LIMIT ? OFFSET ?",
            (entity_type, entity_type, limit, offset),
        )
        return [entity_response(row) for row in rows]


@router.post("/entities", response_model=EntityResponse, status_code=201)
def create_entity(req: EntityCreateRequest, user: AuthenticatedUser = Depends(require_role(["editor"]))):
    """Tạo một canonical entity mới trong Cultural Knowledge Graph."""
    if not user.is_admin and req.status not in ("draft", "under_review"):
        raise AppError("PUBLISH_FORBIDDEN", "Chỉ quản trị viên được xác minh hoặc xuất bản tri thức.", 403)
    entity = Entity(
        id=req.id,
        entity_type=req.entity_type,
        identity=req.identity,
        status=req.status,
        extensions=req.extensions,
    )
    try:
        repo.add_entity(entity)
    except INTEGRITY_ERRORS as e:
        if not is_unique_violation(e):
            raise
        raise AppError("ENTITY_EXISTS", "Định danh entity đã tồn tại.", 409) from None
    return EntityResponse(
        id=entity.id,
        entity_type=entity.entity_type,
        identity=entity.identity,
        status=entity.status,
        version=entity.version,
        extensions=entity.extensions,
    )


@router.get("/editor/entities", response_model=List[EntityResponse])
def editor_entities(status: Optional[str] = None, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), user: AuthenticatedUser = Depends(require_role(["editor"]))):
    return [entity_response(row, public=False) for row in repo.list_entities(status=status, limit=limit, offset=offset)]


@router.get("/editor/entities/{entity_id}/education", response_model=EducationProjectionResponse)
def editor_education(entity_id: str, user: AuthenticatedUser = Depends(require_role(["editor"]))):
    if not repo.get_entity(entity_id):
        raise HTTPException(404, "Entity not found")
    return education_builder.build(entity_id, public_only=False)


@router.patch("/editor/entities/{entity_id}/status", response_model=EntityResponse)
def change_entity_status(entity_id: str, req: EntityStatusRequest, user: AuthenticatedUser = Depends(require_role(["editor"]))):
    with db_transaction() as conn:
        row = Database.fetch_one("SELECT * FROM entity_registry WHERE id=?", (entity_id,), conn)
        if not row:
            raise HTTPException(404, "Entity not found")
        if not user.is_admin and (req.status not in ("draft", "under_review") or row["status"] not in ("draft", "under_review")):
            raise AppError("PUBLISH_FORBIDDEN", "Chỉ quản trị viên được thay đổi trạng thái tri thức đã xác minh/xuất bản.", 403)
        if row["version"] != req.version:
            raise AppError("REVISION_CONFLICT", "Entity đã được cập nhật. Hãy tải lại phiên bản mới.", 409)
        Database.execute("UPDATE entity_registry SET status=?, version=version+1, updated_at=CURRENT_TIMESTAMP WHERE id=?", (req.status, entity_id), conn)
        return entity_response(Database.fetch_one("SELECT * FROM entity_registry WHERE id=?", (entity_id,), conn), public=False)


@router.get("/entities/{entity_id}/education", response_model=EducationProjectionResponse)
def education_detail(entity_id: str, context: Optional[dict] = Depends(projection_context), dataset_version: str = Query("dev", max_length=160)):
    """Lấy Education Projection cho một canonical entity."""
    with dataset_resolver(dataset_version) as (selected_resolver, _):
        return EducationProjectionBuilder(selected_resolver).build(entity_id, context=context)


@router.get("/composer/bundles/{entity_id}", response_model=ComposerBundleResponse)
def composer_bundle(entity_id: str, context: Optional[dict] = Depends(projection_context), dataset_version: str = Query("dev", max_length=160)):
    """Lấy Composer Bundle projection cho Studio."""
    with dataset_resolver(dataset_version) as (selected_resolver, metadata):
        return {**ComposerBundleBuilder(selected_resolver).build(entity_id, dataset_version=dataset_version, context=context), "ruleset_version": metadata["ruleset_version"], "reproducible": metadata["reproducible"]}


@router.get("/generation/profiles/{entity_id}", response_model=GenerationProfileResponse)
def generation_profile(entity_id: str, context: Optional[dict] = Depends(projection_context), dataset_version: str = Query("dev", max_length=160)):
    """Lấy Generation Profile cho AI grounding."""
    with dataset_resolver(dataset_version) as (selected_resolver, _):
        return GenerationProfileBuilder(selected_resolver).build(entity_id, context=context)


@router.post("/generation/grounding", response_model=GroundingResponse)
def generation_grounding(outfit: OutfitSpecV2):
    return {"grounding": build_grounding(outfit)}


@router.post("/generation/prompt", response_model=PromptSynthesisResponse)
def generation_prompt(outfit: OutfitSpecV2):
    from app.modules.cultural_data_v3.services.generation import PromptBuilder

    return PromptBuilder.build(build_grounding(outfit))


@router.get("/generation/status", response_model=GenerationAvailabilityResponse)
def generation_status():
    return {"enabled": bool(settings.GEMINI_TRY_ON_ENABLED and settings.GEMINI_API_KEY)}


@router.post("/generation/synthesize", response_model=SynthesizeResponse)
async def generation_synthesize(req: SynthesizeRequest, user: AuthenticatedUser = Depends(require_current_user)):
    from app.modules.cultural_data_v3.services.generation_jobs import submit, wait_for_job
    job = await submit(req, user, _generate_image, require_provider=True)
    return await wait_for_job(job.job_id, user.user_id)


@router.post("/generation/jobs", response_model=GenerationJobResponse, status_code=202)
async def create_generation_job(req: SynthesizeRequest, user: AuthenticatedUser = Depends(require_current_user)):
    from app.modules.cultural_data_v3.services.generation_jobs import submit
    return await submit(req, user, _generate_image, require_provider=True)


@router.get("/generation/jobs/{job_id}", response_model=GenerationJobResponse)
async def get_generation_job(
    job_id: str,
    wait_seconds: int = Query(0, ge=0, le=10, description="Wait up to this many seconds for a running job to finish."),
    user: AuthenticatedUser = Depends(require_current_user),
):
    from app.modules.cultural_data_v3.services.generation_jobs import poll_job
    return await poll_job(job_id, user.user_id, wait_seconds)


async def _generate_image(req: SynthesizeRequest, user: AuthenticatedUser):
    from app.modules.cultural_data_v3.providers.gemini import GeminiGenerationProvider
    from app.modules.cultural_data_v3.services.generation import (
        PostValidationService,
        PromptBuilder,
        ProviderRequest,
        canonical_hash,
        validate_provider_result,
    )
    from app.modules.media.repository import MediaRepository
    from app.modules.media.service import MediaService

    if not settings.GEMINI_TRY_ON_ENABLED or not settings.GEMINI_API_KEY:
        raise AppError(
            "GENERATION_UNAVAILABLE",
            "Dịch vụ sinh ảnh chưa được cấu hình. Bộ phối của bạn vẫn được giữ nguyên.",
            503,
        )
    if not req.outfit_image_id:
        raise AppError("OUTFIT_IMAGE_REQUIRED", "Cần ảnh bản phối để thử đồ.", 422)

    from app.modules.catalog.repository import CatalogRepository
    from app.modules.cultural_data_v3.services.generation import GroundingBuilder

    if not req.outfit.selections and not req.legacy_item_ids:
        raise AppError("OUTFIT_EMPTY", "Bộ phối chưa có trang phục.", 422)
    if len(req.legacy_item_ids) != len(set(req.legacy_item_ids)):
        raise AppError("DUPLICATE_OUTFIT_ITEMS", "Bộ phối có trang phục trùng.", 422)
    published_items = await run_in_threadpool(
        CatalogRepository.get_published_items_by_ids, req.legacy_item_ids,
    )
    if len(published_items) != len(req.legacy_item_ids):
        raise AppError("ITEM_NOT_FOUND", "Trang phục chưa được xuất bản hoặc không còn tồn tại.", 404)

    grounding = (
        await run_in_threadpool(build_grounding, req.outfit)
        if req.outfit.selections
        else GroundingBuilder().build(
            req.outfit.model_dump(), [],
            dataset={"dataset_version": req.outfit.dataset_version, "ruleset_version": req.outfit.ruleset_version, "reproducible": False},
        )
    )
    prompts = PromptBuilder.build(grounding)
    try_on_prompt = PromptBuilder.build_try_on(grounding, has_person_image=bool(req.user_image_id))
    if published_items:
        garment_list = "; ".join(f"{item['slot']}: {item['name']}" for item in published_items)
        try_on_prompt += f" Selected published catalog garments: {garment_list}. Follow the outfit board for exact appearance and colors."
    idempotency_key = req.idempotency_key or canonical_hash(
        {
            "user_id": user.user_id,
            "grounding_hash": grounding["grounding_hash"],
            "user_image_id": req.user_image_id,
            "outfit_image_id": req.outfit_image_id,
            "legacy_item_ids": req.legacy_item_ids,
            "model_id": req.model_id or settings.GEMINI_MODEL_IMAGE,
            "options": req.options,
        }
    )
    result = await GeminiGenerationProvider(user.user_id, model_id=req.model_id).generate(
        ProviderRequest(
            prompt=try_on_prompt,
            negative_prompt=prompts["negative_prompt"],
            user_image_id=req.user_image_id,
            outfit_image_id=req.outfit_image_id,
            reference_media_ids=grounding["reference_media_ids"],
            options=req.options,
            idempotency_key=idempotency_key,
        )
    )
    await run_in_threadpool(validate_provider_result,
        result,
        media_lookup=MediaRepository.get_media_by_id,
        media_probe=MediaService.probe_image,
    )
    return SynthesizeResponse(
        status=result.status,
        model_id=result.model_id,
        result_media_id=result.result_media_id,
        prompt_used=result.prompt_used,
        post_validation=PostValidationService.validate_generation(grounding, result),
        metadata=result.metadata,
    )


@router.post("/outfits/validate", response_model=OutfitValidationResponse)
def validate_outfit(outfit: OutfitSpecV2):
    from app.modules.cultural_data_v3.services.composer import validate_spec
    with dataset_resolver(outfit.dataset_version, outfit.ruleset_version) as (selected_resolver, metadata):
        return validate_spec(outfit, selected_resolver, metadata)


@router.post("/cultural-check/dual-run")
def dual_run_cultural_check(req: CulturalCheckRequest, user: AuthenticatedUser = Depends(require_role(["editor"]))):
    """Dual-run audit endpoint running both V1 and V3 rule engines side-by-side."""
    from app.modules.cultural_data_v3.services.dual_run import DualRunEvaluator
    return DualRunEvaluator.evaluate(req)
