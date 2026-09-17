import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import init_database
from app.core.errors import (
    AppError,
    app_error_handler,
    http_exception_handler,
    validation_exception_handler,
)

# Import Routers
from app.modules.catalog.router import router as catalog_router
from app.modules.heritage.router import router as heritage_router
from app.modules.cultural_rules.router import router as cultural_rules_router
from app.modules.color_analysis.router import router as color_analysis_router
from app.modules.weather.router import router as weather_router
from app.modules.recommendations.router import router as recommendations_router
from app.modules.outfits.router import router as outfits_router
from app.modules.lookbooks.router import router as lookbooks_router
from app.modules.shares.router import router as shares_router
from app.modules.media.router import router as media_router
from app.modules.try_on.router import router as try_on_router
from app.modules.solution_forms.router import router as solution_forms_router
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.auth.service import AuthService


from app.core.http_client import close_shared_async_client
from fastapi.responses import JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo database và dữ liệu di sản mẫu khi startup
    init_database()
    yield
    # Dọn dẹp tài nguyên khi shutdown (O02, O07)
    await close_shared_async_client()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend REST API phục vụ nền tảng phối đồ Việt phục Remix (VietStylist)",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Middleware gắn Request ID và tính toán thời gian xử lý
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or f"req_{uuid.uuid4().hex[:12]}"
    request.state.request_id = request_id

    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


# CORS Configuration
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Exception Handlers chuẩn hóa phản hồi lỗi thống nhất (O04)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Đã xảy ra lỗi hệ thống không mong muốn. Vui lòng liên hệ quản trị viên.",
                "status_code": 500,
                "request_id": request_id,
            }
        },
    )


# Health check endpoint (an toàn, không lộ thông tin nhạy cảm)
@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": "viet-phuc-remix-backend",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
    }


# Readiness probe endpoint (O07)
@app.get("/ready", tags=["System"])
async def ready_check():
    """Kiểm tra tính sẵn sàng (readiness probe) của database và storage (O07)."""
    checks = {}
    is_ready = True

    try:
        from app.core.database import Database
        Database.fetch_one("SELECT 1")
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
        is_ready = False

    if settings.is_local_media_enabled():
        checks["media_storage"] = "local"
    else:
        checks["media_storage"] = "r2" if settings.R2_ACCOUNT_ID else "not_configured"

    status_code = 200 if is_ready else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if is_ready else "not_ready",
            "checks": checks,
            "environment": settings.ENVIRONMENT,
        },
    )


# Đăng ký các APIRouter theo tiền tố /api
api_prefix = "/api"
app.include_router(catalog_router, prefix=api_prefix)
app.include_router(heritage_router, prefix=api_prefix)
app.include_router(cultural_rules_router, prefix=api_prefix)
app.include_router(color_analysis_router, prefix=api_prefix)
app.include_router(weather_router, prefix=api_prefix)
app.include_router(recommendations_router, prefix=api_prefix)
app.include_router(outfits_router, prefix=api_prefix)
app.include_router(lookbooks_router, prefix=api_prefix)
app.include_router(shares_router, prefix=api_prefix)
app.include_router(media_router, prefix=api_prefix)
app.include_router(try_on_router, prefix=api_prefix)
app.include_router(solution_forms_router, prefix=api_prefix)
app.include_router(admin_router, prefix=api_prefix)
app.include_router(auth_router, prefix=api_prefix)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
