from fastapi import APIRouter, HTTPException
from app.domain.models import OutfitSpecV2
from app.repositories.memory import MemoryRepository
from app.services.resolver import EffectiveEntityResolver
from app.services.projections import (
    EducationProjectionBuilder,
    ComposerBundleBuilder,
    GenerationProfileBuilder,
)

router = APIRouter(prefix="/api/v3")
repo = MemoryRepository()
resolver = EffectiveEntityResolver(repo)

education = EducationProjectionBuilder(resolver)
composer = ComposerBundleBuilder(resolver)
generation_profiles = GenerationProfileBuilder(resolver)

@router.get("/entities/{entity_id}/education")
def education_detail(entity_id: str):
    if entity_id not in repo.entities:
        raise HTTPException(404, "Entity not found")
    return education.build(entity_id)

@router.get("/composer/bundles/{entity_id}")
def composer_bundle(entity_id: str):
    if entity_id not in repo.entities:
        raise HTTPException(404, "Entity not found")
    return composer.build(entity_id)

@router.get("/generation/profiles/{entity_id}")
def generation_profile(entity_id: str):
    if entity_id not in repo.entities:
        raise HTTPException(404, "Entity not found")
    return generation_profiles.build(entity_id)

@router.post("/outfits/validate")
def validate_outfit(outfit: OutfitSpecV2):
    missing = [
        x.canonical_entity_id
        for x in outfit.selections
        if x.canonical_entity_id not in repo.entities
    ]
    return {
        "status": "clear" if not missing else "warning",
        "missing_entities": missing,
        "outfit": outfit.model_dump(),
    }
