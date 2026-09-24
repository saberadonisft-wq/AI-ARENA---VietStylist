"""Independent-label evaluation for the conservative Studio recolor pipeline.

The manifest's region masks must be prepared from the source image by a reviewer,
never exported from the recolor algorithm. This module reports evidence only; it
does not mark catalog items as approved.
"""
from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops

from app.core.errors import AppError
from app.modules.catalog.studio_images import _RECOLOR_VERSION, _recolor_preserving_detail

REQUIRED_COVERAGE = {"embroidery", "multi_fabric", "metallic_trim", "varied_lighting"}
MIN_FABRIC_CHANGED_FRACTION = 0.50
MAX_PROTECTED_CHANGED_FRACTION = 0.0
MAX_OUTSIDE_FABRIC_CHANGED_FRACTION = 0.0
MAX_ALPHA_CHANGED_FRACTION = 0.0


def _mask(path: Path, size: tuple[int, int]) -> Image.Image:
    with Image.open(path) as source:
        result = source.convert("L")
    if result.size != size:
        raise ValueError(f"Mask size {result.size} does not match source image size {size}: {path}")
    return result.point(lambda pixel: 255 if pixel >= 128 else 0)


def _count(mask: Image.Image) -> int:
    return sum(mask.histogram()[1:])


def _manifest_asset(root: Path, relative: Any) -> Path:
    path = (root / str(relative)).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError as error:
        raise ValueError("Manifest asset paths must remain inside the dataset directory") from error
    if not path.is_file():
        raise ValueError(f"Evaluation asset does not exist: {path.name}")
    return path


def _fraction(changed: Image.Image, region: Image.Image) -> float:
    denominator = _count(region)
    if denominator == 0:
        return 0.0
    return _count(ImageChops.multiply(changed, region)) / denominator


def _changed_pixels(before: Image.Image, after: Image.Image) -> Image.Image:
    differences = ImageChops.difference(before.convert("RGBA"), after.convert("RGBA")).split()
    rgb_difference = ImageChops.lighter(ImageChops.lighter(differences[0], differences[1]), differences[2])
    return rgb_difference.point(lambda pixel: 255 if pixel else 0)


def _evaluate_sample(sample: dict[str, Any], root: Path) -> dict[str, Any]:
    sample_id = sample.get("id")
    image_path = _manifest_asset(root, sample.get("image", ""))
    annotation = sample.get("annotation")
    masks = sample.get("masks")
    if not isinstance(sample_id, str) or not sample_id.strip():
        raise ValueError("Each recolor sample needs a non-empty id")
    if not isinstance(annotation, dict) or annotation.get("method") != "manual_independent" or not str(annotation.get("reviewer", "")).strip():
        raise ValueError(f"Sample {sample_id} must identify an independent manual reviewer")
    if not isinstance(masks, dict) or not all(name in masks for name in ("fabric_safe", "embroidery", "trim", "transparent")):
        raise ValueError(f"Sample {sample_id} needs fabric_safe, embroidery, trim, and transparent masks")
    if not isinstance(sample.get("expected_supported"), bool):
        raise ValueError(f"Sample {sample_id} must declare expected_supported")

    with Image.open(image_path) as source:
        original = source.convert("RGBA")
    region_masks = {name: _mask(_manifest_asset(root, relative), original.size) for name, relative in masks.items()}
    fabric = region_masks["fabric_safe"]
    if _count(fabric) == 0:
        raise ValueError(f"Sample {sample_id} has an empty safe-fabric mask")
    protected = ImageChops.lighter(region_masks["embroidery"], region_masks["trim"])
    if _count(ImageChops.multiply(fabric, protected)):
        raise ValueError(f"Sample {sample_id} fabric-safe and protected masks overlap")

    # The independently labeled transparent region must actually be transparent
    # in the source used by the algorithm; do not silently score a bad annotation.
    alpha = original.getchannel("A")
    nontransparent = alpha.point(lambda value: 255 if value > 8 else 0)
    if _count(ImageChops.multiply(region_masks["transparent"], nontransparent)):
        raise ValueError(f"Sample {sample_id} transparent mask includes visible source pixels")
    if _count(region_masks["transparent"]) == 0:
        raise ValueError(f"Sample {sample_id} needs independently labeled transparent pixels")

    try:
        recolored_bytes = _recolor_preserving_detail(image_path.read_bytes(), str(sample.get("target_hex", "")))
    except AppError as error:
        passed = not sample["expected_supported"] and error.code == "COLOR_CHANGE_UNSUPPORTED"
        return {
            "id": sample_id,
            "expected_supported": sample["expected_supported"],
            "observed": "unsupported",
            "error_code": error.code,
            "passed": passed,
            "reason": None if passed else f"Unexpected recolor rejection: {error.code}",
        }

    if not sample["expected_supported"]:
        return {
            "id": sample_id,
            "expected_supported": False,
            "observed": "recolored",
            "passed": False,
            "reason": "Ambiguous sample should have remained unchanged, but the algorithm produced a recolored image",
        }

    with Image.open(BytesIO(recolored_bytes)) as result_image:
        result = result_image.convert("RGBA")
    if result.size != original.size:
        raise ValueError(f"Sample {sample_id} changed dimensions during recoloring")
    changed = _changed_pixels(original, result)
    outside_fabric = ImageChops.invert(fabric)
    alpha_changed = ImageChops.difference(alpha, result.getchannel("A")).point(lambda value: 255 if value else 0)

    metrics = {
        "fabric_changed_fraction": _fraction(changed, fabric),
        "embroidery_changed_fraction": _fraction(changed, region_masks["embroidery"]),
        "trim_changed_fraction": _fraction(changed, region_masks["trim"]),
        "outside_fabric_changed_fraction": _fraction(changed, outside_fabric),
        "transparent_rgb_changed_fraction": _fraction(changed, region_masks["transparent"]),
        "alpha_changed_fraction": _fraction(alpha_changed, Image.new("L", original.size, 255)),
    }
    checks = {
        "fabric_changed_enough": metrics["fabric_changed_fraction"] >= MIN_FABRIC_CHANGED_FRACTION,
        "embroidery_preserved": metrics["embroidery_changed_fraction"] <= MAX_PROTECTED_CHANGED_FRACTION,
        "trim_preserved": metrics["trim_changed_fraction"] <= MAX_PROTECTED_CHANGED_FRACTION,
        "outside_safe_region_preserved": metrics["outside_fabric_changed_fraction"] <= MAX_OUTSIDE_FABRIC_CHANGED_FRACTION,
        "transparent_pixels_preserved": metrics["transparent_rgb_changed_fraction"] == 0.0,
        "alpha_preserved": metrics["alpha_changed_fraction"] <= MAX_ALPHA_CHANGED_FRACTION,
    }
    passed = all(checks.values())
    return {
        "id": sample_id,
        "expected_supported": True,
        "observed": "recolored",
        "metrics": metrics,
        "checks": checks,
        "passed": passed,
        "reason": None if passed else "One or more independently labeled preservation checks failed",
    }


def evaluate_manifest(manifest_path: str | Path) -> dict[str, Any]:
    path = Path(manifest_path).resolve()
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1 or not isinstance(manifest.get("samples"), list):
        raise ValueError("Unsupported recolor evaluation manifest")
    if manifest.get("algorithm_version") != _RECOLOR_VERSION:
        raise ValueError(f"Manifest algorithm version must equal {_RECOLOR_VERSION}")
    samples = manifest["samples"]
    if not samples:
        raise ValueError("Recolor evaluation manifest has no samples")
    if not all(isinstance(sample, dict) for sample in samples):
        raise ValueError("Each recolor sample must be an object")
    ids = [sample.get("id") for sample in samples]
    if any(not isinstance(sample_id, str) or not sample_id.strip() for sample_id in ids):
        raise ValueError("Each recolor sample needs a non-empty string id")
    if len(set(ids)) != len(ids):
        raise ValueError("Recolor sample ids must be unique")
    results = [_evaluate_sample(sample, path.parent) for sample in samples]
    coverage_values = [sample.get("coverage_tags", []) for sample in samples]
    if not all(isinstance(tags, list) and all(isinstance(tag, str) for tag in tags) for tags in coverage_values):
        raise ValueError("coverage_tags must be a list of strings")
    sample_coverage = {tag for tags in coverage_values for tag in tags}
    missing_coverage = sorted(REQUIRED_COVERAGE - sample_coverage)
    kind_is_real = manifest.get("asset_kind") == "real_catalog_photo"
    samples_passed = all(result["passed"] for result in results)
    qualifies = kind_is_real and samples_passed and not missing_coverage
    return {
        "algorithm_version": _RECOLOR_VERSION,
        "asset_kind": manifest.get("asset_kind", "unspecified"),
        "sample_count": len(results),
        "passed_samples": sum(1 for result in results if result["passed"]),
        "failed_samples": [result["id"] for result in results if not result["passed"]],
        "covered_requirements": sorted(REQUIRED_COVERAGE & sample_coverage),
        "missing_coverage": missing_coverage,
        "qualifies_for_review": qualifies,
        "results": results,
    }
