"""Generation pipeline: GroundingBuilder, ReferenceSelector, PromptBuilder, and PostValidation."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol

from app.core.errors import AppError


@dataclass
class ProviderRequest:
    """Request sent to an AI generation provider."""
    prompt: str
    negative_prompt: str = ""
    user_image_id: Optional[str] = None
    outfit_image_id: Optional[str] = None
    reference_media_ids: List[str] = field(default_factory=list)
    options: Dict[str, Any] = field(default_factory=dict)
    idempotency_key: str = ""


@dataclass
class ProviderResult:
    """Result returned from an AI generation provider."""
    status: str
    model_id: str
    result_media_id: Optional[str] = None
    prompt_used: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


class GenerationProvider(Protocol):
    """Protocol for AI generation providers (mock, Gemini, etc.)."""
    async def generate(self, request: ProviderRequest) -> ProviderResult: ...


def canonical_hash(data: Dict[str, Any]) -> str:
    """Produce a deterministic SHA-256 hash of a dict for idempotency."""
    payload = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def validate_provider_result(
    result: ProviderResult,
    *,
    media_lookup: Callable[[str], Optional[Dict[str, Any]]],
    media_probe: Callable[[Dict[str, Any]], bool] | None,
) -> Dict[str, Any]:
    """Require a real, ready, decodable image before reporting generation success.

    Providers return identifiers, while storage owns the authoritative media
    record. The caller must supply a probe that downloads and decodes the
    object; accepting a provider's HTTP status or an arbitrary media ID alone
    would create a false success state.
    """
    if result.status != "completed":
        raise AppError("GENERATION_FAILED", "Provider không hoàn tất việc sinh ảnh.", 502)
    media_id = result.result_media_id
    if not media_id:
        raise AppError("GENERATION_INVALID_RESULT", "Provider không trả về media ảnh.", 502)
    media = media_lookup(media_id)
    if not media or media.get("status") != "ready" or media.get("media_type") != "image":
        raise AppError("GENERATION_MEDIA_NOT_READY", "Media kết quả chưa sẵn sàng.", 502)
    mime_type = str(media.get("mime_type") or "")
    if not mime_type.startswith("image/"):
        raise AppError("GENERATION_INVALID_MEDIA", "Media kết quả không phải ảnh.", 502)
    if media_probe is None or not media_probe(media):
        raise AppError("GENERATION_MEDIA_INVALID", "Không giải mã được media kết quả.", 502)
    return media


class ReferenceSelector:
    """Filters reference media assets by rights and verification status."""

    @staticmethod
    def filter_references(media_records: List[Dict[str, Any]]) -> List[str]:
        """Returns only media IDs with rights clear for AI grounding."""
        approved: List[str] = []
        for m in media_records:
            rights = m.get("rights_json") or m.get("rights") or {}
            if isinstance(rights, str):
                try:
                    rights = json.loads(rights)
                except Exception:
                    rights = {}
            if not isinstance(rights, dict):
                continue
            if rights.get("ai_reference_allowed") is True and m.get("review_status") == "published":
                approved.append(m["id"])
        return approved


class PromptBuilder:
    """Synthesizes structured, culturally grounded prompts for AI image synthesis."""

    FEATURE_TRANSLATIONS = {
        "construction.closure.direction:right_over_left": "Preserve the referenced Hữu nhậm closure and button placement; do not mirror the reference",
        "construction.body_panels:5": "Authentic five-panel construction (áo ngũ thân: two front panels, two back panels, one inner flap)",
        "construction.collar.type:standing": "Preserve the standing collar (cổ đứng) shown in the reference",
        "construction.sleeve.type:tay_thung": "Preserve wide sleeves (tay thụng / áo tấc) shown in the reference",
        "construction.sleeve.type:tay_chen": "Narrow tailored sleeves (tay chẽn) comfortably fitted around wrists",
        "construction.buttons.count:5": "Preserve five buttons (ngũ khuy)",
        "wearing.undergarment.required:True": "Preserve the required inner garment shown in the reference",
    }

    NEGATIVE_CONSTRAINTS = ["distorted garment geometry"]

    @classmethod
    def build_try_on(cls, grounding: Dict[str, Any], *, has_person_image: bool) -> str:
        base = cls.build(grounding)["positive_prompt"]
        reference = (
            "Image 1 is the outfit board and is the authoritative visual reference for "
            "both the garments and the background. Preserve the garments, colors, "
            "patterns, layers and accessories. Keep Image 1's existing background: "
            "the same architecture, flowers, drapes, decorations, ground, perspective, "
            "lighting and colors. Do not replace, redesign or simplify the scene, even "
            "with another similar Vietnamese setting. If the reference has a plain "
            "background, keep it plain instead of inventing a location. Change only "
            "the displayed clothing into one person naturally wearing it in the "
            "central open space. Show the complete outfit and feet with realistic "
            "scale, contact shadows and occlusion. Keep Image 1's aspect ratio and "
            "camera framing. Remove the floating outfit, board captions, branding and "
            "footer; preserve the scene behind them."
        )
        if has_person_image:
            wearer = (
                "Image 2 is the person to dress. Preserve this person's identity, face, "
                "skin tone, body proportions and pose. Replace only clothing as needed "
                "for natural fit and occlusion. Do not invent a different wearer. "
                "Use Image 2 only for the wearer, never for the background."
            )
        else:
            wearer = (
                "No person photo is supplied. Choose one adult wearer whose gender "
                "presentation and appearance suit the referenced garments and cultural "
                "context. Use a natural pose and realistic proportions; do not infer a "
                "specific real person's identity."
            )
        return f"Edit Image 1 into a realistic full-body virtual try-on photograph. {base} {reference} {wearer}"

    @classmethod
    def build(cls, grounding: Dict[str, Any]) -> Dict[str, str]:
        """Builds positive prompt and negative prompt from Grounding package."""
        must_preserve = grounding.get("must_preserve", [])
        may_vary = grounding.get("may_vary", [])
        forbidden = grounding.get("forbidden", [])
        outfit = grounding.get("outfit", {})

        # 1. Positive Prompt Assembly
        prompt_parts: List[str] = [
            "Masterpiece photograph of authentic Vietnamese traditional attire (Cổ phục Việt Nam).",
        ]

        # Invariant Cultural Features
        invariants: List[str] = []
        for feat in must_preserve:
            k = feat.get("feature")
            v = feat.get("value")
            v_clean = v.strip('"') if isinstance(v, str) else v
            sig = f"{k}:{v_clean}"
            desc = cls.FEATURE_TRANSLATIONS.get(sig)
            scope = f"Selection {feat['selection_id']} ({feat.get('slot', '')}): " if feat.get("selection_id") else ""
            if desc:
                invariants.append(scope + desc)
            elif k and v is not None:
                invariants.append(f"{scope}{k} must strictly follow {v}")

        if invariants:
            prompt_parts.append("STRICT HISTORICAL FEATURES: " + "; ".join(invariants) + ".")

        # Artistic Variations
        if may_vary:
            prompt_parts.append("ARTISTIC STYLING: Premium silk brocade fabric, subtle traditional Vietnamese floral motifs, natural daylighting, dignified poise.")

        positive_prompt = " ".join(prompt_parts)

        # 2. Negative Prompt Assembly
        negative_list = list(cls.NEGATIVE_CONSTRAINTS)
        for fb in forbidden:
            if isinstance(fb, str) and fb not in negative_list:
                negative_list.append(fb)

        negative_prompt = ", ".join(negative_list)

        return {
            "positive_prompt": positive_prompt,
            "negative_prompt": negative_prompt,
            "grounding_hash": grounding.get("grounding_hash", ""),
        }


class GroundingBuilder:
    """Builds a grounding package from outfit spec and generation profiles."""

    def build(
        self, outfit: Dict[str, Any], profiles: List[Dict[str, Any]], *, dataset: dict | None = None
    ) -> Dict[str, Any]:
        must_preserve: List[Dict[str, Any]] = []
        may_vary: List[str] = []
        forbidden: List[Any] = []
        references: List[str] = []
        unresolved: List[Dict[str, Any]] = []
        evidence = {}

        for profile in profiles:
            must_preserve.extend(profile.get("must_preserve", []))
            may_vary.extend(profile.get("may_vary", []))
            forbidden.extend(profile.get("forbidden", []))
            references.extend(profile.get("reference_media_ids", []))
            unresolved.extend({**fact, "selection_id": profile.get("selection_id"), "subject_id": profile.get("subject_id")} for fact in profile.get("unresolved", []))
            for citation in profile.get("evidence", []):
                evidence[citation["assertion_id"]] = citation

        grounding: Dict[str, Any] = {
            "dataset": dataset or {"dataset_version": "dev", "ruleset_version": "dev", "reproducible": False},
            "outfit": outfit,
            "must_preserve": must_preserve,
            "may_vary": sorted(set(may_vary)),
            "forbidden": sorted(set(forbidden)),
            "reference_media_ids": list(dict.fromkeys(references)),
            "unresolved": unresolved,
            "evidence": [evidence[key] for key in sorted(evidence)],
        }
        grounding["grounding_hash"] = canonical_hash(grounding)
        return grounding


class PostValidationService:
    """Validates generated results against cultural invariants."""

    @staticmethod
    def validate_generation(
        grounding: Dict[str, Any], result: ProviderResult
    ) -> Dict[str, Any]:
        """Report missing cultural review instead of inferring it from job success."""

        return {
            "is_compliant": None,
            "review_status": "not_evaluated",
            "invariants_checked": 0,
            "grounding_hash": grounding.get("grounding_hash", ""),
            "model_id": result.model_id,
            "status": result.status,
        }
