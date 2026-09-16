import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_lookbook_create_share_and_public_view():
    headers = {"Authorization": "Bearer dev-user-123"}

    # 1. Tạo outfit trước
    outfit_res = client.post("/api/outfits", json={
        "title": "Bộ phối chia sẻ",
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_nam_chuan",
            "poseId": "front_01",
            "items": [{"slot": "outerwear", "itemId": "item_ngu_than_nam_xanh"}]
        }
    }, headers=headers)
    assert outfit_res.status_code == 200
    version_id = outfit_res.json()["current_version_id"]

    # 2. Tạo lookbook
    lb_res = client.post("/api/lookbooks", json={
        "title": "Bộ sưu tập Kỷ yếu Đại học",
        "description": "Các mẫu áo ngũ thân cho mùa kỷ yếu",
        "visibility": "unlisted",
        "entries": [{"outfit_version_id": version_id, "sort_order": 1}]
    }, headers=headers)
    assert lb_res.status_code == 200
    lb_data = lb_res.json()
    lookbook_id = lb_data["id"]

    # 3. Tạo share link
    share_res = client.post(f"/api/lookbooks/{lookbook_id}/share", json={"expires_in_days": 7}, headers=headers)
    assert share_res.status_code == 200
    share_data = share_res.json()
    token = share_data["share_token"]
    assert token is not None

    # 4. Người dùng ẩn danh (khách không có token Authorization) truy cập /api/shares/{token}
    view_res = client.get(f"/api/shares/{token}")
    assert view_res.status_code == 200
    view_data = view_res.json()
    assert view_data["title"] == "Bộ sưu tập Kỷ yếu Đại học"
    assert len(view_data["entries"]) == 1
    assert view_data["entries"][0]["outfit_title"] == "Bộ phối chia sẻ"
