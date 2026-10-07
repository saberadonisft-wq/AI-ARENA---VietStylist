import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.modules.catalog.repository import CatalogRepository
from app.modules.media.repository import MediaRepository
from app.infrastructure.r2.client import r2_client
from app.core.config import settings
from app.modules.catalog.studio_images import _recolor_preserving_detail
from app.core.errors import AppError


def test_studio_cutout_checks_publication_even_after_cache(monkeypatch):
    source = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    for x in range(4, 16):
        for y in range(3, 17):
            source.putpixel((x, y), (253, 250, 245, 255))
    stream = io.BytesIO()
    source.save(stream, format="PNG")

    published = {"id": "test-garment", "metadata": {"catalog_media_id": "public-media"}}
    media = {"id": "public-media", "visibility": "public", "status": "ready",
             "media_type": "image", "bucket": settings.R2_BUCKET_PUBLIC,
             "object_key": "assets/public-media/image.png", "updated_at": "now"}
    read_count = 0

    def read_object(*_args):
        nonlocal read_count
        read_count += 1
        return stream.getvalue()

    monkeypatch.setattr(CatalogRepository, "get_item_by_id", lambda _id, **kwargs: published)
    monkeypatch.setattr(MediaRepository, "get_media_by_id", lambda _id, **kwargs: media)
    monkeypatch.setattr(r2_client, "read_object", read_object)
    client = TestClient(app)
    url = "/api/catalog/items/test-garment/studio-image"

    first = client.get(url)
    assert first.status_code == 200
    assert first.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(first.content)) as result:
        assert result.getpixel((0, 0))[3] == 0
        assert result.getpixel((8, 8))[:3] == (253, 250, 245)
    assert client.get(url).status_code == 200
    assert read_count == 1

    monkeypatch.setattr(CatalogRepository, "get_item_by_id", lambda _id, **kwargs: None)
    assert client.get(url).status_code == 404
    assert read_count == 1

    monkeypatch.setattr(CatalogRepository, "get_item_by_id", lambda _id, **kwargs: published)
    media["visibility"] = "private"
    assert client.get(url).status_code == 404
    assert read_count == 1


def test_automatic_recolor_changes_fabric_and_preserves_independent_motif_pixels():
    from PIL import ImageDraw

    image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((12, 8, 84, 88), fill=(24, 103, 82, 255))
    # Independent motif colors stay outside the dominant fabric hue candidate.
    draw.line((28, 30, 48, 48, 68, 30), fill=(225, 180, 65, 255), width=5)
    draw.line((28, 64, 48, 46, 68, 64), fill=(225, 180, 65, 255), width=5)
    draw.line((15, 16, 15, 80), fill=(235, 235, 225, 255), width=2)
    output = io.BytesIO()
    image.save(output, format="PNG")

    result_bytes = _recolor_preserving_detail(output.getvalue(), "#B32645")
    with Image.open(io.BytesIO(result_bytes)) as result:
        assert result.size == image.size
        assert result.getpixel((48, 20)) != image.getpixel((48, 20))
        assert result.getpixel((48, 47)) == image.getpixel((48, 47))
        assert result.getpixel((15, 50)) == image.getpixel((15, 50))
        assert result.getpixel((0, 0))[3] == image.getpixel((0, 0))[3]
        for y in range(image.height):
            for x in range(image.width):
                if result.getpixel((x, y)) == image.getpixel((x, y)):
                    continue
                assert result.getpixel((x, y))[3] == image.getpixel((x, y))[3]
                assert 12 <= x <= 84 and 8 <= y <= 88


def test_automatic_recolor_fails_closed_for_neutral_source_without_safe_fabric_region():
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    for x in range(12, 52):
        for y in range(8, 56):
            image.putpixel((x, y), (235, 232, 223, 255))
    output = io.BytesIO()
    image.save(output, format="PNG")

    with pytest.raises(AppError) as error:
        _recolor_preserving_detail(output.getvalue(), "#E2E8F0")
    assert error.value.code == "COLOR_CHANGE_UNSUPPORTED"


def test_catalog_recolor_requires_independent_asset_review_before_enabling(monkeypatch):
    published = {"id": "unreviewed-garment", "metadata": {"catalog_media_id": "public-media"}}
    media = {"id": "public-media", "visibility": "public", "status": "ready",
             "media_type": "image", "bucket": settings.R2_BUCKET_PUBLIC,
             "object_key": "assets/public-media/image.png", "updated_at": "now"}
    monkeypatch.setattr(CatalogRepository, "get_item_by_id", lambda _id, **kwargs: published)
    monkeypatch.setattr(MediaRepository, "get_media_by_id", lambda _id, **kwargs: media)
    monkeypatch.setattr(r2_client, "read_object", lambda *_args: pytest.fail("Unreviewed recolor must not process or cache the source image"))

    client = TestClient(app)
    preview = client.get("/api/catalog/items/unreviewed-garment/color-preview?color=%23B32645")
    assert preview.status_code == 200
    assert preview.json()["supported"] is False
    assert "chưa được duyệt" in preview.json()["reason"]

    image = client.get("/api/catalog/items/unreviewed-garment/studio-image?color=%23B32645")
    assert image.status_code == 422
    assert image.json()["error"]["code"] == "COLOR_CHANGE_UNSUPPORTED"
