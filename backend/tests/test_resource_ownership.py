import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Database
from app.core.security import create_access_token

client = TestClient(app)


@pytest.fixture
def auth_users():
    """Tạo 2 tài khoản A và B để kiểm tra phân quyền sở hữu (R04)."""
    # Register User A
    email_a = "user_a@example.com"
    res_a = client.post("/api/auth/register", json={
        "email": email_a,
        "password": "Password123!",
        "display_name": "User A",
        "role": "user"
    })
    assert res_a.status_code == 200
    user_a = res_a.json()["user"]
    token_a = res_a.json()["access_token"]

    # Register User B
    email_b = "user_b@example.com"
    res_b = client.post("/api/auth/register", json={
        "email": email_b,
        "password": "Password123!",
        "display_name": "User B",
        "role": "user"
    })
    assert res_b.status_code == 200
    user_b = res_b.json()["user"]
    token_b = res_b.json()["access_token"]

    return {
        "a": {"user": user_a, "token": token_a, "headers": {"Authorization": f"Bearer {token_a}"}},
        "b": {"user": user_b, "token": token_b, "headers": {"Authorization": f"Bearer {token_b}"}},
    }


def test_r04_outfit_guest_rejected(auth_users):
    """R04: Khách chưa đăng nhập không thể tạo, xem, cập nhật hoặc xóa outfit trên server (401)"""
    # Create without token -> 401
    create_res = client.post("/api/outfits", json={
        "title": "Guest Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    })
    assert create_res.status_code == 401

    # List without token -> 401
    list_res = client.get("/api/outfits")
    assert list_res.status_code == 401

    a_headers = auth_users["a"]["headers"]
    res = client.post("/api/outfits", json={
        "title": "A Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers=a_headers)
    assert res.status_code == 200
    a_outfit = res.json()
    outfit_id = a_outfit["id"]

    # Guest get -> 401
    assert client.get(f"/api/outfits/{outfit_id}").status_code == 401

    # Guest update -> 401
    assert client.put(f"/api/outfits/{outfit_id}", json={
        "title": "Hacked",
        "revision": 1,
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }).status_code == 401

    # Guest delete -> 401
    assert client.delete(f"/api/outfits/{outfit_id}").status_code == 401


def test_r04_outfit_owner_isolation(auth_users):
    """R04: User B không thể đọc, cập nhật hoặc xóa outfit của User A (trả về 404 để bảo vệ quyền riêng tư)"""
    a_headers = auth_users["a"]["headers"]
    b_headers = auth_users["b"]["headers"]

    # 1. A creates outfit
    a_outfit = client.post("/api/outfits", json={
        "title": "A Private Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers=a_headers).json()
    outfit_id = a_outfit["id"]

    # 2. B cannot get A's outfit -> 404
    b_get = client.get(f"/api/outfits/{outfit_id}", headers=b_headers)
    assert b_get.status_code == 404

    # 3. B cannot update A's outfit -> 404
    b_update = client.put(f"/api/outfits/{outfit_id}", json={
        "title": "B Tampering",
        "revision": 1,
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers=b_headers)
    assert b_update.status_code == 404

    # 4. B cannot delete A's outfit -> 404
    b_del = client.delete(f"/api/outfits/{outfit_id}", headers=b_headers)
    assert b_del.status_code == 404

    # 5. A can get, update, and delete their own outfit
    a_get = client.get(f"/api/outfits/{outfit_id}", headers=a_headers)
    assert a_get.status_code == 200
    assert a_get.json()["title"] == "A Private Outfit"

    a_update = client.put(f"/api/outfits/{outfit_id}", json={
        "title": "A Updated Outfit",
        "revision": 1,
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers=a_headers)
    assert a_update.status_code == 200
    assert a_update.json()["title"] == "A Updated Outfit"

    a_del = client.delete(f"/api/outfits/{outfit_id}", headers=a_headers)
    assert a_del.status_code == 200


def test_r04_solution_form_privacy_and_cas(auth_users):
    """R04 & O03: Solution form độc lập theo từng owner, không dùng team_default_owner chung; CAS conflict hoạt động"""
    a_headers = auth_users["a"]["headers"]
    b_headers = auth_users["b"]["headers"]

    # Guest -> 401
    assert client.get("/api/solution-form").status_code == 401
    assert client.put("/api/solution-form", json={"team_name": "Guest", "product_name": "P", "revision": 1, "status": "draft"}).status_code == 401

    # A gets form
    a_form = client.get("/api/solution-form", headers=a_headers).json()
    assert a_form["owner_id"] == auth_users["a"]["user"]["id"]
    assert a_form["revision"] == 1

    # B gets form -> must be B's own form with owner_id == B
    b_form = client.get("/api/solution-form", headers=b_headers).json()
    assert b_form["owner_id"] == auth_users["b"]["user"]["id"]
    assert b_form["id"] != a_form["id"]

    # A updates form
    a_update = client.put("/api/solution-form", json={
        "team_name": "Team A Elite",
        "product_name": "VietStylist Pro",
        "revision": 1,
        "status": "draft"
    }, headers=a_headers)
    assert a_update.status_code == 200
    assert a_update.json()["revision"] == 2
    assert a_update.json()["team_name"] == "Team A Elite"

    # Stale update with revision=1 on A -> 409
    a_stale = client.put("/api/solution-form", json={
        "team_name": "Team A Stale",
        "product_name": "VietStylist Pro",
        "revision": 1,
        "status": "draft"
    }, headers=a_headers)
    assert a_stale.status_code == 409
    assert a_stale.json()["error"]["code"] == "REVISION_CONFLICT"

    # B's form is completely untouched by A's changes
    b_form_check = client.get("/api/solution-form", headers=b_headers).json()
    assert b_form_check["revision"] == 1
    assert b_form_check["team_name"] != "Team A Elite"


def test_r04_media_owner_isolation(auth_users):
    """R04: User B không thể complete hoặc delete media của User A"""
    a_headers = auth_users["a"]["headers"]
    b_headers = auth_users["b"]["headers"]

    # Guest upload request -> 401
    assert client.post("/api/media/uploads", json={
        "filename": "photo.png", "media_type": "image", "mime_type": "image/png", "size_bytes": 1000, "visibility": "private"
    }).status_code == 401

    # A requests upload session
    upload_data = client.post("/api/media/uploads", json={
        "filename": "photo_a.png", "media_type": "image", "mime_type": "image/png", "size_bytes": 1000, "visibility": "private"
    }, headers=a_headers).json()
    media_id = upload_data["media_id"]

    # B tries to complete A's media -> 404
    b_comp = client.post(f"/api/media/{media_id}/complete", json={"width": 100, "height": 100}, headers=b_headers)
    assert b_comp.status_code == 404

    # B tries to delete A's media -> 404
    b_del = client.delete(f"/api/media/{media_id}", headers=b_headers)
    assert b_del.status_code == 404

    # B tries to get access URL for A's private media -> 404
    b_access = client.get(f"/api/media/{media_id}/access", headers=b_headers)
    assert b_access.status_code == 404

    # Guest tries to access private media -> 401
    guest_access = client.get(f"/api/media/{media_id}/access")
    assert guest_access.status_code == 401
