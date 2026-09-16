import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_and_update_outfit_optimistic_locking():
    # 1. Tạo outfit mới
    create_payload = {
        "title": "Bản phối Test Kỷ yếu",
        "occasion_id": "ky_yeu",
        "style_mode": "traditional",
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_nam_chuan",
            "poseId": "front_01",
            "occasionId": "ky_yeu",
            "styleMode": "traditional",
            "items": [
                {"slot": "outerwear", "itemId": "item_ngu_than_nam_xanh", "variantId": "var_ngu_than_nam_xanh_cham"}
            ]
        }
    }
    create_res = client.post("/api/outfits", json=create_payload)
    assert create_res.status_code == 200
    created = create_res.json()
    outfit_id = created["id"]
    assert created["revision"] == 1

    # 2. Update thành công với revision = 1
    update_payload = {
        "title": "Bản phối Test Kỷ yếu v2",
        "revision": 1,
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_nam_chuan",
            "poseId": "front_01",
            "occasionId": "ky_yeu",
            "styleMode": "traditional",
            "items": [
                {"slot": "outerwear", "itemId": "item_ngu_than_nam_xanh", "variantId": "var_ngu_than_nam_xanh_cham"},
                {"slot": "bottom", "itemId": "item_quan_trang_lua", "variantId": "var_quan_trang"}
            ]
        }
    }
    update_res = client.put(f"/api/outfits/{outfit_id}", json=update_payload)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["revision"] == 2

    # 3. Thử update lại với revision cũ (revision = 1) -> Phải báo lỗi 409 CONFLICT!
    conflict_res = client.put(f"/api/outfits/{outfit_id}", json=update_payload)
    assert conflict_res.status_code == 409
    err = conflict_res.json()
    assert err["error"]["code"] == "REVISION_CONFLICT"


def test_compare_outfits_a_b():
    payload = {
        "snapshot_a": {
            "schemaVersion": 1,
            "avatarId": "avatar_nam_chuan",
            "poseId": "front_01",
            "occasionId": "ky_yeu",
            "styleMode": "traditional",
            "items": [
                {"slot": "outerwear", "itemId": "item_ngu_than_nam_xanh", "colorHex": "#1A365D"},
                {"slot": "bottom", "itemId": "item_quan_trang_lua", "colorHex": "#FFFFFF"},
            ]
        },
        "snapshot_b": {
            "schemaVersion": 1,
            "avatarId": "avatar_nam_chuan",
            "poseId": "front_01",
            "occasionId": "tet",
            "styleMode": "remix",
            "items": [
                {"slot": "outerwear", "itemId": "item_ngu_than_unisex_vang", "colorHex": "#D69E2E"},
                {"slot": "bottom", "itemId": "item_quan_trang_lua", "colorHex": "#FFFFFF"},
            ]
        }
    }
    res = client.post("/api/outfits/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["style_changed"] is True
    assert data["occasion_changed"] is True

    diff_map = {d["slot"]: d for d in data["diffs"]}
    assert diff_map["outerwear"]["is_changed"] is True
    assert diff_map["bottom"]["is_changed"] is False
