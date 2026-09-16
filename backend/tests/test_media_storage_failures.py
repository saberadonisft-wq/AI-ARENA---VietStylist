import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.security import create_access_token
from app.infrastructure.r2.client import r2_client
from app.modules.media.repository import MediaRepository

client = TestClient(app)


def test_media_delete_storage_failure_preserves_deleting_state(tmp_path, monkeypatch):
    """R05 & O06: Nếu xóa storage thất bại, trạng thái 'deleting' được giữ lại để retry, không bị xóa mất metadata"""
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", True)

    reg = client.post("/api/auth/register", json={"email": "del@test.com", "password": "Password123!", "display_name": "Del", "role": "user"}).json()
    headers = {"Authorization": f"Bearer {reg['access_token']}"}

    # 1. Tạo session upload
    session_res = client.post("/api/media/uploads", json={
        "filename": "test_del.png",
        "media_type": "image",
        "mime_type": "image/png",
        "size_bytes": 50,
        "visibility": "private"
    }, headers=headers)
    assert session_res.status_code == 200
    media_id = session_res.json()["media_id"]
    object_key = session_res.json()["object_key"]
    bucket = session_res.json()["bucket"]

    # Viết file giả lập
    file_path = media_dir / bucket / object_key
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(b"DATA_TO_DELETE")

    client.post(f"/api/media/{media_id}/complete", json={"width": 10, "height": 10}, headers=headers)

    # 2. Giả lập storage delete lỗi (trả False)
    monkeypatch.setattr(r2_client, "delete_object", lambda b, k: False)

    # 3. Gọi DELETE endpoint
    del_res = client.delete(f"/api/media/{media_id}", headers=headers)
    assert del_res.status_code == 200

    # 4. Do storage delete lỗi, asset vẫn tồn tại trong DB với trạng thái 'deleting'
    asset = MediaRepository.get_media_by_id(media_id)
    assert asset is not None
    assert asset["status"] == "deleting"

    # Khi asset ở trạng thái 'deleting', không thể lấy grant access nữa -> 409 MEDIA_NOT_READY
    access_res = client.get(f"/api/media/{media_id}/access", headers=headers)
    assert access_res.status_code == 409
    assert access_res.json()["error"]["code"] == "MEDIA_NOT_READY"

    # 5. Phục hồi storage delete thành công -> chạy lại delete (idempotent retry)
    monkeypatch.setattr(r2_client, "delete_object", lambda b, k: True)
    del_retry = client.delete(f"/api/media/{media_id}", headers=headers)
    assert del_retry.status_code == 200

    # Sau khi storage thành công, record đã được xóa hoàn tất
    assert MediaRepository.get_media_by_id(media_id) is None
