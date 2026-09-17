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

    @property
    def is_stylist(self) -> bool:
        return "stylist" in self.roles or self.is_admin


def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """
    Xác minh JWT từ ứng dụng/Supabase Auth với chữ ký bắt buộc, hạn dùng (exp), và claims hợp lệ.
    """
    secret = settings.get_jwt_secret()
    if not secret:
        raise AppError(code="SERVER_CONFIGURATION_ERROR", message="JWT secret chưa được cấu hình trên máy chủ.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        decode_kwargs = {
            "algorithms": ["HS256"],
            "options": {
                "verify_signature": True,
                "verify_exp": True,
                "require": ["sub", "exp", "iat"],
            },
            "leeway": 10,
        }
        if settings.JWT_AUDIENCE:
            decode_kwargs["audience"] = settings.JWT_AUDIENCE
        else:
            decode_kwargs["options"]["verify_aud"] = False

        if settings.JWT_ISSUER:
            decode_kwargs["issuer"] = settings.JWT_ISSUER
        else:
            decode_kwargs["options"]["verify_iss"] = False

        payload = jwt.decode(token, secret, **decode_kwargs)
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
    """Tạo JWT có chữ ký HS256 chuẩn bảo mật."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "email": email or f"{user_id}@example.com",
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "app_metadata": {"roles": roles or ["user"]},
        "iat": now,
        "exp": now + (expires_delta or 3600),
    }
    secret = settings.get_jwt_secret()
    if not secret:
        raise AppError(code="SERVER_CONFIGURATION_ERROR", message="JWT secret chưa được cấu hình.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return jwt.encode(payload, secret, algorithm="HS256")


from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    authorization: Optional[str] = Header(None),
) -> Optional[AuthenticatedUser]:
    """
    Dependency lấy user nếu có token hợp lệ.
    - Không gửi token: trả về None (Guest).
    - Có gửi token nhưng token sai/hết hạn: trả về lỗi 401, KHÔNG âm thầm hạ quyền xuống Guest.
    """
    token = credentials.credentials if credentials else parse_bearer_token(authorization)
    if not token:
        if authorization:
            raise AppError(code="INVALID_TOKEN", message="Header Authorization phải có định dạng 'Bearer <token>'", status_code=status.HTTP_401_UNAUTHORIZED)
        return None

    # Dev token chỉ chấp nhận ở môi trường development/test, tuyệt đối cấm ở production
    if token.startswith("dev-user-"):
        if settings.ENVIRONMENT == "production":
            raise AppError(code="INVALID_TOKEN", message="Dev tokens are disabled in production", status_code=status.HTTP_401_UNAUTHORIZED)
        user_id = token
        roles = ["admin"] if "admin" in user_id else ["user"]
        return AuthenticatedUser(user_id=user_id, email=f"{user_id}@example.com", roles=roles)

    payload = verify_supabase_jwt(token)
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise AppError(code="INVALID_TOKEN", message="Token thiếu định danh người dùng (sub)", status_code=status.HTTP_401_UNAUTHORIZED)

    from app.core.database import Database
    account = Database.fetch_one("SELECT is_active, email FROM accounts WHERE id = ?", (user_id,))
    if not account:
        raise AppError(code="USER_NOT_FOUND", message="Tài khoản không tồn tại trên hệ thống", status_code=status.HTTP_401_UNAUTHORIZED)
    if not account.get("is_active"):
        raise AppError(code="ACCOUNT_DISABLED", message="Tài khoản đã bị vô hiệu hóa", status_code=status.HTTP_401_UNAUTHORIZED)

    # Lấy vai trò mới nhất trực tiếp từ cơ sở dữ liệu để đảm bảo việc thu hồi quyền (revoke) có hiệu lực ngay
    role_rows = Database.fetch_all("SELECT role FROM user_roles WHERE user_id = ?", (user_id,))
    user_roles = [r["role"] for r in role_rows if "role" in r]
    if not user_roles:
        user_roles = ["user"]

    email = account.get("email") or payload.get("email")
    return AuthenticatedUser(user_id=user_id, email=email, roles=user_roles, claims=payload)


async def require_current_user(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)) -> AuthenticatedUser:
    """
    Dependency bắt buộc người dùng phải đăng nhập hợp lệ.
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
    Dependency kiểm tra vai trò người dùng (admin, editor, stylist).
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
