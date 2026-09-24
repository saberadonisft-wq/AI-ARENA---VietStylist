import json
from io import BytesIO

from PIL import Image, ImageDraw

from app.modules.catalog import recolor_evaluation


def _save_mask(path, size, draw_fn):
    mask = Image.new("L", size, 0)
    draw_fn(ImageDraw.Draw(mask))
    mask.save(path)


def _manifest(tmp_path, *, supported=True, asset_kind="synthetic_test"):
    size = (48, 48)
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((4, 4, 43, 43), fill=(24, 103, 82, 255))
    draw.line((12, 14, 35, 14), fill=(225, 180, 65, 255), width=3)
    draw.line((6, 10, 6, 38), fill=(235, 235, 225, 255), width=2)
    image_path = tmp_path / "source.png"
    image.save(image_path)
    masks = {}
    for name, draw_fn in {
        "fabric_safe": lambda pen: (pen.rectangle((4, 4, 43, 43), fill=255), pen.line((12, 14, 35, 14), fill=0, width=5), pen.line((6, 10, 6, 38), fill=0, width=4)),
        "embroidery": lambda pen: pen.line((12, 14, 35, 14), fill=255, width=3),
        "trim": lambda pen: pen.line((6, 10, 6, 38), fill=255, width=2),
        "transparent": lambda pen: (pen.rectangle((0, 0, 47, 3), fill=255), pen.rectangle((0, 4, 3, 43), fill=255), pen.rectangle((44, 4, 47, 43), fill=255), pen.rectangle((0, 44, 47, 47), fill=255)),
    }.items():
        path = tmp_path / f"{name}.png"
        _save_mask(path, size, draw_fn)
        masks[name] = path.name
    manifest = {
        "schema_version": 1,
        "algorithm_version": recolor_evaluation._RECOLOR_VERSION,
        "asset_kind": asset_kind,
        "samples": [{
            "id": "sample-1",
            "image": image_path.name,
            "target_hex": "#B32645",
            "expected_supported": supported,
            "coverage_tags": ["embroidery", "multi_fabric", "metallic_trim", "varied_lighting"],
            "annotation": {"method": "manual_independent", "reviewer": "test annotator"},
            "masks": masks,
        }],
    }
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    return path


def test_evaluation_uses_independent_masks_but_synthetic_assets_never_qualify(tmp_path):
    report = recolor_evaluation.evaluate_manifest(_manifest(tmp_path))
    assert report["passed_samples"] == 1, report["results"]
    assert report["failed_samples"] == []
    assert report["qualifies_for_review"] is False
    result = report["results"][0]
    assert result["checks"]["embroidery_preserved"] is True
    assert result["checks"]["trim_preserved"] is True
    assert result["checks"]["outside_safe_region_preserved"] is True
    assert result["checks"]["alpha_preserved"] is True


def test_evaluation_rejects_motif_changes_even_when_fabric_changes(monkeypatch, tmp_path):
    manifest = _manifest(tmp_path)

    def recolor_every_visible_pixel(data, _color):
        with Image.open(BytesIO(data)) as source:
            image = source.convert("RGBA")
        color = Image.new("RGBA", image.size, (179, 38, 69, 255))
        color.putalpha(image.getchannel("A"))
        output = BytesIO()
        color.save(output, format="PNG")
        return output.getvalue()

    monkeypatch.setattr(recolor_evaluation, "_recolor_preserving_detail", recolor_every_visible_pixel)
    report = recolor_evaluation.evaluate_manifest(manifest)
    assert report["failed_samples"] == ["sample-1"]
    assert report["results"][0]["checks"]["fabric_changed_enough"] is True
    assert report["results"][0]["checks"]["embroidery_preserved"] is False
    assert report["results"][0]["checks"]["trim_preserved"] is False


def test_ambiguous_real_color_sample_must_fail_closed(tmp_path):
    manifest_path = _manifest(tmp_path, supported=False)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    with Image.open(tmp_path / "source.png") as source:
        image = source.convert("RGBA")
    neutral = Image.new("RGBA", image.size, (235, 232, 223, 255))
    neutral.putalpha(image.getchannel("A"))
    neutral.save(tmp_path / "source.png")
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    report = recolor_evaluation.evaluate_manifest(manifest_path)
    assert report["passed_samples"] == 1
    assert report["results"][0]["observed"] == "unsupported"
    assert report["results"][0]["error_code"] == "COLOR_CHANGE_UNSUPPORTED"
    assert report["qualifies_for_review"] is False
