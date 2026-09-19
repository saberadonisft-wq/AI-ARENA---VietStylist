"""Independent acceptance probes for F01-F16; all data/providers are disposable."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import io
import os
from pathlib import Path
import sqlite3
import subprocess
import threading
import time
import json
import pytest
import httpx
from fastapi.testclient import TestClient
from conftest import auth_header
from app.main import app, create_app
from app.core.config import settings
from app.core.database import Database
from app.core.errors import AppError, ErrorEnvelope
from app.infrastructure.r2.client import r2_client, R2StorageClient
from app.modules.media.repository import MediaRepository
from app.modules.media.service import MediaService
from app.modules.media.schemas import CompleteUploadRequest
from app.modules.media.path_utils import safe_join_media_path
from app.modules.media.validation import validate_content

client = TestClient(app)
OWNER = "dev-user-media-1"
HEADERS = lambda: {"Authorization": auth_header(OWNER)}


def session(visibility="private", headers=None):
    res = client.post(
        "/api/media/uploads",
        headers=headers or HEADERS(),
        json={"filename": "p.png", "visibility": visibility},
    )
    assert res.status_code == 200, res.text
    return res.json()


def upload(png_bytes):
    s = session()
    assert (
        client.post(
            s["upload_url"], files={"file": ("p.png", png_bytes, "image/png")}
        ).status_code
        == 200
    )
    return s


def complete(s):
    return client.post(
        f"/api/media/{s['media_id']}/complete", json={"width": 9999}, headers=HEADERS()
    )


def test_junction_cannot_read_registered_or_unregistered_file(tmp_path):
    bucket = Path(settings.LOCAL_MEDIA_DIR) / settings.R2_BUCKET_PUBLIC
    bucket.mkdir(parents=True)
    outside = tmp_path / "outside_media"
    outside.mkdir()
    (outside / "sentinel.png").write_bytes(b"PRIVATE_SENTINEL")
    link = bucket / "escape"
    if os.name == "nt":
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link), str(outside)],
            capture_output=True,
            check=True,
        )
    else:
        link.symlink_to(outside, target_is_directory=True)
    try:
        with pytest.raises(AppError):
            safe_join_media_path(
                settings.LOCAL_MEDIA_DIR,
                settings.R2_BUCKET_PUBLIC,
                "escape/sentinel.png",
            )
        res = client.get(
            f"/api/media/files/{settings.R2_BUCKET_PUBLIC}/escape/sentinel.png"
        )
        assert res.status_code == 400
        assert b"PRIVATE_SENTINEL" not in res.content
        plain = bucket / "unregistered.png"
        plain.write_bytes(b"UNREGISTERED")
        assert (
            client.get(
                f"/api/media/files/{settings.R2_BUCKET_PUBLIC}/unregistered.png"
            ).status_code
            == 404
        )
    finally:
        if os.name == "nt":
            os.rmdir(link)
        else:
            link.unlink()


def test_upload_grant_replay_and_immutable_final(png_bytes):
    s = session()
    endpoint = s["upload_url"].split("?")[0]
    assert (
        client.post(endpoint, files={"file": ("p.png", png_bytes)}).status_code == 422
    )
    assert (
        client.post(
            endpoint + "?grant=forged", files={"file": ("p.png", png_bytes)}
        ).status_code
        == 403
    )
    assert (
        client.post(s["upload_url"], files={"file": ("p.png", png_bytes)}).status_code
        == 200
    )
    assert (
        client.post(s["upload_url"], files={"file": ("p.png", png_bytes)}).status_code
        == 409
    )
    finished = complete(s)
    assert finished.status_code == 200, finished.text
    final = finished.json()
    assert final["object_key"] != s["object_key"]
    assert MediaRepository.get_media_by_id(s["media_id"])["width"] == 8
    assert complete(s).json()["object_key"] == final["object_key"]
    # A reused staging PUT cannot change the promoted object.
    r2_client.put_object(s["bucket"], s["object_key"], b"changed", "image/png")
    assert (
        r2_client.read_object(final["bucket"], final["object_key"], 1000) == png_bytes
    )
    assert (
        client.get(f"/api/media/files/{s['bucket']}/{s['object_key']}").status_code
        == 404
    )


@pytest.mark.parametrize("value", ["PRIVATE", "invalid", "", None])
def test_invalid_visibility_rejected_on_both_inputs(value):
    assert (
        client.post(
            "/api/media/uploads",
            headers=HEADERS(),
            json={"filename": "p.png", "visibility": value},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/lookbooks", headers=HEADERS(), json={"visibility": value}
        ).status_code
        == 422
    )


def test_legacy_visibility_fails_closed(png_bytes):
    s = upload(png_bytes)
    assert complete(s).status_code == 200
    Database.execute("DROP TRIGGER media_assets_visibility_update")
    Database.execute(
        "UPDATE media_assets SET visibility='PRIVATE' WHERE id=?", (s["media_id"],)
    )
    assert client.get(f"/api/media/{s['media_id']}/access").status_code == 401
    assert (
        client.get(
            f"/api/media/{s['media_id']}/access",
            headers={"Authorization": auth_header("dev-user-test-1")},
        ).status_code
        == 404
    )


@pytest.mark.parametrize(
    "data",
    [b"NOT_AN_IMAGE", b"<html>not an image</html>", b"", b"\x89PNG\r\n\x1a\ntruncated"],
)
def test_invalid_content_never_published(data):
    s = upload(data)
    assert complete(s).status_code in (409, 422)
    assert MediaRepository.get_media_by_id(s["media_id"])["status"] != "ready"


def test_image_limits_and_public_policy(monkeypatch, png_bytes):
    assert (
        client.post(
            "/api/media/uploads",
            headers=HEADERS(),
            json={"filename": "p.png", "visibility": "public"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/media/uploads",
            headers=HEADERS(),
            json={"filename": "p.png", "mime_type": "text/html"},
        ).status_code
        == 422
    )
    monkeypatch.setattr(settings, "MEDIA_IMAGE_MAX_BYTES", 32)
    assert (
        client.post(
            "/api/media/uploads",
            headers=HEADERS(),
            json={"filename": "p.png", "size_bytes": 33},
        ).status_code
        == 413
    )
    s = session()
    assert (
        client.post(s["upload_url"], files={"file": ("p.png", png_bytes)}).status_code
        == 413
    )
    monkeypatch.setattr(settings, "MEDIA_IMAGE_MAX_BYTES", 1024)
    monkeypatch.setattr(settings, "MEDIA_MAX_PIXELS", 10)
    s = upload(png_bytes)
    assert complete(s).status_code == 422


def test_svg_allowlist_and_video_unavailable(monkeypatch):
    clean, *_ = validate_content(
        b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>',
        "image/svg+xml",
    )
    assert b"path" in clean
    for data in [
        b"<svg><script>alert(1)</script></svg>",
        b'<svg onload="x"/>',
        b'<svg><image href="https://evil.invalid"/></svg>',
        b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///x">]><svg>&x;</svg>',
    ]:
        with pytest.raises(AppError):
            validate_content(data, "image/svg+xml")
    monkeypatch.setattr(settings, "FFPROBE_PATH", "nonexistent-vietstylist-ffprobe")
    with pytest.raises(AppError) as caught:
        validate_content(b"\x00\x00\x00\x18ftypisom" + b"0" * 32, "video/mp4")
    assert caught.value.status_code == 503


def test_complete_delete_race_is_fenced(png_bytes, monkeypatch):
    s = upload(png_bytes)
    started, release = threading.Event(), threading.Event()
    original = r2_client.put_object

    def slow_put(bucket, key, data, mime):
        if key.startswith("assets/"):
            started.set()
            assert release.wait(5)
        return original(bucket, key, data, mime)

    monkeypatch.setattr(r2_client, "put_object", slow_put)
    with ThreadPoolExecutor(1) as pool:
        job = pool.submit(
            MediaService.complete_upload, s["media_id"], OWNER, CompleteUploadRequest()
        )
        assert started.wait(5)
        try:
            assert (
                client.delete(
                    f"/api/media/{s['media_id']}", headers=HEADERS()
                ).status_code
                == 409
            )
            assert complete(s).status_code == 409
            # Expire the lease, reconcile, then let the old worker finish its write.
            Database.execute(
                "UPDATE media_assets SET lease_until=0 WHERE id=?", (s["media_id"],)
            )
            assert MediaService.cleanup()["processed"] == 1
        finally:
            release.set()
        with pytest.raises(AppError):
            job.result()
    assert MediaRepository.get_media_by_id(s["media_id"])["status"] == "deleted"
    for row in MediaRepository.objects(s["media_id"]):
        assert r2_client.verify_object_exists(row["bucket"], row["object_key"]) is None


def test_cleanup_dry_run_failure_retry_and_staging_replay(png_bytes, monkeypatch):
    s = upload(png_bytes)
    Database.execute(
        "UPDATE media_assets SET upload_expires_at=0 WHERE id=?", (s["media_id"],)
    )
    assert MediaService.cleanup(dry_run=True)["candidates"] == 1
    assert MediaRepository.get_media_by_id(s["media_id"])["status"] == "uploaded"
    original = r2_client.delete_object
    monkeypatch.setattr(r2_client, "delete_object", lambda *a: False)
    assert MediaService.cleanup()["failed"] == 1
    assert MediaRepository.get_media_by_id(s["media_id"])["status"] == "deleting"
    monkeypatch.setattr(r2_client, "delete_object", original)
    Database.execute("UPDATE media_assets SET next_reconcile_at=0")
    assert MediaService.cleanup()["processed"] == 1
    r2_client.put_object(s["bucket"], s["object_key"], png_bytes, "image/png")
    Database.execute("UPDATE media_assets SET next_reconcile_at=0")
    assert MediaService.cleanup()["processed"] == 1
    assert r2_client.verify_object_exists(s["bucket"], s["object_key"]) is None


def test_unlisted_direct_id_and_legacy_foreign_entries():
    owner_headers = {"Authorization": auth_header("dev-user-test-1")}
    outfit = client.post(
        "/api/outfits", headers=owner_headers, json={"snapshot": {"items": []}}
    ).json()
    lb = client.post(
        "/api/lookbooks", headers=HEADERS(), json={"visibility": "unlisted"}
    ).json()
    link = client.post(
        f"/api/lookbooks/{lb['id']}/share", headers=HEADERS(), json={}
    ).json()
    Database.execute(
        "INSERT INTO lookbook_entries(id,lookbook_id,outfit_version_id,sort_order) VALUES('legacy-foreign',?,?,0)",
        (lb["id"], outfit["current_version_id"]),
    )
    assert client.get(f"/api/lookbooks/{lb['id']}").status_code == 401
    assert (
        client.get(f"/api/lookbooks/{lb['id']}", headers=owner_headers).status_code
        == 404
    )
    assert client.get(f"/api/shares/{link['share_token']}").json()["entries"] == []
    assert Database.fetch_one(
        "SELECT * FROM quarantined_lookbook_entries WHERE id='legacy-foreign'"
    )
    assert (
        client.delete(
            f"/api/lookbooks/{lb['id']}/shares", headers=HEADERS()
        ).status_code
        == 200
    )
    assert client.get(f"/api/shares/{link['share_token']}").status_code == 404
    assert client.get(f"/api/lookbooks/{lb['id']}").status_code == 401


@pytest.mark.parametrize(
    "raw",
    [
        {},
        [],
        None,
        {"recommendations": [42]},
        {"recommendations": [{"items": [None]}]},
        {
            "source": "gemini",
            "recommendations": [{"items": [{"item_id": "nonexistent"}]}],
        },
    ],
)
def test_malformed_provider_output_falls_back(raw, monkeypatch):
    from app.infrastructure.gemini.client import gemini_client

    async def provider(**kwargs):
        return raw

    monkeypatch.setattr(gemini_client, "get_styling_recommendations", provider)
    response = client.post("/api/recommendations/ai", json={"prompt": "Test"})
    assert response.status_code == 200, response.text
    assert response.json()["source"] == "cultural_rule_engine"
    assert response.json()["outfits"]


def test_invalid_locked_variant_rejected():
    response = client.post(
        "/api/recommendations/ai",
        json={
            "prompt": "Test",
            "locked_items": [
                {
                    "item_id": "item_ngu_than_nam_xanh",
                    "slot": "outerwear",
                    "variant_id": "wrong",
                }
            ],
        },
    )
    assert response.status_code == 422


def test_rate_limit_and_magic_token_rejection():
    from app.core.rate_limit import consume

    consume("test", "subject", 2, 60)
    consume("test", "subject", 2, 60)
    with pytest.raises(AppError) as caught:
        consume("test", "subject", 2, 60)
    assert caught.value.status_code == 429
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": "Bearer dev-user-admin"}
        ).status_code
        == 401
    )


def test_readiness_schema_and_production_storage(monkeypatch):
    assert client.get("/ready").status_code == 200
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", True)
    production = TestClient(create_app())
    assert production.get("/ready").status_code == 503
    assert production.post("/api/media/local-upload").status_code == 404
    assert (
        production.post(
            "/api/media/uploads", headers=HEADERS(), json={"filename": "p.png"}
        ).status_code
        == 503
    )
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    Database.execute(
        "DELETE FROM schema_migrations WHERE version='005_media_lifecycle'"
    )
    assert client.get("/ready").status_code == 503


def test_actual_errors_match_openapi_envelope():
    for response in [
        client.post("/api/outfits", json={}),
        client.post(
            "/api/media/uploads",
            headers=HEADERS(),
            json={"filename": "p.png", "visibility": "bad"},
        ),
    ]:
        ErrorEnvelope.model_validate(response.json())
        operation = (
            "/api/outfits" if response.status_code == 401 else "/api/media/uploads"
        )
        schema = app.openapi()["paths"][operation]["post"]["responses"][
            str(response.status_code)
        ]["content"]["application/json"]["schema"]
        assert schema["$ref"].endswith("/ErrorEnvelope")
    assert not any(
        "local-upload" in path or "/files/" in path for path in app.openapi()["paths"]
    )


@pytest.mark.asyncio
async def test_slow_storage_does_not_block_event_loop(monkeypatch):
    entered = threading.Event()
    original = r2_client.require_available

    def slow():
        entered.set()
        time.sleep(0.3)
        return original()

    monkeypatch.setattr(r2_client, "require_available", slow)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as ac:
        upload_task = asyncio.create_task(
            ac.post("/api/media/uploads", headers=HEADERS(), json={"filename": "p.png"})
        )
        while not entered.is_set():
            await asyncio.sleep(0.005)
        start = time.perf_counter()
        await asyncio.sleep(0.02)
        response = await ac.get("/health")
        elapsed = time.perf_counter() - start
        assert response.status_code == 200
        assert elapsed < 0.2
        assert (await upload_task).status_code == 200


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.fail_delete = False

    def generate_presigned_url(self, operation, Params, ExpiresIn):
        return (
            "https://storage.example.invalid/"
            + Params["Key"]
            + "?operation="
            + operation
        )

    def head_object(self, Bucket, Key):
        data = self.objects[(Bucket, Key)]
        return {"ContentLength": len(data), "ContentType": "image/png"}

    def get_object(self, Bucket, Key):
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[(Bucket, Key)] = Body

    def delete_object(self, Bucket, Key):
        if self.fail_delete:
            raise OSError("injected storage failure")
        self.objects.pop((Bucket, Key), None)


def test_fake_r2_promotion_oversize_and_delete_retry(monkeypatch, png_bytes):
    fake = FakeS3()
    monkeypatch.setattr(R2StorageClient, "is_configured", property(lambda self: True))
    monkeypatch.setattr(R2StorageClient, "s3", property(lambda self: fake))
    s = session()
    assert s["method"] == "PUT" and s["bucket"] == settings.R2_BUCKET_PRIVATE
    fake.objects[(s["bucket"], s["object_key"])] = png_bytes
    result = complete(s)
    assert result.status_code == 200, result.text
    final = result.json()
    fake.objects[(s["bucket"], s["object_key"])] = b"replayed PUT"
    assert fake.objects[(final["bucket"], final["object_key"])] == png_bytes
    fake.fail_delete = True
    assert (
        client.delete(f"/api/media/{s['media_id']}", headers=HEADERS()).status_code
        == 503
    )
    assert complete(s).status_code == 409
    fake.fail_delete = False
    assert MediaService.cleanup()["processed"] == 1
    assert not fake.objects
    s = session()
    fake.objects[(s["bucket"], s["object_key"])] = png_bytes
    monkeypatch.setattr(
        fake,
        "head_object",
        lambda **kwargs: {
            "ContentLength": 100 * 1024 * 1024,
            "ContentType": "text/html",
        },
    )
    assert complete(s).status_code == 413
    assert MediaRepository.get_media_by_id(s["media_id"])["status"] == "rejected"


def test_nested_publication_filters():
    from app.modules.catalog.service import CatalogService

    templates = CatalogService.get_starter_outfits()
    hidden = templates[0]["items"][0]["item_id"]
    Database.execute("UPDATE items SET is_published=0 WHERE id=?", (hidden,))
    for template in CatalogService.get_starter_outfits():
        assert all(item["item_id"] != hidden for item in template["items"])
    response = client.post(
        "/api/color-analysis",
        json={"colors": [{"slot": "outerwear", "hex_color": "#FFFFFF"}]},
    )
    assert response.status_code == 200
    assert all(
        row["item_id"] != hidden for row in response.json()["suggested_variants"]
    )


@pytest.mark.asyncio
async def test_weather_sample_recovery_and_http_pool(monkeypatch):
    from app.modules.weather.service import WeatherService
    from app.core.http_client import (
        get_shared_async_client,
        close_shared_async_client,
        _clients,
    )

    real_client = get_shared_async_client(5.0)
    assert real_client is get_shared_async_client(5.0)
    assert real_client is not get_shared_async_client(25.0)

    async def unavailable(*args, **kwargs):
        raise httpx.ConnectError("offline")

    original = real_client.get
    monkeypatch.setattr(real_client, "get", unavailable)
    result = await WeatherService.get_city_weather("hanoi")
    assert result.source == "sample"
    from datetime import datetime, timezone

    row = Database.fetch_one("SELECT * FROM weather_cache WHERE location_key='hanoi'")
    assert (
        0
        < (
            datetime.fromisoformat(row["expires_at"]) - datetime.now(timezone.utc)
        ).total_seconds()
        <= 60
    )
    Database.execute("UPDATE weather_cache SET expires_at='2000-01-01'")
    monkeypatch.setattr(real_client, "get", original)
    assert (await WeatherService.get_city_weather("hanoi")).source == "open_meteo"
    await close_shared_async_client()
    assert not _clients


def test_google_account_creation_rollback(monkeypatch):
    from app.modules.auth.service import AuthService

    original = Database.execute

    def fail_role(query, params=(), conn=None):
        if "INSERT INTO user_roles" in query:
            raise RuntimeError("injected role insert failure")
        return original(query, params, conn)

    monkeypatch.setattr(Database, "execute", fail_role)
    with pytest.raises(RuntimeError):
        AuthService._complete_google_auth(
            {"email": "rollback@example.invalid", "sub": "google-test"}
        )
    assert (
        Database.fetch_one(
            "SELECT * FROM accounts WHERE email='rollback@example.invalid'"
        )
        is None
    )
    assert (
        Database.fetch_one("SELECT * FROM profiles WHERE display_name='rollback'")
        is None
    )


def test_production_lifespan_does_not_migrate(monkeypatch, tmp_path):
    from app.core import database

    path = tmp_path / "no-auto-migrate.db"
    monkeypatch.setattr(database, "SQLITE_DB_PATH", str(path))
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with TestClient(create_app()) as production:
        assert production.get("/health").status_code == 200
        assert not path.exists()


@pytest.mark.asyncio
async def test_chunked_multipart_is_bounded_before_spooling(monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_VIDEO_MAX_BYTES", 1024)
    s = session()
    prefix = b'--bound\r\nContent-Disposition: form-data; name="file"; filename="p.png"\r\nContent-Type: image/png\r\n\r\n'

    async def chunks():
        yield prefix
        for _ in range(100):
            yield b"x" * 1024
        yield b"\r\n--bound--\r\n"

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.post(
            s["upload_url"],
            content=chunks(),
            headers={"Content-Type": "multipart/form-data; boundary=bound"},
        )
    assert response.status_code == 413, response.text
    assert MediaRepository.get_media_by_id(s["media_id"])["status"] == "pending"


@pytest.mark.parametrize(
    "missing", ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
)
def test_partial_storage_credentials_do_not_fall_back(monkeypatch, missing):
    for field in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        monkeypatch.setattr(settings, field, "" if field == missing else "fixture")
    assert client.get("/ready").status_code == 503
    assert (
        client.post(
            "/api/media/uploads", headers=HEADERS(), json={"filename": "p.png"}
        ).status_code
        == 503
    )


def test_readiness_rejects_storage_auth_failure(monkeypatch):
    fake = FakeS3()

    def reject(**kwargs):
        raise OSError("injected authentication failure")

    fake.head_bucket = reject
    monkeypatch.setattr(R2StorageClient, "is_configured", property(lambda self: True))
    monkeypatch.setattr(R2StorageClient, "s3", property(lambda self: fake))
    monkeypatch.setattr(r2_client, "_readiness", (0, False))
    assert client.get("/ready").status_code == 503


def test_invalid_hex_returns_validation_error():
    assert (
        client.post(
            "/api/color-analysis",
            json={"colors": [{"slot": "outerwear", "hex_color": "#GGGGGG"}]},
        ).status_code
        == 422
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload", [[], {"outfits": [42]}, {"outfits": [{"items": [{"itemId": None}]}]}]
)
async def test_gemini_client_validates_upstream_shape(monkeypatch, payload):
    from app.infrastructure.gemini.client import gemini_client
    from app.core.http_client import get_shared_async_client, close_shared_async_client
    from app.modules.catalog.repository import CatalogRepository

    monkeypatch.setattr(gemini_client, "is_configured", True)

    async def response(*args, **kwargs):
        return httpx.Response(
            200,
            json={
                "candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}}]
            },
        )

    monkeypatch.setattr(get_shared_async_client(25.0), "post", response)
    try:
        result = await gemini_client.get_styling_recommendations(
            "test", None, CatalogRepository.get_items()
        )
        assert result["source"] == "cultural_rule_engine"
    finally:
        await close_shared_async_client()


def test_handoff_upload_example_is_executable():
    import re

    document = (Path(__file__).parents[1] / "docs" / "handoff_fe.md").read_text(
        encoding="utf-8"
    )
    examples = [
        json.loads(block)
        for block in re.findall(r"```json\n(.*?)\n```", document, re.S)
    ]
    payload = next(example for example in examples if "filename" in example)
    response = client.post("/api/media/uploads", headers=HEADERS(), json=payload)
    assert response.status_code == 200, response.text
    assert set(response.json()) == {
        "media_id",
        "upload_url",
        "method",
        "object_key",
        "bucket",
        "expires_in",
        "storage_type",
    }


def test_readiness_detects_missing_table_despite_migration_marker():
    Database.execute("DROP TABLE rate_limits")
    assert client.get("/ready").status_code==503


def test_video_probe_contract_and_corrupt_frame_rejection(monkeypatch):
    data=b"\x00\x00\x00\x18ftypisom"+b"synthetic-for-probe-contract"
    def probe(command,**kwargs):
        assert "-count_frames" in command
        assert kwargs["timeout"]==30 and kwargs["check"] is True
        return subprocess.CompletedProcess(command,0,json.dumps({"streams":[{"codec_type":"video","width":64,"height":48,"nb_read_frames":"25"}],"format":{"duration":"1.0","format_name":"mov,mp4,m4a,3gp,3g2,mj2"}}).encode(),b"")
    monkeypatch.setattr(subprocess,"run",probe)
    clean,width,height,duration=validate_content(data,"video/mp4")
    assert (clean,width,height,duration)==(data,64,48,1000)
    def corrupt(command,**kwargs):
        result=probe(command,**kwargs)
        result.stderr=b"Decoder reported corrupt frame"
        return result
    monkeypatch.setattr(subprocess,"run",corrupt)
    with pytest.raises(AppError) as error:validate_content(data,"video/mp4")
    assert error.value.status_code==422


def test_auth_rate_limit_returns_retry_after_header():
    for _ in range(20):
        assert client.post("/api/auth/login",json={"email":"unknown@example.invalid","password":"no-account"}).status_code==401
    response=client.post("/api/auth/login",json={"email":"unknown@example.invalid","password":"no-account"})
    assert response.status_code==429
    assert 0<int(response.headers["Retry-After"])<=60
    ErrorEnvelope.model_validate(response.json())


def test_upload_expiry_wrong_purpose_and_parallel_replay(png_bytes):
    from app.modules.media.grant_utils import create_media_grant
    s=session()
    endpoint=s["upload_url"].split("?")[0]
    for purpose,ttl in [("read",300),("upload",-1)]:
        response=client.post(endpoint+"?grant="+create_media_grant(s["media_id"],purpose,ttl),files={"file":("p.png",png_bytes)})
        assert response.status_code==403
    def send(_):return client.post(s["upload_url"],files={"file":("p.png",png_bytes)}).status_code
    with ThreadPoolExecutor(2) as pool:assert sorted(pool.map(send,range(2)))==[200,409]
    s=session()
    Database.execute("UPDATE media_assets SET upload_expires_at=0 WHERE id=?",(s["media_id"],))
    assert client.post(s["upload_url"],files={"file":("p.png",png_bytes)}).status_code==409


def test_cleanup_cli_dry_run_and_apply(png_bytes):
    import sys
    from app.core import database
    s=upload(png_bytes)
    Database.execute("UPDATE media_assets SET upload_expires_at=0 WHERE id=?",(s["media_id"],))
    env={**os.environ,"DATABASE_URL":"sqlite:///"+database.SQLITE_DB_PATH,"LOCAL_MEDIA_DIR":settings.LOCAL_MEDIA_DIR}
    command=[sys.executable,str(Path(__file__).resolve().parents[1] / "scripts" / "cleanup_staged_media.py"),"--limit","1"]
    dry=subprocess.run(command+["--dry-run"],env=env,capture_output=True,text=True)
    assert dry.returncode==0,dry.stderr
    assert json.loads(dry.stdout)=={"candidates":1,"processed":0,"failed":0}
    assert MediaRepository.get_media_by_id(s["media_id"])["status"]=="uploaded"
    apply=subprocess.run(command,env=env,capture_output=True,text=True)
    assert apply.returncode==0,apply.stderr
    assert json.loads(apply.stdout)["processed"]==1
    assert MediaRepository.get_media_by_id(s["media_id"])["status"]=="deleted"
    assert r2_client.verify_object_exists(s["bucket"],s["object_key"]) is None


def test_readiness_503_matches_declared_probe_schema(monkeypatch):
    from app.main import ReadinessResponse
    monkeypatch.setattr(settings,"ENVIRONMENT","production")
    response=client.get("/ready")
    assert response.status_code==503
    ReadinessResponse.model_validate(response.json())
    schema=app.openapi()["paths"]["/ready"]["get"]["responses"]["503"]["content"]["application/json"]["schema"]
    assert schema["$ref"].endswith("/ReadinessResponse")


@pytest.mark.asyncio
async def test_provider_concurrency_budget_and_429_fallback(monkeypatch):
    from app.infrastructure.gemini.client import gemini_client
    from app.core.http_client import get_shared_async_client,close_shared_async_client
    from app.modules.catalog.repository import CatalogRepository
    monkeypatch.setattr(gemini_client,"is_configured",True)
    entered=0
    all_entered=asyncio.Event()
    release=asyncio.Event()
    async def slow(*args,**kwargs):
        nonlocal entered
        entered+=1
        if entered==4:all_entered.set()
        await release.wait()
        return httpx.Response(429)
    monkeypatch.setattr(get_shared_async_client(25),"post",slow)
    items=CatalogRepository.get_items()
    tasks=[asyncio.create_task(gemini_client.get_styling_recommendations("test",None,items)) for _ in range(6)]
    try:
        await asyncio.wait_for(all_entered.wait(),2)
        assert entered==4
        release.set()
        results=await asyncio.gather(*tasks)
        assert all(r["source"]=="cultural_rule_engine" for r in results)
    finally:
        release.set()
        await asyncio.gather(*tasks,return_exceptions=True)
        await close_shared_async_client()
