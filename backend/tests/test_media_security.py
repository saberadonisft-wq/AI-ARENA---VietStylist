import os
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.modules.media.grant_utils import create_media_grant, verify_media_grant
from app.modules.media.repository import MediaRepository

client = TestClient(app)


def test_r01_path_traversal_attempts_blocked(tmp_path, monkeypatch):
    """R01: Mọi nỗ lực path traversal trong local media upload và file serve đều bị chặn"""
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", True)

    # 1. Bucket ngoài allowlist
    res1 = client.post("/api/media/local-upload", params={"key": "photo.png", "bucket": "secret-system"}, files={"file": ("p.png", b"data", "image/png")})
    assert res1.status_code == 400
    assert res1.json()["error"]["code"] == "INVALID_BUCKET"

    # 2. Key chứa '..'
    res2 = client.post("/api/media/local-upload", params={"key": "../../etc/passwd", "bucket": "viet-phuc-public"}, files={"file": ("p.png", b"data", "image/png")})
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "INVALID_PATH"

    # 3. Key chứa backslash '\'
    res3 = client.post("/api/media/local-upload", params={"key": "..\\..\\windows\\win.ini", "bucket": "viet-phuc-public"}, files={"file": ("p.png", b"data", "image/png")})
    assert res3.status_code == 400
    assert res3.json()["error"]["code"] == "INVALID_PATH"

    # 4. Key chứa NUL byte
    res4 = client.post("/api/media/local-upload", params={"key": "test\0file.png", "bucket": "viet-phuc-public"}, files={"file": ("p.png", b"data", "image/png")})
    assert res4.status_code == 400
    assert res4.json()["error"]["code"] == "INVALID_PATH"

    # 5. Serve file vượt thư mục
    res5 = client.get("/api/media/files/viet-phuc-public/../../etc/passwd")
    assert res5.status_code in (400, 403, 404)


def test_r01_production_mode_local_routes_return_404(monkeypatch):
    """R01: Khi LOCAL_MEDIA_ENABLED = False (production), các endpoint local trả về 404"""
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", False)

    # Upload endpoint
    res_up = client.post("/api/media/local-upload", params={"key": "photo.png", "bucket": "viet-phuc-public"}, files={"file": ("p.png", b"data", "image/png")})
    assert res_up.status_code == 404
    assert res_up.json()["error"]["code"] == "ENDPOINT_NOT_FOUND"

    # Serve file endpoint
    res_serve = client.get("/api/media/files/viet-phuc-public/photo.png")
    assert res_serve.status_code == 404
    assert res_serve.json()["error"]["code"] == "ENDPOINT_NOT_FOUND"


def test_r05_private_media_requires_signed_grant(tmp_path, monkeypatch):
    """R05: File thuộc bucket private không thể đọc trực tiếp nếu không có signed grant hợp lệ"""
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", True)

    reg_a = client.post("/api/auth/register", json={"email": "alice@test.com", "password": "Password123!", "display_name": "Alice", "role": "user"}).json()
    headers_a = {"Authorization": f"Bearer {reg_a['access_token']}"}
    reg_b = client.post("/api/auth/register", json={"email": "bob@test.com", "password": "Password123!", "display_name": "Bob", "role": "user"}).json()
    headers_b = {"Authorization": f"Bearer {reg_b['access_token']}"}

    # 1. Alice tạo upload session cho private file
    session_res = client.post("/api/media/uploads", json={
        "filename": "confidential.png",
        "media_type": "image",
        "mime_type": "image/png",
        "size_bytes": 100,
        "visibility": "private"
    }, headers=headers_a)
    assert session_res.status_code == 200
    media_id = session_res.json()["media_id"]
    object_key = session_res.json()["object_key"]
    bucket = session_res.json()["bucket"]

    # 2. Upload bytes qua local upload endpoint
    file_path = media_dir / bucket / object_key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(b"SECRET_ALICE_DATA")

    # Khi media vẫn là pending -> /access trả về 409 MEDIA_NOT_READY
    access_pending = client.get(f"/api/media/{media_id}/access", headers=headers_a)
    assert access_pending.status_code == 409
    assert access_pending.json()["error"]["code"] == "MEDIA_NOT_READY"

    # 3. Hoàn tất upload (complete)
    comp_res = client.post(f"/api/media/{media_id}/complete", json={"width": 100, "height": 100}, headers=headers_a)
    assert comp_res.status_code == 200

    # 4. Người lạ (không token) đọc trực tiếp file private -> 403 FORBIDDEN
    direct_res = client.get(f"/api/media/files/{bucket}/{object_key}")
    assert direct_res.status_code == 403
    assert direct_res.json()["error"]["code"] == "FORBIDDEN"

    # 5. User B yêu cầu /access cho file của Alice -> 404 (bảo vệ quyền riêng tư)
    b_access = client.get(f"/api/media/{media_id}/access", headers=headers_b)
    assert b_access.status_code == 404

    # 6. Alice lấy /access hợp lệ -> nhận URL có kèm grant
    a_access = client.get(f"/api/media/{media_id}/access", headers=headers_a)
    assert a_access.status_code == 200
    access_url = a_access.json()["access_url"]
    assert "grant=" in access_url

    # 7. Tải file bằng URL có grant hợp lệ -> 200 và nhận đúng nội dung
    grant = access_url.split("grant=")[1]
    res_download = client.get(f"/api/media/files/{bucket}/{object_key}?grant={grant}")
    assert res_download.status_code == 200
    assert res_download.content == b"SECRET_ALICE_DATA"

    # 8. Grant giả mạo hoặc hết hạn -> 403
    fake_grant = grant[:-4] + "fake"
    res_fake = client.get(f"/api/media/files/{bucket}/{object_key}?grant={fake_grant}")
    assert res_fake.status_code == 403

    # Grant với mục đích khác (upload thay vì read) -> 403
    upload_purpose_grant = create_media_grant(media_id, purpose="upload", expires_in=300)
    res_wrong_purpose = client.get(f"/api/media/files/{bucket}/{object_key}?grant={upload_purpose_grant}")
    assert res_wrong_purpose.status_code == 403
