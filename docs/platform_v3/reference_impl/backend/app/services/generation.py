from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol, Any
import hashlib
import json

@dataclass
class ProviderRequest:
    prompt: str
    user_image_id: str
    reference_media_ids: list[str]
    options: dict[str, Any]
    idempotency_key: str

@dataclass
class ProviderResult:
    status: str
    model_id: str
    result_media_id: str | None
    metadata: dict[str, Any]

class GenerationProvider(Protocol):
    async def generate(self, request: ProviderRequest) -> ProviderResult:
        ...

def canonical_hash(data: dict[str, Any]) -> str:
    payload = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

class GroundingBuilder:
    def build(self, outfit: dict[str, Any], profiles: list[dict[str, Any]]):
        must_preserve = []
        may_vary = []
        forbidden = []
        references = []

        for profile in profiles:
            must_preserve.extend(profile.get("must_preserve", []))
            may_vary.extend(profile.get("may_vary", []))
            forbidden.extend(profile.get("forbidden", []))
            references.extend(profile.get("reference_media_ids", []))

        grounding = {
            "outfit": outfit,
            "must_preserve": must_preserve,
            "may_vary": sorted(set(may_vary)),
            "forbidden": forbidden,
            "reference_media_ids": list(dict.fromkeys(references)),
        }
        grounding["grounding_hash"] = canonical_hash(grounding)
        return grounding
