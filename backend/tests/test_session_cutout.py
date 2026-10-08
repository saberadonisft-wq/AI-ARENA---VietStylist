import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.core.config import settings
from app.core.database import Database, get_db_connection
from app.modules.catalog import studio_images
from conftest import auth_header


def transparent_garment():
    image = Image.new("RGBA", (32, 40), (0, 0, 0, 0))
    for x in range(8, 24):
        for y in range(6, 34):
            image.putpixel((x, y), (120, 24, 30, 255))
    output = io.BytesIO()
    image.save(output, "PNG")
    return output.getvalue()


def database_dump():
    with get_db_connection() as conn:
        return list(conn.iterdump())


@pytest.mark.parametrize("role", ["user", "stylist", "admin"])
def test_all_accounts_get_png_without_persistence(role):
    user_id = "dev-user-test-1"
    Database.execute("UPDATE user_roles SET role=? WHERE user_id=?", (role, user_id))
    before = database_dump()
    files = sorted(Path(settings.LOCAL_MEDIA_DIR).rglob("*"))
    response = TestClient(app).post("/api/media/session-cutout", content=transparent_garment(),
                                    headers={"Authorization": auth_header(user_id), "Content-Type": "image/png"})
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "no-store, private"
    with Image.open(io.BytesIO(response.content)) as result:
        assert result.mode == "RGBA"
        assert result.getpixel((0, 0))[3] == 0
        assert result.getpixel((8, 8)) == (120, 24, 30, 255)
    assert database_dump() == before
    assert sorted(Path(settings.LOCAL_MEDIA_DIR).rglob("*")) == files


def test_guest_and_inactive_account_rejected_before_reading_upload(monkeypatch):
    from starlette.requests import Request

    async def forbidden_read(_self):
        raise AssertionError("Unauthenticated body must not be read")

    monkeypatch.setattr(Request, "body", forbidden_read)
    client = TestClient(app)
    assert client.post("/api/media/session-cutout", content=b"photo").status_code == 401
    Database.execute("UPDATE accounts SET is_active=0 WHERE id=?", ("dev-user-test-1",))
    response = client.post("/api/media/session-cutout", content=b"photo", headers={"Authorization": auth_header("dev-user-test-1")})
    assert response.status_code in (401, 403)


@pytest.mark.parametrize("data,mime", [(b"not an image", "image/png"), (b"", "image/jpeg"), (b"<svg/>", "image/svg+xml"), (transparent_garment(), "image/jpeg")])
def test_invalid_uploads_rejected(data, mime):
    response = TestClient(app).post("/api/media/session-cutout", content=data,
        headers={"Authorization": auth_header("dev-user-test-1"), "Content-Type": mime})
    assert response.status_code == 422


@pytest.mark.parametrize("chunked", [False, True])
def test_upload_body_is_bounded_before_processing(monkeypatch, chunked):
    monkeypatch.setattr(settings, "MEDIA_IMAGE_MAX_BYTES", 64)
    monkeypatch.setattr(studio_images, "make_session_cutout", lambda *_: pytest.fail("Oversized body reached cutout"))
    body = iter([b"a" * 32, b"b" * 40]) if chunked else b"a" * 72
    response = TestClient(app).post("/api/media/session-cutout", content=body,
        headers={"Authorization": auth_header("dev-user-test-1"), "Content-Type": "image/png"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_busy_and_failed_inference_release_resources(monkeypatch):
    client = TestClient(app)
    headers = {"Authorization": auth_header("dev-user-test-1"), "Content-Type": "image/png"}
    with studio_images._processing:
        assert client.post("/api/media/session-cutout", content=transparent_garment(), headers=headers).json()["error"]["code"] == "CUTOUT_BUSY"
    monkeypatch.setattr(studio_images, "make_cutout", lambda _: (_ for _ in ()).throw(RuntimeError("failed")))
    response = client.post("/api/media/session-cutout", content=transparent_garment(), headers=headers)
    assert response.status_code == 503
    assert not studio_images._processing.locked()


def test_opaque_upload_uses_normal_background_removal(monkeypatch):
    import rembg

    calls = []
    session = object()
    monkeypatch.setattr(studio_images, "_session", session)

    def remove(image, session):
        calls.append((image.mode, session))
        return Image.open(io.BytesIO(transparent_garment()))

    monkeypatch.setattr(rembg, "remove", remove)
    output = io.BytesIO()
    Image.new("RGB", (32, 40), "white").save(output, "JPEG")
    response = TestClient(app).post("/api/media/session-cutout", content=output.getvalue(),
        headers={"Authorization": auth_header("dev-user-test-1"), "Content-Type": "image/jpeg"})
    assert response.status_code == 200
    assert calls == [("RGBA", session)]
