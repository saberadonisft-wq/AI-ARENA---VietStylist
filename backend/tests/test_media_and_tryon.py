import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_media_upload_session_and_complete():
    # 1. Yêu cầu upload URL
    req_payload = {
        "filename": "ao_ngu_than_mau.png",
        "media_type": "image",
        "mime_type": "image/png",
        "size_bytes": 102400,
        "visibility": "public"
    }
    res = client.post("/api/media/uploads", json=req_payload)
    assert res.status_code == 200
    data = res.json()
    media_id = data["media_id"]
    assert data["upload_url"] is not None
    assert data["object_key"] is not None

    # Missing bytes must not become a ready asset.
    missing = client.post(f"/api/media/{media_id}/complete", json={})
    assert missing.status_code == 409
    uploaded = client.post("/api/media/local-upload", params={"key": data["object_key"], "bucket": data["bucket"]}, files={"file": ("test.png", b"test image bytes", "image/png")})
    assert uploaded.status_code == 200
    # 2. Hoàn tất upload
    comp_res = client.post(f"/api/media/{media_id}/complete", json={"width": 800, "height": 1200})
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["id"] == media_id
    assert comp_data["status"] == "ready"


def test_try_on_job_lifecycle():
    # Tạo job thử đồ AI
    job_payload = {
        "user_photo_url": "https://media.vietphucremix.example/user_portrait.jpg",
        "idempotency_key": "test_idemp_key_123",
        "outfit_snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_nu_chuan",
            "poseId": "front_01",
            "items": [
                {"slot": "outerwear", "itemId": "item_ngu_than_nu_hong"}
            ]
        }
    }
    res = client.post("/api/ai/try-on", json=job_payload)
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "TRY_ON_UNAVAILABLE"
