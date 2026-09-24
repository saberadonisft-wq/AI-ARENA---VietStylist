import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from app.core.cors import CORSEnabledFastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import init_database, get_db_connection, verify_schema
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
from app.modules.media.router import router as media_router, local_router
from app.modules.try_on.router import router as try_on_router
from app.modules.solution_forms.router import router as solution_forms_router
from app.modules.admin.router import router as admin_router
from app.modules.auth.router import router as auth_router
from app.modules.auth.service import AuthService
from app.modules.cultural_data_v3.router import router as cultural_v3_router
from app.modules.stylist.router import router as stylist_router


from app.core.http_client import close_shared_async_client
from fastapi.responses import JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo database và dữ liệu di sản mẫu khi startup
    if settings.is_postgres():
        from starlette.concurrency import run_in_threadpool
        await run_in_threadpool(init_database, False)
    elif settings.ENVIRONMENT == "test":
        init_database()
    else:
        raise RuntimeError("SQLite is for tests only. Configure SUPABASE_DATABASE_URL and run migrations.")
    try:
        yield
    finally:
        from app.modules.cultural_data_v3.services.generation_jobs import shutdown
        await shutdown()
        await close_shared_async_client()
        from starlette.concurrency import run_in_threadpool
        from app.infrastructure.r2.client import r2_client

        await run_in_threadpool(r2_client.close)
        from app.core.postgres import close_pool
        await run_in_threadpool(close_pool)


from app.core.errors import ErrorEnvelope

from typing import Literal
from pydantic import BaseModel


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: dict[str,str]
    environment: str


def create_app():
    app = CORSEnabledFastAPI(
        title=settings.PROJECT_NAME,
        description="Backend REST API phục vụ nền tảng phối đồ Việt phục Remix (VietStylist)",
        version="1.0.0",
        lifespan=lifespan,
        responses={
            code: {"model": ErrorEnvelope, **({"description": {413: "Request Entity Too Large", 422: "Unprocessable Entity"}[code]} if code in (413, 422) else {})}
            for code in (400, 401, 403, 404, 409, 410, 413, 422, 429, 500, 503)
        },
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Middleware gắn Request ID và tính toán thời gian xử lý
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next):
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = request_id
        if not settings.is_local_media_enabled() and (
            request.url.path.startswith("/api/media/local-upload")
            or request.url.path.startswith("/api/media/files/")
        ):
            from app.core.errors import create_error_response

            return create_error_response(
                "ENDPOINT_NOT_FOUND", "Endpoint local không khả dụng", 404, request_id
            )

        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}s"
        return response

    # CORS wraps the entire stack in CORSEnabledFastAPI, including 500 errors.
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    from app.core.body_limit import LocalUploadBodyLimit

    app.add_middleware(LocalUploadBodyLimit)

    # Exception Handlers chuẩn hóa phản hồi lỗi thống nhất (O04)
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        request_id = getattr(
            request.state, "request_id", f"req_{uuid.uuid4().hex[:12]}"
        )
        logging.getLogger(__name__).error(
            "Unhandled request error request_id=%s type=%s",
            request_id,
            type(exc).__name__,
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "Đã xảy ra lỗi hệ thống không mong muốn. Vui lòng liên hệ quản trị viên.",
                    "status_code": 500,
                    "request_id": request_id,
                    "details": {},
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
    @app.get("/ready", tags=["System"], response_model=ReadinessResponse, responses={503: {"model": ReadinessResponse}})
    def ready_check():
        """Kiểm tra tính sẵn sàng (readiness probe) của database và storage (O07)."""
        checks = {}
        is_ready = True

        try:
            from app.core.database import Database

            with get_db_connection() as conn:
                schema_ok = verify_schema(conn)
            checks["database"] = "ok" if schema_ok else "migration_required"
            is_ready = schema_ok
        except Exception as e:
            checks["database"] = "unavailable"
            is_ready = False

        from app.infrastructure.r2.client import r2_client

        try:
            storage_ready = r2_client.check_ready()
            checks["media_storage"] = (
                ("r2" if r2_client.is_configured else "local")
                if storage_ready
                else "unavailable"
            )
            is_ready = is_ready and storage_ready
        except Exception:
            checks["media_storage"] = "unavailable"
            is_ready = False

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
    if settings.is_local_media_enabled():
        app.include_router(local_router, prefix=api_prefix)
    app.include_router(try_on_router, prefix=api_prefix)
    app.include_router(solution_forms_router, prefix=api_prefix)
    app.include_router(admin_router, prefix=api_prefix)
    app.include_router(stylist_router, prefix=api_prefix)
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(cultural_v3_router, prefix=api_prefix)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG
    )
