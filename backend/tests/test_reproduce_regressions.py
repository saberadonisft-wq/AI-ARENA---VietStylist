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


@pytest.fixture(autouse=True)
def real_accounts(isolated_runtime):
    for user_id in ("usr_user_a", "usr_user_b", "usr_owner"):
        Database.execute(
            "INSERT INTO accounts(id,email,display_name,is_active) VALUES(?,?,?,1)",
            (user_id, user_id + "@example.invalid", user_id),
        )


def test_r01_reproduce_arbitrary_file_write_via_local_upload(tmp_path, monkeypatch):
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))

    sentinel = tmp_path / "outside_sentinel.txt"
    assert not sentinel.exists()

    rel_key = "../../outside_sentinel.txt"
    res = client.post(
        "/api/media/local-upload",
        params={"key": rel_key, "bucket": "viet-phuc-public"},
        files={"file": ("sentinel.txt", b"TRAVERSAL_PAYLOAD", "text/plain")},
    )
    assert res.status_code == 410
    assert not sentinel.exists()


def test_r02_reproduce_auto_admin_escalation():
    target_email = "formerly-privileged@example.invalid"
    reg_res = client.post(
        "/api/auth/register",
        json={
            "email": target_email,
            "password": "Password123!",
            "display_name": "Adonis",
            "role": "user",
        },
    )
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user"]["id"]

    roles_before = [
        r["role"]
        for r in Database.fetch_all(
            "SELECT role FROM user_roles WHERE user_id = ?", (user_id,)
        )
    ]
    assert "admin" not in roles_before

    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200

    roles_after = [
        r["role"]
        for r in Database.fetch_all(
            "SELECT role FROM user_roles WHERE user_id = ?", (user_id,)
        )
    ]
    assert roles_after == roles_before


def test_r03_reproduce_jwt_verification_bypass(monkeypatch):
    import jwt
    import time

    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")

    fake_token = jwt.encode(
        {
            "sub": "usr_attacker",
            "exp": int(time.time()) + 3600,
            "app_metadata": {"roles": ["admin"]},
        },
        "completely-wrong-secret-of-sufficient-length",
        algorithm="HS256",
    )
    from app.core.security import verify_supabase_jwt
    from app.core.errors import AppError

    with pytest.raises(AppError):
        verify_supabase_jwt(fake_token)


def test_r04_reproduce_owner_bypass_without_token():
    token_a = create_access_token(
        user_id="usr_user_a", email="a@example.com", roles=["user"]
    )
    token_b = create_access_token(
        user_id="usr_user_b", email="b@example.com", roles=["user"]
    )

    res = client.post(
        "/api/outfits",
        json={
            "title": "A's Private Outfit",
            "snapshot": {
                "schemaVersion": 1,
                "avatarId": "avatar_1",
                "poseId": "front_01",
                "items": [],
            },
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 200
    outfit_id = res.json()["id"]

    update_payload = {
        "title": "B's Hijacked Outfit",
        "revision": 1,
        "snapshot": {
            "schemaVersion": 1,
            "avatarId": "avatar_1",
            "poseId": "front_01",
            "items": [],
        },
    }
    res_b = client.put(
        f"/api/outfits/{outfit_id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b.status_code == 404

    res_guest = client.put(f"/api/outfits/{outfit_id}", json=update_payload)
    assert res_guest.status_code == 401
    assert (
        Database.fetch_one("SELECT title FROM outfits WHERE id=?", (outfit_id,))[
            "title"
        ]
        == "A's Private Outfit"
    )


def test_r05_reproduce_private_media_read_without_auth(tmp_path, monkeypatch):
    media_dir = tmp_path / "media"
    private_bucket_dir = media_dir / "viet-phuc-private" / "uploads" / "usr_secret"
    private_bucket_dir.mkdir(parents=True, exist_ok=True)
    secret_file = private_bucket_dir / "confidential.png"
    secret_file.write_bytes(b"SECRET_USER_MEDIA")
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))

    res = client.get(
        "/api/media/files/viet-phuc-private/uploads/usr_secret/confidential.png"
    )
    assert res.status_code == 404
    assert b"SECRET_USER_MEDIA" not in res.content


def test_r06_reproduce_missing_blog_schema_columns():
    safe_client = TestClient(app, raise_server_exceptions=False)
    res = safe_client.get("/api/heritage/articles?era=Triều Nguyễn")
    assert res.status_code == 200


def test_r07_reproduce_foreign_outfit_version_in_lookbook():
    token_a = create_access_token(user_id="usr_user_a", email="a@example.com")
    token_b = create_access_token(user_id="usr_user_b", email="b@example.com")

    outfit_res = client.post(
        "/api/outfits",
        json={
            "title": "A's Private Design",
            "snapshot": {
                "schemaVersion": 1,
                "avatarId": "avatar_1",
                "poseId": "front_01",
                "items": [],
            },
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert outfit_res.status_code == 200
    a_version_id = outfit_res.json()["current_version_id"]

    lb_res = client.post(
        "/api/lookbooks",
        json={
            "title": "B's Lookbook stealing A's outfit",
            "visibility": "public",
            "entries": [{"outfit_version_id": a_version_id, "sort_order": 1}],
        },
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert lb_res.status_code == 422


def test_r08_reproduce_lookbook_update_atomic_loss():
    safe_client = TestClient(app, raise_server_exceptions=False)
    token = create_access_token(user_id="usr_owner", email="owner@example.com")
    outfit_res = safe_client.post(
        "/api/outfits",
        json={
            "title": "Owner Outfit",
            "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    v_id = outfit_res.json()["current_version_id"]

    lb_res = safe_client.post(
        "/api/lookbooks",
        json={
            "title": "Original Lookbook",
            "visibility": "public",
            "entries": [{"outfit_version_id": v_id, "sort_order": 1}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    lb_id = lb_res.json()["id"]
    assert len(lb_res.json()["entries"]) == 1

    update_res = safe_client.put(
        f"/api/lookbooks/{lb_id}",
        json={
            "title": "Updated Lookbook",
            "entries": [
                {"outfit_version_id": "non-existent-version-uuid", "sort_order": 1}
            ],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 422

    fetch_res = safe_client.get(
        f"/api/lookbooks/{lb_id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert len(fetch_res.json()["entries"]) == 1
    assert fetch_res.json()["title"] == "Original Lookbook"


def test_r09_reproduce_draft_leakage():
    item_id = f"item_draft_{uuid.uuid4().hex[:6]}"
    Database.execute(
        "INSERT INTO items (id, garment_type_id, name, slot, gender, era, is_published) VALUES (?, 'ngu_than', 'Áo nháp bí mật', 'outerwear', 'unisex', 'nguyen', 0)",
        (item_id,),
    )

    res = client.get(f"/api/catalog/items/{item_id}")
    assert res.status_code == 404


def test_r10_reproduce_openapi_drift():
    openapi_file = os.path.join(
        os.path.dirname(__file__), "..", "..", "shared", "openapi.json"
    )
    with open(openapi_file, "r", encoding="utf-8") as f:
        contract = json.load(f)

    paths = contract.get("paths", {})
    assert "/api/auth/register" in paths
    assert "/api/auth/login" in paths
    assert "/api/auth/me" in paths


def test_r11_reproduce_share_link_hardcoded_localhost(monkeypatch):
    monkeypatch.setattr(
        settings, "FRONTEND_PUBLIC_ORIGIN", "https://frontend.example.invalid"
    )
    token = create_access_token(user_id="usr_owner", email="owner@example.com")
    outfit_res = client.post(
        "/api/outfits",
        json={
            "title": "Outfit",
            "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    v_id = outfit_res.json()["current_version_id"]

    lb_res = client.post(
        "/api/lookbooks",
        json={
            "title": "Lookbook for Share",
            "visibility": "public",
            "entries": [{"outfit_version_id": v_id, "sort_order": 1}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    lb_id = lb_res.json()["id"]

    share_res = client.post(
        f"/api/lookbooks/{lb_id}/share",
        json={"expires_in_days": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert share_res.status_code == 200
    assert share_res.json()["share_url"].startswith(
        "https://frontend.example.invalid/chia-se/"
    )

    del_res = client.delete(
        f"/api/lookbooks/{lb_id}/shares", headers={"Authorization": f"Bearer {token}"}
    )
    assert del_res.status_code == 200
    assert (
        client.get("/api/shares/" + share_res.json()["share_token"]).status_code == 404
    )
