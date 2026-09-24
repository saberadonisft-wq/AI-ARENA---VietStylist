from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str = Field(..., description="Email đăng ký của người dùng")
    password: str = Field(..., min_length=6, description="Mật khẩu (tối thiểu 6 ký tự)")
    display_name: str = Field(..., min_length=2, description="Tên hiển thị")
    role: Literal["user"] = "user"

    @field_validator("email", "display_name", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if value.count("@") != 1 or any(c.isspace() for c in value):
            raise ValueError("Email không hợp lệ")
        local, domain = value.split("@")
        if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
            raise ValueError("Email không hợp lệ")
        return value.lower()


class LoginRequest(BaseModel):
    email: str = Field(..., description="Email hoặc tên đăng nhập")
    password: str = Field(..., description="Mật khẩu đăng nhập")


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=1, description="Google OAuth ID Token JWT")


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    roles: List[str] = ["user"]
    auth_provider: str = "local"
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
