import io
import json
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import settings
from app.core.database import Database, get_db_connection
from app.infrastructure.r2.client import r2_client
from app.main import app
from app.modules.catalog import service, studio_images
from app.modules.catalog.repository import CatalogRepository
from app.modules.media.repository import MediaRepository


def public_photo(monkeypatch, tmp_path, size=(600, 900)):
    image = Image.new("RGBA", size, (44, 105, 83, 255))
    image.putpixel((0, 0), (18, 24, 30, 0))
    output = io.BytesIO()
    image.save(output, format="PNG")
    original = output.getvalue()
    item = {"id": "perf-photo", "metadata": {"catalog_media_id": "perf-media"}}
    media = {"id": "perf-media", "visibility": "public", "status": "ready", "media_type": "image",
             "bucket": settings.R2_BUCKET_PUBLIC, "object_key": "perf/source.png", "updated_at": "v1"}
    reads = []
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(tmp_path))
    monkeypatch.setattr(CatalogRepository, "get_item_by_id", lambda _, **kwargs: item)
    monkeypatch.setattr(MediaRepository, "get_media_by_id", lambda _, **kwargs: media)
    monkeypatch.setattr(r2_client, "read_object", lambda *args: reads.append(args) or original)
    return item, media, original, reads


def test_thumbnail_is_bounded_cached_and_does_not_modify_original(monkeypatch, tmp_path):
    _, media, original, reads = public_photo(monkeypatch, tmp_path)
    first = studio_images.get_catalog_thumbnail("perf-photo", 112)
    assert studio_images.get_catalog_thumbnail("perf-photo", 112) == first
    assert len(reads) == 1
    with Image.open(io.BytesIO(first)) as result:
        assert result.format == "WEBP"
        assert max(result.size) == 112
        assert result.getpixel((20, 20)) == (44, 105, 83, 255)
    with Image.open(io.BytesIO(original)) as source:
        assert source.size == (600, 900)
    assert len(first) < len(original)
    assert not (tmp_path / "studio-cutouts").exists()
    # New source versions cannot reuse a stale derivative.
    media["updated_at"] = "v2"
    studio_images.get_catalog_thumbnail("perf-photo", 112)
    assert len(reads) == 2


def test_thumbnail_lossless_pixels_and_conditional_get_check_access(monkeypatch, tmp_path):
    item, media, original, reads = public_photo(monkeypatch, tmp_path, size=(20, 30))
    client = TestClient(app)
    url = "/api/catalog/items/perf-photo/thumbnail?size=112"
    first = client.get(url)
    assert first.status_code == 200
    with Image.open(io.BytesIO(first.content)) as thumbnail, Image.open(io.BytesIO(original)) as source:
        assert thumbnail.convert("RGBA").tobytes() == source.convert("RGBA").tobytes()
    conditional = {"If-None-Match": first.headers["etag"]}
    unchanged = client.get(url, headers=conditional)
    assert unchanged.status_code == 304 and unchanged.content == b""
    assert len(reads) == 1
    media["visibility"] = "private"
    assert client.get(url, headers=conditional).status_code == 404
    media["visibility"] = "public"
    monkeypatch.setattr(CatalogRepository, "get_item_by_id", lambda _, **kwargs: None)
    assert client.get(url, headers=conditional).status_code == 404
    assert len(reads) == 1


def test_studio_conditional_get_preserves_png_and_publication_checks(monkeypatch, tmp_path):
    _, media, original, _ = public_photo(monkeypatch, tmp_path, size=(20, 30))
    monkeypatch.setattr(studio_images, "make_cutout", lambda data: data)
    client = TestClient(app)
    url = "/api/catalog/items/perf-photo/studio-image"
    first = client.get(url)
    assert first.content == original
    weak = {"If-None-Match": '"other", W/' + first.headers["etag"]}
    assert client.get(url, headers=weak).status_code == 304
    media["status"] = "deleted"
    assert client.get(url, headers=weak).status_code == 404


def test_catalog_service_reuses_one_connection_for_all_batched_reads(monkeypatch):
    checkouts, used = [], []
    original = Database.fetch_all

    @contextmanager
    def checkout():
        with get_db_connection() as conn:
            checkouts.append(conn)
            yield conn

    def fetch(query, params=(), conn=None):
        used.append(conn)
        return original(query, params, conn)

    monkeypatch.setattr(service, "get_db_connection", checkout)
    monkeypatch.setattr(Database, "fetch_all", fetch)
    items = service.CatalogService.list_items(limit=50)
    assert items and all(item["is_published"] for item in items)
    assert len(checkouts) == 1 and len(used) == 3
    assert all(conn is checkouts[0] for conn in used)
    assert all("variants" in item and "default_layer" in item for item in items)


@pytest.mark.parametrize("image_path", ["thumbnail?size=112", "studio-image"])
def test_catalog_image_reads_share_one_checkout_and_revalidate_cached_access(monkeypatch, image_path):
    from app.core import database

    image = Image.new("RGBA", (20, 30), (44, 105, 83, 255))
    image.putpixel((0, 0), (18, 24, 30, 0))
    output = io.BytesIO()
    image.save(output, format="PNG")
    original = output.getvalue()
    garment_type_id = Database.fetch_one("SELECT id FROM garment_types LIMIT 1")["id"]
    Database.execute(
        "INSERT INTO items(id,garment_type_id,name,slot,is_published,metadata) VALUES(?,?,?,?,1,?)",
        ("checkout-photo", garment_type_id, "Checkout photo", "outerwear",
         json.dumps({"catalog_media_id": "checkout-media"})),
    )
    Database.execute(
        "INSERT INTO media_assets(id,bucket,object_key,media_type,mime_type,visibility,status) VALUES(?,?,?,'image','image/png','public','ready')",
        ("checkout-media", settings.R2_BUCKET_PUBLIC, "assets/checkout-media/image.png"),
    )
    reads, checkouts, query_connections = [], [], []
    monkeypatch.setattr(r2_client, "read_object", lambda *args: reads.append(args) or original)
    # The processing algorithm is unchanged; this probe isolates delivery and DB
    # access without invoking inference or reading cloud storage.
    monkeypatch.setattr(studio_images, "make_cutout", lambda data: data)
    original_checkout = database.get_db_connection
    original_fetch = Database.fetch_one

    @contextmanager
    def checkout():
        with original_checkout() as conn:
            checkouts.append(conn)
            yield conn

    def fetch(query, params=(), conn=None):
        query_connections.append(conn)
        return original_fetch(query, params, conn=conn)

    monkeypatch.setattr(database, "get_db_connection", checkout)
    monkeypatch.setattr(studio_images, "get_db_connection", checkout)
    monkeypatch.setattr(Database, "fetch_one", fetch)
    client = TestClient(app)
    url = f"/api/catalog/items/checkout-photo/{image_path}"

    def request(headers=None, expected_queries=2):
        checkouts.clear()
        query_connections.clear()
        response = client.get(url, headers=headers)
        assert len(checkouts) == 1
        assert len(query_connections) == expected_queries
        assert all(conn is checkouts[0] for conn in query_connections)
        return response

    first = request()
    assert first.status_code == 200
    if image_path == "studio-image":
        assert first.content == original
    else:
        with Image.open(io.BytesIO(first.content)) as thumbnail:
            assert thumbnail.convert("RGBA").tobytes() == image.tobytes()
    assert request().content == first.content
    conditional = {"If-None-Match": first.headers["etag"]}
    unchanged = request(conditional)
    assert unchanged.status_code == 304 and unchanged.content == b""
    assert unchanged.headers["cache-control"] == "no-cache"
    assert len(reads) == 1

    for field, invalid_value, valid_value in (
        ("visibility", "private", "public"),
        ("status", "deleted", "ready"),
        ("media_type", "video", "image"),
        ("bucket", settings.R2_BUCKET_PRIVATE, settings.R2_BUCKET_PUBLIC),
    ):
        with original_checkout() as conn:
            Database.execute(f"UPDATE media_assets SET {field}=? WHERE id=?", (invalid_value, "checkout-media"), conn=conn)
            conn.commit()
        denied = request(conditional)
        assert denied.status_code == 404
        assert denied.json()["error"]["code"] == "STUDIO_IMAGE_NOT_FOUND"
        with original_checkout() as conn:
            Database.execute(f"UPDATE media_assets SET {field}=? WHERE id=?", (valid_value, "checkout-media"), conn=conn)
            conn.commit()

    with original_checkout() as conn:
        Database.execute("UPDATE items SET is_published=0 WHERE id=?", ("checkout-photo",), conn=conn)
        conn.commit()
    hidden = request(conditional, expected_queries=1)
    assert hidden.status_code == 404
    assert hidden.json()["error"]["code"] == "ITEM_NOT_FOUND"
    assert len(reads) == 1
