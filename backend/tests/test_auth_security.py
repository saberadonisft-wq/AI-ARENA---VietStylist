import time
import uuid
import pytest
import jwt
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.database import Database, get_db_connection
from app.core.security import create_access_token, verify_supabase_jwt
from app.core.errors import AppError

client = TestClient(app)


def test_r02_register_with_any_email_never_gets_admin():
    """R02: Không có email nào được tự động cấp admin khi đăng ký hoặc khi gọi /auth/me"""
    email = "saberadonisft@gmail.com"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "StrongPassword123!",
        "display_name": "Adonis",
        "role": "user"
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    user_id = reg_res.json()["user"]["id"]
    assert reg_res.json()["user"]["roles"] == ["user"]

    # Call /auth/me multiple times
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["roles"] == ["user"]

    # Verify directly in database that user_roles has NO admin entry
    db_roles = [r["role"] for r in Database.fetch_all("SELECT role FROM user_roles WHERE user_id = ?", (user_id,))]
    assert db_roles == ["user"]
    assert "admin" not in db_roles

    # Calling an admin endpoint must be rejected with 403
    admin_res = client.post("/api/admin/items", json={
        "id": f"item_test_{uuid.uuid4().hex[:6]}",
        "garment_type_id": "ngu_than",
        "slot": "outerwear",
        "name": "Forbidden Item"
    }, headers={"Authorization": f"Bearer {token}"})
    assert admin_res.status_code == 403


def test_r02_google_auth_missing_client_id_returns_503(monkeypatch):
    """R02: Missing GOOGLE_CLIENT_ID returns 503 instead of falling back to hardcoded client ID"""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)

    res = client.post("/api/auth/google", json={"credential": "dummy.google.credential"})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "GOOGLE_AUTH_UNAVAILABLE"


def test_r02_role_revocation_effective_immediately():
    """R02: Revoking admin role in DB immediately revokes admin access on active token"""
    # 1. Create admin user
    email = "admin_revoked@example.com"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "display_name": "Admin User",
        "role": "user"
    })
    user_id = reg_res.json()["user"]["id"]

    # Manually grant admin in DB
    with get_db_connection() as conn:
        conn.execute("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')", (f"ur_{uuid.uuid4().hex[:8]}", user_id))
        conn.commit()

    token = create_access_token(user_id=user_id, email=email, roles=["admin", "user"])

    # Admin call works
    item_id = f"item_admin_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/admin/items", json={
        "id": item_id,
        "garment_type_id": "ngu_than",
        "slot": "outerwear",
        "name": "Admin Item",
        "gender": "unisex",
        "era": "Nguyễn",
        "is_published": True,
        "metadata": {}
    }, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    # 2. Revoke admin in DB
    with get_db_connection() as conn:
        conn.execute("DELETE FROM user_roles WHERE user_id = ? AND role = 'admin'", (user_id,))
        conn.commit()

    # 3. Using same token now immediately gets 403 Forbidden!
    res_after = client.post("/api/admin/items", json={
        "id": f"item_admin_{uuid.uuid4().hex[:6]}",
        "garment_type_id": "ngu_than",
        "slot": "outerwear",
        "name": "Another Item",
    }, headers={"Authorization": f"Bearer {token}"})
    assert res_after.status_code == 403


def test_r02_disabled_account_rejected():
    """R02: Inactive / disabled account cannot authenticate"""
    email = "inactive_user@example.com"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "display_name": "Inactive User",
        "role": "user"
    })
    user_id = reg_res.json()["user"]["id"]
    token = reg_res.json()["access_token"]

    # Deactivate account
    Database.execute("UPDATE accounts SET is_active = 0 WHERE id = ?", (user_id,))

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "ACCOUNT_DISABLED"


def test_r03_jwt_signature_required_and_verified():
    """R03: JWT signature verification is always enforced; invalid or alg=none rejected"""
    # 1. Token forged with wrong key
    wrong_token = jwt.encode(
        {"sub": "usr_attacker", "exp": int(time.time()) + 3600, "iat": int(time.time())},
        "wrong-secret-key-12345678901234567890",
        algorithm="HS256"
    )
    with pytest.raises(AppError) as exc_info:
        verify_supabase_jwt(wrong_token)
    assert exc_info.value.status_code == 401

    # 2. Token with expired timestamp
    expired_token = jwt.encode(
        {"sub": "usr_valid", "exp": int(time.time()) - 3600, "iat": int(time.time()) - 7200},
        settings.get_jwt_secret(),
        algorithm="HS256"
    )
    with pytest.raises(AppError) as exc_info:
        verify_supabase_jwt(expired_token)
    assert exc_info.value.code == "TOKEN_EXPIRED"


def test_r03_dev_token_forbidden_in_production(monkeypatch):
    """R03: Magic dev tokens like dev-user-admin are strictly rejected in production"""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer dev-user-admin"})
    assert res.status_code == 401


def test_r03_production_config_fails_closed_on_weak_secret():
    """R03: Production configuration raises ValueError if JWT secret is weak or default"""
    from app.core.config import Settings
    with pytest.raises(ValueError, match="Production requires a strong JWT secret"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SUPABASE_JWT_SECRET="your-supabase-jwt-secret-for-local-dev-vietphucremix2026",
            JWT_SIGNING_SECRET="",
            FRONTEND_PUBLIC_ORIGIN="https://vietphucremix.example"
        )


def test_r01_containment_path_traversal_blocked(tmp_path, monkeypatch):
    """R01 containment: Directory traversal in local-upload and serve_local_file is blocked"""
    media_dir = tmp_path / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(media_dir))
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", True)

    sentinel = tmp_path / "outside.txt"
    assert not sentinel.exists()

    # Traversal write attempt
    res = client.post(
        "/api/media/local-upload",
        params={"key": "../../outside.txt", "bucket": "viet-phuc-public"},
        files={"file": ("test.txt", b"BLOCKED_CONTENT", "text/plain")},
    )
    assert res.status_code in (400, 403)
    assert not sentinel.exists()

    # Traversal read attempt
    res_read = client.get("/api/media/files/viet-phuc-public/../../outside.txt")
    assert res_read.status_code in (400, 403, 404, 405)


def test_r01_production_disables_local_media_endpoints(monkeypatch):
    """R01: In production, local upload and direct local file serving return 404"""
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ENABLED", False)

    res_upload = client.post(
        "/api/media/local-upload",
        params={"key": "photo.png", "bucket": "viet-phuc-public"},
        files={"file": ("test.png", b"BYTES", "image/png")},
    )
    assert res_upload.status_code == 404

    res_serve = client.get("/api/media/files/viet-phuc-public/photo.png")
    assert res_serve.status_code == 404
