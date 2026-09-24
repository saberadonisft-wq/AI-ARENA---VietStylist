import os
import uuid
import secrets
import hashlib
from app.core.database import INTEGRITY_ERRORS
from typing import List
from datetime import datetime, timezone
import httpx
import jwt
from fastapi import status

from app.core.database import Database, get_db_connection, db_transaction
from app.core.config import settings
from app.core.security import create_access_token
from app.core.errors import AppError
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    GoogleAuthRequest,
    UserResponse,
    AuthResponse,
)


class AuthService:
    @staticmethod
    def hash_password(password: str, salt: str) -> str:
        """Mã hóa mật khẩu an toàn chuẩn PBKDF2-HMAC-SHA256 (100,000 rounds)."""
        return hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000,
        ).hex()

    @staticmethod
    def verify_password(password: str, salt: str, expected_hash: str) -> bool:
        """Xác minh mật khẩu sử dụng compare_digest chống timing attacks."""
        computed_hash = AuthService.hash_password(password, salt)
        return secrets.compare_digest(computed_hash, expected_hash)

    @classmethod
    def get_user_roles(cls, user_id: str) -> List[str]:
        """Lấy danh sách các vai trò (roles) của người dùng từ cơ sở dữ liệu."""
        rows = Database.fetch_all(
            "SELECT role FROM user_roles WHERE user_id = ?",
            (user_id,),
        )
        roles = [r["role"] for r in rows if "role" in r]
        return roles if roles else ["user"]

    @classmethod
    def register(cls, req: RegisterRequest) -> AuthResponse:
        """Đăng ký tài khoản mới bằng Email và Mật khẩu."""
        email = req.email.strip().lower()
        display_name = req.display_name.strip()
        role = req.role

        # Kiểm tra xem email đã tồn tại chưa
        existing = Database.fetch_one(
            "SELECT id, auth_provider FROM accounts WHERE email = ?",
            (email,),
        )
        if existing:
            raise AppError(
                code="EMAIL_EXISTS",
                message="Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        account_id = f"usr_{uuid.uuid4().hex[:12]}"
        salt = secrets.token_hex(16)
        password_hash = cls.hash_password(req.password, salt)

        try:
            with db_transaction() as conn:
                conn.execute(
                    """INSERT INTO accounts (id, email, password_hash, salt, display_name, auth_provider, is_active)
                    VALUES (?, ?, ?, ?, ?, 'local', 1)""",
                    (account_id, email, password_hash, salt, display_name),
                )
                conn.execute(
                    "INSERT INTO profiles (id, user_id, display_name, preferences) VALUES (?, ?, ?, '{}')",
                    (f"prof_{uuid.uuid4().hex[:12]}", account_id, display_name),
                )
                conn.execute(
                    "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
                    (f"ur_{uuid.uuid4().hex[:12]}", account_id, role),
                )
        except INTEGRITY_ERRORS:
            if Database.fetch_one("SELECT id FROM accounts WHERE email = ?", (email,)):
                raise AppError(
                    code="EMAIL_EXISTS",
                    message="Email này đã được sử dụng.",
                    status_code=400,
                )
            raise

        roles = [role]
        token = create_access_token(user_id=account_id, email=email, roles=roles)

        user_resp = UserResponse(
            id=account_id,
            email=email,
            display_name=display_name,
            avatar_url=None,
            roles=roles,
            auth_provider="local",
            created_at=datetime.now(timezone.utc).isoformat(),
        )

        return AuthResponse(access_token=token, token_type="bearer", user=user_resp)

    @classmethod
    def login(cls, req: LoginRequest) -> AuthResponse:
        """Đăng nhập bằng Email/Tài khoản và Mật khẩu."""
        email_or_username = req.email.strip().lower()

        account = Database.fetch_one(
            "SELECT id, email, password_hash, salt, display_name, avatar_url, auth_provider, is_active FROM accounts WHERE email = ?",
            (email_or_username,),
        )

        if (
            not account
            or not account.get("is_active")
            or (
                settings.ENVIRONMENT != "development"
                and account["id"].startswith("usr_demo_")
            )
        ):
            raise AppError(
                code="INVALID_CREDENTIALS",
                message="Email hoặc mật khẩu không chính xác. Vui lòng thử lại.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if account.get("auth_provider") == "google" and not account.get(
            "password_hash"
        ):
            raise AppError(
                code="OAUTH_ACCOUNT",
                message="Tài khoản này được đăng ký bằng Google. Vui lòng bấm 'Tiếp tục với Google'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not account.get("password_hash") or not account.get("salt"):
            raise AppError(
                code="INVALID_CREDENTIALS",
                message="Email hoặc mật khẩu không chính xác. Vui lòng thử lại.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if not cls.verify_password(
            req.password, account["salt"], account["password_hash"]
        ):
            raise AppError(
                code="INVALID_CREDENTIALS",
                message="Email hoặc mật khẩu không chính xác. Vui lòng thử lại.",
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        account_id = account["id"]
        roles = cls.get_user_roles(account_id)
        token = create_access_token(
            user_id=account_id, email=account["email"], roles=roles
        )

        user_resp = UserResponse(
            id=account_id,
            email=account["email"],
            display_name=account["display_name"],
            avatar_url=account.get("avatar_url"),
            roles=roles,
            auth_provider=account.get("auth_provider", "local"),
        )

        return AuthResponse(access_token=token, token_type="bearer", user=user_resp)

    @classmethod
    async def google_auth(cls, req: GoogleAuthRequest) -> AuthResponse:
        """Đăng nhập hoặc Đăng ký tự động qua Google OAuth 2.0."""
        google_client_id = settings.GOOGLE_CLIENT_ID or os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            raise AppError(
                code="GOOGLE_AUTH_UNAVAILABLE",
                message="Đăng nhập Google chưa được cấu hình.",
                status_code=503,
            )
        try:
            header = jwt.get_unverified_header(req.credential)
            if header.get("alg") != "RS256" or not header.get("kid"):
                raise ValueError("Invalid signing key")
            from app.core.http_client import get_shared_async_client
            import anyio

            with anyio.fail_after(10):
                response = await get_shared_async_client(5.0).get(
                    "https://www.googleapis.com/oauth2/v3/certs"
                )
                response.raise_for_status()
            key = next(k for k in response.json()["keys"] if k["kid"] == header["kid"])
            decode_kwargs = {
                "algorithms": ["RS256"],
                "issuer": ["accounts.google.com", "https://accounts.google.com"],
                "options": {"require": ["exp", "iat", "sub", "aud", "iss", "email"]},
            }
            if google_client_id:
                decode_kwargs["audience"] = google_client_id
            else:
                decode_kwargs["options"]["verify_aud"] = False

            data = jwt.decode(
                req.credential, jwt.PyJWK.from_dict(key).key, **decode_kwargs
            )
            if (
                data.get("email_verified") is not True
                or not data.get("sub")
                or not data.get("email")
            ):
                raise ValueError("Unverified identity")
        except (httpx.HTTPError, TimeoutError):
            raise AppError(
                code="GOOGLE_AUTH_UNAVAILABLE",
                message="Không thể kết nối máy chủ Google để xác thực. Vui lòng thử lại.",
                status_code=503,
            )
        except (jwt.PyJWTError, ValueError, KeyError, TypeError, StopIteration) as err:
            raise AppError(
                code="GOOGLE_AUTH_FAILED",
                message=f"Thông tin xác thực Google không hợp lệ: {str(err)}",
                status_code=401,
            )

        from starlette.concurrency import run_in_threadpool

        return await run_in_threadpool(cls._complete_google_auth, data)

    @classmethod
    def _complete_google_auth(cls, data):
        from app.core.database import db_transaction

        with db_transaction() as conn:
            email = data["email"].strip().lower()
            google_sub = data["sub"]
            display_name = data.get("name") or email.split("@")[0]
            avatar_url = data.get("picture")

            # Kiểm tra tài khoản đã tồn tại theo provider_id hoặc email
            existing = Database.fetch_one(
                "SELECT * FROM accounts WHERE (auth_provider = 'google' AND provider_id = ?) OR email = ?",
                (google_sub, email),
                conn=conn,
            )

            if existing:
                if not existing["is_active"]:
                    raise AppError(
                        code="UNAUTHORIZED",
                        message="Tài khoản đã bị vô hiệu hóa.",
                        status_code=401,
                    )
                account_id = existing["id"]
                email = existing["email"]
                # Cập nhật thông tin bổ sung nếu có
                Database.execute(
                    """
                    UPDATE accounts
                    SET provider_id = COALESCE(provider_id, ?),
                        avatar_url = COALESCE(avatar_url, ?),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (google_sub, avatar_url, account_id),
                    conn=conn,
                )
                roles = [
                    r["role"]
                    for r in Database.fetch_all(
                        "SELECT role FROM user_roles WHERE user_id=?",
                        (account_id,),
                        conn=conn,
                    )
                ] or ["user"]
                display_name = existing["display_name"]
            else:
                # Tạo tài khoản mới từ Google
                account_id = f"usr_gg_{uuid.uuid4().hex[:10]}"
                Database.execute(
                    """
                    INSERT INTO accounts (id, email, display_name, avatar_url, auth_provider, provider_id, is_active)
                    VALUES (?, ?, ?, ?, 'google', ?, 1)
                    """,
                    (account_id, email, display_name, avatar_url, google_sub),
                    conn=conn,
                )

                # Tạo profile
                profile_id = f"prof_{uuid.uuid4().hex[:12]}"
                Database.execute(
                    """
                    INSERT INTO profiles (id, user_id, display_name, avatar_url, preferences)
                    VALUES (?, ?, ?, ?, '{}')
                    """,
                    (profile_id, account_id, display_name, avatar_url),
                    conn=conn,
                )

                # Gán vai trò mặc định: user
                role_id = f"ur_{uuid.uuid4().hex[:12]}"
                Database.execute(
                    "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'user')",
                    (role_id, account_id),
                    conn=conn,
                )
                roles = ["user"]

            token = create_access_token(user_id=account_id, email=email, roles=roles)

            user_resp = UserResponse(
                id=account_id,
                email=email,
                display_name=display_name,
                avatar_url=avatar_url,
                roles=roles,
                auth_provider="google",
            )

            return AuthResponse(access_token=token, token_type="bearer", user=user_resp)

    @classmethod
    def get_me(cls, user_id: str) -> UserResponse:
        """Lấy thông tin người dùng hiện tại từ token."""
        account = Database.fetch_one(
            "SELECT id, email, display_name, avatar_url, auth_provider, created_at, is_active FROM accounts WHERE id = ?",
            (user_id,),
        )

        if not account or not account["is_active"]:
            raise AppError(
                code="UNAUTHORIZED",
                message="Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.",
                status_code=401,
            )

        roles = cls.get_user_roles(user_id)

        return UserResponse(
            id=account["id"],
            email=account["email"],
            display_name=account["display_name"],
            avatar_url=account.get("avatar_url"),
            roles=roles,
            auth_provider=account.get("auth_provider", "local"),
            created_at=str(account.get("created_at")),
        )

    @classmethod
    def seed_default_accounts(cls):
        """Đã tắt tạo tài khoản demo để áp dụng bảo mật chặt chẽ môi trường thực tế."""
        pass
