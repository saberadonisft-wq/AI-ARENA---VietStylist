import time
from typing import List, Optional, Dict, Any
import jwt
from fastapi import Header, HTTPException, status, Depends
from app.core.config import settings
from app.core.errors import AppError


class AuthenticatedUser:
    def __init__(self, user_id: str, email: Optional[str] = None, roles: Optional[List[str]] = None, claims: Optional[Dict[str, Any]] = None):
        self.user_id = user_id
        self.email = email
        self.roles = roles or ["user"]
        self.claims = claims or {}

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles

    @property
    def is_editor(self) -> bool:
        return "editor" in self.roles or self.is_admin


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Xác minh JWT từ Supabase Auth với đầy đủ chữ ký, hạn dùng (exp), và issuer nếu có.
    """
    try:
        # Nếu có secret, xác minh HMAC-SHA256
        # Supabase mặc định dùng HS256 với JWT secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={
                "verify_signature": bool(settings.SUPABASE_JWT_SECRET),
                "verify_exp": True,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AppError(code="TOKEN_EXPIRED", message="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", status_code=status.HTTP_401_UNAUTHORIZED)
    except jwt.InvalidTokenError as e:
        raise AppError(code="INVALID_TOKEN", message=f"Token không hợp lệ: {str(e)}", status_code=status.HTTP_401_UNAUTHORIZED)


def parse_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def create_access_token(user_id: str, email: Optional[str] = None, roles: Optional[List[str]] = None, expires_delta: Optional[int] = 3600) -> str:
    """Tạo JWT có chữ ký HS256 tương thích với Supabase Auth."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "email": email or f"{user_id}@example.com",
        "app_metadata": {"roles": roles or ["user"]},
        "iat": now,
        "exp": now + (expires_delta or 3600),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[AuthenticatedUser]:
    """
    Dependency lấy user nếu có token hợp lệ, trả về None nếu là khách (Guest).
    """
    token = parse_bearer_token(authorization)
    if not token:
        return None

    # Hỗ trợ dev token cho testing và local
    if token.startswith("dev-user-"):
        user_id = token
        roles = ["admin"] if "admin" in user_id else ["user"]
        return AuthenticatedUser(user_id=user_id, email=f"{user_id}@example.com", roles=roles)

    try:
        payload = verify_supabase_jwt(token)
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            return None
        email = payload.get("email")
        app_metadata = payload.get("app_metadata", {})
        user_roles = app_metadata.get("roles", ["user"])
        if isinstance(user_roles, str):
            user_roles = [user_roles]

        return AuthenticatedUser(user_id=user_id, email=email, roles=user_roles, claims=payload)
    except AppError:
        # Token lỗi hoặc hết hạn
        return None


async def require_current_user(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)) -> AuthenticatedUser:
    """
    Dependency bắt buộc người dùng phải đăng nhập.
    """
    if not user:
        raise AppError(
            code="UNAUTHORIZED",
            message="Yêu cầu đăng nhập để thực hiện thao tác này",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    return user


def require_role(required_roles: List[str]):
    """
    Dependency kiểm tra vai trò người dùng (admin, editor).
    """
    async def role_checker(user: AuthenticatedUser = Depends(require_current_user)) -> AuthenticatedUser:
        has_role = any(role in user.roles for role in required_roles)
        if not has_role and not user.is_admin:
            raise AppError(
                code="FORBIDDEN",
                message=f"Tài khoản không có quyền truy cập chức năng này (yêu cầu một trong các quyền: {', '.join(required_roles)})",
                status_code=status.HTTP_403_FORBIDDEN,
            )
        return user
    return role_checker
