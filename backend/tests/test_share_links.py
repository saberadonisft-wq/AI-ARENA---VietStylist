import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.database import Database


def register_user(client: TestClient, email: str, display_name: str = "User"):
    res = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "display_name": display_name,
            "role": "user",
        },
    )
    assert res.status_code == 200, res.text
    return res.json()["user"]["id"], res.json()["access_token"]


def test_r11_share_link_origin_and_ttl_validation(isolated_runtime):
    """R11: Share link uses FRONTEND_PUBLIC_ORIGIN and validates expires_in_days (1-30)"""
    client = TestClient(app, raise_server_exceptions=False)
    owner_id, token = register_user(client, "owner_r11_1@example.com", "Owner")

    outfit_res = client.post(
        "/api/outfits",
        json={
            "title": "Outfit for Share",
            "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert outfit_res.status_code == 200, outfit_res.text
    v_id = outfit_res.json()["current_version_id"]

    lb_res = client.post(
        "/api/lookbooks",
        json={
            "title": "Shareable Lookbook",
            "entries": [{"outfit_version_id": v_id, "sort_order": 1}],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert lb_res.status_code == 200, lb_res.text
    lb_id = lb_res.json()["id"]

    # Test invalid expires_in_days <= 0
    res_zero = client.post(
        f"/api/lookbooks/{lb_id}/share",
        json={"expires_in_days": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_zero.status_code == 422
    assert res_zero.json()["error"]["code"] == "VALIDATION_ERROR"

    # Test invalid expires_in_days > 30
    res_large = client.post(
        f"/api/lookbooks/{lb_id}/share",
        json={"expires_in_days": 31},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_large.status_code == 422
    assert res_large.json()["error"]["code"] == "VALIDATION_ERROR"

    # Test valid share link generation
    res_ok = client.post(
        f"/api/lookbooks/{lb_id}/share",
        json={"expires_in_days": 7},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_ok.status_code == 200
    data = res_ok.json()

    expected_origin = settings.FRONTEND_PUBLIC_ORIGIN.rstrip("/")
    assert data["share_url"].startswith(expected_origin)
    assert f"/chia-se/{data['share_token']}" in data["share_url"]
    assert data["expires_at"] is not None


def test_r11_share_link_resolution_and_revocation(isolated_runtime):
    """R11: Public access works via token, revocation returns 404, expired returns 410"""
    client = TestClient(app, raise_server_exceptions=False)
    owner_id, owner_token = register_user(client, "owner_r11_2@example.com", "Owner")
    other_id, other_token = register_user(client, "other_r11_2@example.com", "Other")

    outfit_res = client.post(
        "/api/outfits",
        json={
            "title": "My Design",
            "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []},
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert outfit_res.status_code == 200, outfit_res.text
    v_id = outfit_res.json()["current_version_id"]

    lb_res = client.post(
        "/api/lookbooks",
        json={
            "title": "Public Exhibition",
            "entries": [{"outfit_version_id": v_id, "sort_order": 1}],
        },
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert lb_res.status_code == 200, lb_res.text
    lb_id = lb_res.json()["id"]

    share_res = client.post(
        f"/api/lookbooks/{lb_id}/share",
        json={"expires_in_days": 14},
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert share_res.status_code == 200, share_res.text
    share_token = share_res.json()["share_token"]

    # Public client resolves token without auth
    view_res = client.get(f"/api/shares/{share_token}")
    assert view_res.status_code == 200
    assert view_res.json()["title"] == "Public Exhibition"
    assert len(view_res.json()["entries"]) == 1

    # Unauthorized user attempts to revoke: 403
    revoke_unauth = client.delete(
        f"/api/lookbooks/{lb_id}/shares",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert revoke_unauth.status_code == 404

    # Owner revokes shares
    revoke_res = client.delete(
        f"/api/lookbooks/{lb_id}/shares",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert revoke_res.status_code == 200

    # Public client attempts to resolve revoked token: 404
    view_revoked = client.get(f"/api/shares/{share_token}")
    assert view_revoked.status_code == 404
    assert view_revoked.json()["error"]["code"] == "SHARE_NOT_FOUND"


def test_r11_expired_share_link(isolated_runtime):
    """R11: Expired share link returns 410 SHARE_EXPIRED"""
    import hashlib

    client = TestClient(app, raise_server_exceptions=False)
    token = "test_expired_token_value_12345"
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    expired_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    Database.execute("""
        INSERT INTO lookbooks (id, owner_id, title, visibility)
        VALUES ('lb_expired', 'usr_owner', 'Expired LB', 'public')
    """)

    Database.execute(
        """
        INSERT INTO share_links (id, lookbook_id, token_hash, token_plain_prefix, scope, expires_at, is_revoked)
        VALUES ('link_exp_1', 'lb_expired', ?, 'test_exp', 'view_only', ?, 0)
    """,
        (token_hash, expired_time),
    )

    res = client.get(f"/api/shares/{token}")
    assert res.status_code == 410
    assert res.json()["error"]["code"] == "SHARE_EXPIRED"
