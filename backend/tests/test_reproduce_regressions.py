import os
import json
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.database import Database, get_db_connection
from app.core.security import create_access_token

client = TestClient(app)


def test_r01_reproduce_arbitrary_file_write_via_local_upload(tmp_path, monkeypatch):
    """R01 baseline: /api/media/local-upload allows writing files outside media root via ../"""
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))

    # Target outside media_dir
    sentinel = tmp_path / "outside_sentinel.txt"
    assert not sentinel.exists()

    # The key uses ../ to escape media_dir
    rel_key = "../../outside_sentinel.txt"
    res = client.post(
        "/api/media/local-upload",
        params={"key": rel_key, "bucket": "viet-phuc-public"},
        files={"file": ("sentinel.txt", b"TRAVERSAL_PAYLOAD", "text/plain")},
    )
    # On vulnerable baseline, this returns 200 and writes outside media directory!
    assert res.status_code == 200
    assert sentinel.exists()
    assert sentinel.read_bytes() == b"TRAVERSAL_PAYLOAD"


def test_r02_reproduce_auto_admin_escalation():
    """R02 baseline: Registering with hardcoded email automatically gets admin on /auth/me"""
    target_email = "saberadonisft@gmail.com"
    # Register as normal user
    reg_res = client.post("/api/auth/register", json={
        "email": target_email,
        "password": "Password123!",
        "display_name": "Adonis",
        "role": "user"
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user"]["id"]

    # Before /me, user only has role 'user'
    roles_before = [r["role"] for r in Database.fetch_all("SELECT role FROM user_roles WHERE user_id = ?", (user_id,))]
    assert "admin" not in roles_before

    # Call /auth/me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

    # On vulnerable baseline, /auth/me inserted admin roles into DB!
    roles_after = [r["role"] for r in Database.fetch_all("SELECT role FROM user_roles WHERE user_id = ?", (user_id,))]
    assert "admin" in roles_after


def test_r03_reproduce_jwt_verification_bypass(monkeypatch):
    """R03 baseline: Empty SUPABASE_JWT_SECRET turns off signature verification"""
    import jwt
    import time
    # When secret is empty string
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    
    # Sign with a completely arbitrary secret
    fake_token = jwt.encode(
        {"sub": "usr_attacker", "exp": int(time.time()) + 3600, "app_metadata": {"roles": ["admin"]}},
        "completely-wrong-secret",
        algorithm="HS256"
    )
    from app.core.security import verify_supabase_jwt
    # On vulnerable baseline, this does not raise AppError because verify_signature is False!
    payload = verify_supabase_jwt(fake_token)
    assert payload["sub"] == "usr_attacker"


def test_r04_reproduce_owner_bypass_without_token():
    """R04 baseline: User B is forbidden from updating User A's outfit, but guest with NO token can update it!"""
    # User A creates outfit
    token_a = create_access_token(user_id="usr_user_a", email="a@example.com", roles=["user"])
    token_b = create_access_token(user_id="usr_user_b", email="b@example.com", roles=["user"])

    res = client.post("/api/outfits", json={
        "title": "A's Private Outfit",
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_1",
            "poseId": "front_01",
            "items": []
        }
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 200
    outfit_id = res.json()["id"]

    # User B tries to update -> gets 403
    update_payload = {
        "title": "B's Hijacked Outfit",
        "revision": 1,
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_1",
            "poseId": "front_01",
            "items": []
        }
    }
    res_b = client.put(f"/api/outfits/{outfit_id}", json=update_payload, headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 403

    # Guest with NO token calls PUT -> On vulnerable baseline, gets 200 and updates A's outfit!
    res_guest = client.put(f"/api/outfits/{outfit_id}", json=update_payload)
    assert res_guest.status_code == 200
    assert res_guest.json()["title"] == "B's Hijacked Outfit"


def test_r05_reproduce_private_media_read_without_auth(tmp_path, monkeypatch):
    """R05 baseline: Private files can be downloaded directly via /media/files/{bucket}/{path} without auth"""
    media_dir = tmp_path / "media"
    private_bucket_dir = media_dir / "viet-phuc-private" / "uploads" / "usr_secret"
    private_bucket_dir.mkdir(parents=True, exist_ok=True)
    secret_file = private_bucket_dir / "confidential.png"
    secret_file.write_bytes(b"SECRET_USER_MEDIA")
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))

    # Public user fetches it directly via serve_local_file route
    res = client.get("/api/media/files/viet-phuc-private/uploads/usr_secret/confidential.png")
    # On vulnerable baseline, returns 200 and secret bytes with no auth!
    assert res.status_code == 200
    assert res.content == b"SECRET_USER_MEDIA"


def test_r06_reproduce_missing_blog_schema_columns():
    """R06 baseline: Querying blog articles with era/category fails with OperationalError due to missing columns"""
    safe_client = TestClient(app, raise_server_exceptions=False)
    res = safe_client.get("/api/heritage/articles?era=Triều Nguyễn")
    # On vulnerable baseline, this fails with 500 Internal Server Error
    assert res.status_code == 500


def test_r07_reproduce_foreign_outfit_version_in_lookbook():
    """R07 baseline: User B can reference User A's outfit_version_id in a lookbook"""
    token_a = create_access_token(user_id="usr_user_a", email="a@example.com")
    token_b = create_access_token(user_id="usr_user_b", email="b@example.com")

    # A creates outfit
    outfit_res = client.post("/api/outfits", json={
        "title": "A's Private Design",
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_1",
            "poseId": "front_01",
            "items": []
        }
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert outfit_res.status_code == 200
    a_version_id = outfit_res.json()["current_version_id"]

    # B creates lookbook referencing A's version
    lb_res = client.post("/api/lookbooks", json={
        "title": "B's Lookbook stealing A's outfit",
        "visibility": "public",
        "entries": [{"outfit_version_id": a_version_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token_b}"})
    # On vulnerable baseline, B successfully references A's outfit version!
    assert lb_res.status_code == 200
    assert len(lb_res.json()["entries"]) == 1
    assert lb_res.json()["entries"][0]["outfit_version_id"] == a_version_id


def test_r08_reproduce_lookbook_update_atomic_loss():
    """R08 baseline: Updating lookbook with invalid entry wipes existing entries before failing"""
    safe_client = TestClient(app, raise_server_exceptions=False)
    token = create_access_token(user_id="usr_owner", email="owner@example.com")
    # 1. Create outfit and lookbook
    outfit_res = safe_client.post("/api/outfits", json={
        "title": "Owner Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token}"})
    v_id = outfit_res.json()["current_version_id"]

    lb_res = safe_client.post("/api/lookbooks", json={
        "title": "Original Lookbook",
        "visibility": "public",
        "entries": [{"outfit_version_id": v_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    lb_id = lb_res.json()["id"]
    assert len(lb_res.json()["entries"]) == 1

    # 2. Update with a non-existent outfit_version_id (foreign key violation or error)
    # Notice that in SQLite, if FK is on, inserting a non-existent outfit_version_id causes IntegrityError
    update_res = safe_client.put(f"/api/lookbooks/{lb_id}", json={
        "title": "Updated Lookbook",
        "entries": [{"outfit_version_id": "non-existent-version-uuid", "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    # On vulnerable baseline, this fails with 500
    assert update_res.status_code == 500

    # 3. Check lookbook entries after error
    fetch_res = safe_client.get(f"/api/lookbooks/{lb_id}", headers={"Authorization": f"Bearer {token}"})
    # On vulnerable baseline, clear_entries() already committed, so entries were wiped to 0!
    assert len(fetch_res.json()["entries"]) == 0


def test_r09_reproduce_draft_leakage():
    """R09 baseline: Unpublished items and draft articles are accessible via public detail endpoints"""
    # Insert unpublished item
    item_id = f"item_draft_{uuid.uuid4().hex[:6]}"
    Database.execute(
        "INSERT INTO items (id, garment_type_id, name, slot, gender, era, is_published) VALUES (?, 'ngu_than', 'Áo nháp bí mật', 'outerwear', 'unisex', 'nguyen', 0)",
        (item_id,)
    )

    # Calling public item detail endpoint
    res = client.get(f"/api/catalog/items/{item_id}")
    # On vulnerable baseline, returns 200!
    assert res.status_code == 200
    assert res.json()["name"] == "Áo nháp bí mật"


def test_r10_reproduce_openapi_drift():
    """R10 baseline: shared/openapi.json is missing /api/auth routes and models"""
    openapi_file = os.path.join(os.path.dirname(__file__), "..", "..", "shared", "openapi.json")
    with open(openapi_file, "r", encoding="utf-8") as f:
        contract = json.load(f)

    paths = contract.get("paths", {})
    # Auth endpoints are completely missing in shared/openapi.json
    assert "/api/auth/register" not in paths
    assert "/api/auth/login" not in paths
    assert "/api/auth/me" not in paths


def test_r11_reproduce_share_link_hardcoded_localhost():
    """R11 baseline: Share link always returns http://localhost:3000 even if origin configured, and no revoke endpoint"""
    token = create_access_token(user_id="usr_owner", email="owner@example.com")
    outfit_res = client.post("/api/outfits", json={
        "title": "Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token}"})
    v_id = outfit_res.json()["current_version_id"]

    lb_res = client.post("/api/lookbooks", json={
        "title": "Lookbook for Share",
        "visibility": "public",
        "entries": [{"outfit_version_id": v_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    lb_id = lb_res.json()["id"]

    share_res = client.post(f"/api/lookbooks/{lb_id}/share", json={"expires_in_days": 10}, headers={"Authorization": f"Bearer {token}"})
    assert share_res.status_code == 200
    # On vulnerable baseline, always returns localhost
    assert share_res.json()["share_url"].startswith("http://localhost:3000/chia-se/")

    # And there is no DELETE /api/lookbooks/{id}/shares endpoint
    del_res = client.delete(f"/api/lookbooks/{lb_id}/shares", headers={"Authorization": f"Bearer {token}"})
    # Returns 405 or 404
    assert del_res.status_code in (404, 405)
