"""Quality and concurrency regressions; no provider calls or live storage."""
import base64
import io
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from PIL import Image

from app.core.config import settings
from app.core.database import Database
from app.core.errors import AppError
from app.infrastructure.r2.client import r2_client
from app.modules.catalog import studio_images
from app.modules.catalog.repository import CatalogRepository
from app.modules.cultural_data_v3.providers import gemini
from app.modules.cultural_data_v3.services.generation import ProviderRequest
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService
from app.modules.media.validation import validate_content


def test_warm_cutout_does_not_wait_for_unrelated_cold_image(monkeypatch, png_bytes):
    directory = Path(settings.LOCAL_MEDIA_DIR) / "studio-cutouts"
    directory.mkdir(parents=True)
    (directory / "warm.png").write_bytes(png_bytes)
    monkeypatch.setattr(studio_images, "_published_studio_source", lambda _: ({}, {}, "warm"))
    lock = threading.Lock()
    monkeypatch.setattr(studio_images, "_processing", lock)
    with ThreadPoolExecutor(max_workers=1) as pool:
        lock.acquire()
        try:
            result = pool.submit(studio_images.get_studio_image, "warm-item")
            assert result.result(timeout=1) == png_bytes
        finally:
            lock.release()


def test_cache_eviction_between_checks_is_a_miss(monkeypatch, png_bytes):
    monkeypatch.setattr(studio_images, "_published_studio_source", lambda _: ({}, {"bucket": "b", "object_key": "k"}, "evicted"))
    monkeypatch.setattr(r2_client, "read_object", lambda *args: png_bytes)
    monkeypatch.setattr(studio_images, "make_cutout", lambda data: data)
    original = Path.read_bytes
    misses = []

    def evict(path):
        if path.name == "evicted.png" and not misses:
            misses.append(True)
            raise FileNotFoundError
        return original(path)

    monkeypatch.setattr(Path, "read_bytes", evict)
    assert studio_images.get_studio_image("evicted-item") == png_bytes


def test_windows_cache_reader_does_not_fail_unrelated_writer(monkeypatch, tmp_path, png_bytes):
    for index in range(128):
        (tmp_path / f"{index}.png").write_bytes(png_bytes)
    original = Path.unlink
    blocked = []

    def unlink(path, **kwargs):
        if path.suffix == ".png":
            blocked.append(path)
            raise PermissionError("Reader has this file open")
        return original(path, **kwargs)

    monkeypatch.setattr(Path, "unlink", unlink)
    target = tmp_path / "new.png"
    studio_images._store_cached_image(tmp_path, target, png_bytes)
    assert blocked
    assert target.read_bytes() == png_bytes


def test_batch_items_preserve_order_and_exclude_unpublished(monkeypatch):
    rows = Database.fetch_all("SELECT id FROM items WHERE is_published=1 ORDER BY id LIMIT 3")
    identifiers = [row["id"] for row in reversed(rows)]
    Database.execute("UPDATE items SET is_published=0 WHERE id=?", (identifiers[1],))
    original = Database.fetch_all
    calls = []

    def fetch(query, params=(), conn=None):
        calls.append((query, params))
        return original(query, params, conn)

    monkeypatch.setattr(Database, "fetch_all", fetch)
    result = CatalogRepository.get_published_items_by_ids(identifiers + ["missing"])
    assert [row["id"] for row in result] == [identifiers[0], identifiers[2]]
    assert len(calls) == 1


@pytest.mark.parametrize("failed_input", [None, "board", "person"])
async def test_image_reads_overlap_but_provider_payload_order_is_unchanged(monkeypatch, png_bytes, failed_input):
    monkeypatch.setattr(settings, "GEMINI_TRY_ON_ENABLED", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-only")
    barrier = threading.Barrier(2)
    inputs = {"board": png_bytes, "person": png_bytes + b"distinct-normalized-input"}
    captured = []

    def read(media_id, owner_id):
        assert owner_id == "dev-user-test-1"
        barrier.wait(timeout=2)  # Sequential execution cannot cross this gate.
        if media_id == failed_input:
            raise AppError("MEDIA_NOT_FOUND", "Missing input", 404)
        return inputs[media_id], "image/png"

    async def post(url, **kwargs):
        captured.append(kwargs["json"])
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"inlineData": {
            "mimeType": "image/png", "data": base64.b64encode(png_bytes).decode(),
        }}]}}]})

    monkeypatch.setattr(MediaService, "read_owned_image", read)
    monkeypatch.setattr(gemini, "get_shared_async_client", lambda **_: SimpleNamespace(post=post))
    request = ProviderRequest(prompt="Keep every detail", negative_prompt="extra garment", outfit_image_id="board", user_image_id="person")
    provider = gemini.GeminiGenerationProvider("dev-user-test-1", model_id="same-image-model")
    if failed_input:
        with pytest.raises(AppError, match="Missing input"):
            await provider.generate(request)
        assert not captured
    else:
        result = await provider.generate(request)
        assert result.model_id == "same-image-model"
        assert captured == [{
            "contents": [{"parts": [
                {"text": "Keep every detail\n\nDo not introduce any of these traits: extra garment."},
                *[{"inlineData": {"mimeType": "image/png", "data": base64.b64encode(inputs[key]).decode()}} for key in ("board", "person")],
            ]}],
            "generationConfig": {"responseModalities": ["Image"]},
        }]
    assert gemini._provider_slots.borrowed_tokens == 0


@pytest.mark.parametrize("image_format,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_direct_generated_storage_matches_old_bytes_and_uses_one_put(monkeypatch, image_format, mime):
    image = Image.new("RGB", (64, 48))
    image.putdata([((x * 13 + y * 3) % 256, (x * y) % 256, (y * 17) % 256) for y in range(48) for x in range(64)])
    output = io.BytesIO()
    image.save(output, format=image_format)
    source = output.getvalue()
    expected = validate_content(validate_content(source, mime)[0], mime)[0]
    puts = []
    original_put = r2_client.put_object

    def put(bucket, key, data, content_type):
        puts.append((bucket, key, data))
        assert MediaRepository.objects(key.split("/")[1])  # Ledger exists before I/O.
        return original_put(bucket, key, data, content_type)

    def no_staging(*_):
        pytest.fail("Generated images must not use staging I/O")

    monkeypatch.setattr(r2_client, "put_object", put)
    monkeypatch.setattr(r2_client, "verify_object_exists", no_staging)
    monkeypatch.setattr(MediaService, "create_upload_session", no_staging)
    media = MediaService.ingest_generated_image("dev-user-test-1", source, mime)
    assert len(puts) == 1
    assert puts[0][2] == expected
    row = MediaRepository.get_media_by_id(media.id)
    assert row["status"] == "ready" and row["visibility"] == "private"
    assert (row["width"], row["height"]) == image.size
    assert row["staging_key"] is None and row["operation_token"] is None
    assert r2_client.read_object(media.bucket, media.object_key, len(expected)) == expected
    assert MediaService.probe_image(row)
    with pytest.raises(AppError):
        MediaService.get_access_url(media.id, "another-owner")


def test_failed_generated_put_remains_tracked_and_cleanup_recovers(monkeypatch, png_bytes):
    def failed_put(*args):
        raise OSError("Write may have reached storage")

    monkeypatch.setattr(r2_client, "put_object", failed_put)
    monkeypatch.setattr(r2_client, "delete_object", lambda *_: False)
    with pytest.raises(AppError) as failure:
        MediaService.ingest_generated_image("dev-user-test-1", png_bytes, "image/png")
    assert failure.value.code == "STORAGE_UNAVAILABLE"
    row = Database.fetch_one("SELECT * FROM media_assets")
    assert row["status"] == "deleting"
    assert len(MediaRepository.objects(row["id"])) == 1
    deleted = []
    monkeypatch.setattr(r2_client, "delete_object", lambda bucket, key: deleted.append(key) or True)
    assert MediaService.cleanup()["processed"] == 1
    assert row["object_key"] in deleted
    assert MediaRepository.get_media_by_id(row["id"])["status"] == "deleted"


def test_generated_image_cannot_publish_after_lease_revocation(monkeypatch, png_bytes):
    original = r2_client.put_object

    def expired_put(bucket, key, data, mime):
        original(bucket, key, data, mime)
        Database.execute("UPDATE media_assets SET lease_until=0")

    monkeypatch.setattr(r2_client, "put_object", expired_put)
    with pytest.raises(AppError) as failure:
        MediaService.ingest_generated_image("dev-user-test-1", png_bytes, "image/png")
    assert failure.value.code == "INVALID_UPLOAD_STATE"
    assert Database.fetch_one("SELECT status FROM media_assets")["status"] == "deleted"


def test_crashed_generated_reservation_is_cleaned_without_staging():
    MediaRepository.reserve_generated_image("crashed", settings.R2_BUCKET_PRIVATE, "assets/crashed/1.png", "image/png", "dev-user-test-1", 4, "lease")
    Database.execute("UPDATE media_assets SET lease_until=0 WHERE id='crashed'")
    assert MediaService.cleanup()["processed"] == 1
    assert MediaRepository.get_media_by_id("crashed")["status"] == "deleted"
