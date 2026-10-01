"""Regression probes for account pre-hijacking and upload admission boundaries."""
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile

from app.core.config import settings
from app.core.database import Database
from app.core.errors import AppError
from app.core.security import create_access_token
from app.infrastructure.r2.client import R2StorageClient, r2_client
from app.main import app
from app.modules.auth.schemas import RegisterRequest
from app.modules.auth.service import AuthService
from app.modules.media.repository import MediaRepository
from app.modules.media.schemas import CompleteUploadRequest, RequestUploadUrlInput
from app.modules.media.service import MediaService


def test_google_cannot_claim_unverified_local_registration():
    local = AuthService.register(RegisterRequest(
        email="claimed@example.invalid", password="PreRegistrantPassword!", display_name="Pre-registrant",
    ))
    before = Database.fetch_one("SELECT * FROM accounts WHERE id=?", (local.user.id,))
    with pytest.raises(AppError) as caught:
        AuthService._complete_google_auth({"email": local.user.email, "sub": "verified-google-sub"})
    assert caught.value.code == "GOOGLE_ACCOUNT_LINK_REQUIRED"
    assert caught.value.status_code == 409
    assert Database.fetch_one("SELECT * FROM accounts WHERE id=?", (local.user.id,)) == before


def test_google_identity_is_bound_to_subject_not_email():
    first = AuthService._complete_google_auth({"email": "google@example.invalid", "sub": "subject-one"})
    repeat = AuthService._complete_google_auth({"email": "renamed@example.invalid", "sub": "subject-one"})
    assert repeat.user.id == first.user.id
    with pytest.raises(AppError) as caught:
        AuthService._complete_google_auth({"email": "google@example.invalid", "sub": "subject-two"})
    assert caught.value.code == "GOOGLE_ACCOUNT_LINK_REQUIRED"


def test_legacy_automatic_link_blocks_old_password_and_existing_token():
    local = AuthService.register(RegisterRequest(
        email="legacy@example.invalid", password="OldPassword!", display_name="Legacy link",
    ))
    Database.execute("UPDATE accounts SET provider_id='old-google-sub' WHERE id=?", (local.user.id,))
    client = TestClient(app)
    login = client.post("/api/auth/login", json={"email": local.user.email, "password": "OldPassword!"})
    session = client.get("/api/auth/me", headers={"Authorization": "Bearer " + local.access_token})
    for response in (login, session):
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "ACCOUNT_LINK_REVIEW_REQUIRED"


@pytest.mark.parametrize("identity,expected", [(None, 401), ("dev-user-test-1", 403), ("invalid", 401)])
async def test_stylist_rejects_unauthorized_upload_without_reading_body(identity, expected):
    consumed = False

    async def body():
        nonlocal consumed
        consumed = True
        yield b"untrusted input"

    headers = {"Content-Type": "multipart/form-data; boundary=probe"}
    if identity:
        headers["Authorization"] = "Bearer " + ("invalid" if identity == "invalid" else create_access_token(identity))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.post("/api/stylist/garment-image", headers=headers, content=body())
    assert response.status_code == expected
    assert not consumed
    assert response.headers["x-request-id"] == response.json()["error"]["request_id"]


def test_stylist_rejects_declared_oversize_before_spooling(monkeypatch):
    async def unexpected_write(*args):
        pytest.fail("Oversized request reached multipart spool")

    monkeypatch.setattr(UploadFile, "write", unexpected_write)
    response = TestClient(app).post(
        "/api/stylist/garment-image",
        headers={"Authorization": "Bearer " + create_access_token("dev-user-admin"),
                 "Content-Length": str(settings.MEDIA_IMAGE_MAX_BYTES + 65537)},
        files={"file": ("oversize.png", b"small actual payload", "image/png")},
    )
    assert response.status_code == 413


async def test_stylist_chunked_upload_is_bounded_and_spool_closed(monkeypatch):
    import starlette.formparsers as parsers

    monkeypatch.setattr(settings, "MEDIA_IMAGE_MAX_BYTES", 1024)
    original = parsers.SpooledTemporaryFile
    spools = []

    def capture(*args, **kwargs):
        kwargs["max_size"] = 64
        spool = original(*args, **kwargs)
        spools.append(spool)
        return spool

    monkeypatch.setattr(parsers, "SpooledTemporaryFile", capture)
    chunks_read = 0

    async def body():
        nonlocal chunks_read
        yield b'--probe\r\nContent-Disposition: form-data; name="file"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n'
        for _ in range(100):
            chunks_read += 1
            yield b"x" * 4096
        yield b"\r\n--probe--\r\n"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.post(
            "/api/stylist/garment-image", content=body(),
            headers={"Content-Type": "multipart/form-data; boundary=probe",
                     "Authorization": "Bearer " + create_access_token("dev-user-admin")},
        )
    assert response.status_code == 413
    assert chunks_read <= 17
    assert spools and all(spool.closed for spool in spools)


@pytest.fixture
def configured_r2(monkeypatch):
    for name in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"):
        monkeypatch.setattr(settings, name, "synthetic-review-credential")
    storage = R2StorageClient()
    yield storage
    storage.close()


def test_r2_signature_binds_exact_content_length(configured_r2, monkeypatch):
    import botocore.auth
    from datetime import datetime, timezone

    monkeypatch.setattr(botocore.auth, "get_current_datetime", lambda: datetime(2026, 10, 1, tzinfo=timezone.utc))
    def signed(size):
        url = configured_r2.generate_upload_url("private", "staging/probe.png", "image/png", size)["upload_url"]
        return parse_qs(urlsplit(url).query)

    first, altered = signed(100), signed(101)
    assert first["X-Amz-SignedHeaders"] == ["content-length;content-type;host"]
    assert first["X-Amz-Date"] == altered["X-Amz-Date"]
    assert first["X-Amz-Signature"] != altered["X-Amz-Signature"]


@pytest.mark.parametrize("size,code", [(None, "UPLOAD_SIZE_REQUIRED"), (10 * 1024 * 1024 + 1, "PAYLOAD_TOO_LARGE")])
def test_r2_cannot_issue_unbounded_upload(configured_r2, monkeypatch, size, code):
    monkeypatch.setattr(r2_client, "generate_upload_url", lambda *a, **kw: pytest.fail("Must reject before signing"))
    with pytest.raises(AppError) as caught:
        MediaService.create_upload_session("dev-user-test-1", RequestUploadUrlInput(filename="x.png", size_bytes=size))
    assert caught.value.code == code
    assert Database.fetch_one("SELECT count(*) AS n FROM media_assets")["n"] == 0


def test_r2_complete_rejects_size_mismatch(configured_r2, monkeypatch, png_bytes):
    monkeypatch.setattr(r2_client, "generate_upload_url", configured_r2.generate_upload_url)
    session = MediaService.create_upload_session(
        "dev-user-test-1", RequestUploadUrlInput(filename="x.png", size_bytes=len(png_bytes)),
    )
    monkeypatch.setattr(r2_client, "verify_object_exists", lambda *a: {"size_bytes": len(png_bytes) + 1})
    monkeypatch.setattr(r2_client, "read_object", lambda *a: pytest.fail("Mismatched object must not be read/promoted"))
    with pytest.raises(AppError) as caught:
        MediaService.complete_upload(session.media_id, "dev-user-test-1", CompleteUploadRequest())
    assert caught.value.code == "UPLOAD_SIZE_MISMATCH"
    assert MediaRepository.get_media_by_id(session.media_id)["status"] == "rejected"
