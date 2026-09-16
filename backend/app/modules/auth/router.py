from fastapi import APIRouter, Depends
from app.core.security import require_current_user, AuthenticatedUser
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    GoogleAuthRequest,
    AuthResponse,
    UserResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication & Phân Quyền RBAC"],
)


@router.post("/register", response_model=AuthResponse, summary="Đăng ký tài khoản mới bằng Email/Mật khẩu")
async def register(req: RegisterRequest):
    return AuthService.register(req)


@router.post("/login", response_model=AuthResponse, summary="Đăng nhập bằng Email/Mật khẩu")
async def login(req: LoginRequest):
    return AuthService.login(req)


@router.post("/google", response_model=AuthResponse, summary="Đăng nhập hoặc đăng ký nhanh qua Google Auth")
async def google_auth(req: GoogleAuthRequest):
    return await AuthService.google_auth(req)


@router.get("/me", response_model=UserResponse, summary="Lấy thông tin tài khoản và vai trò của phiên đăng nhập hiện tại")
async def get_me(user: AuthenticatedUser = Depends(require_current_user)):
    return AuthService.get_me(user.user_id)

