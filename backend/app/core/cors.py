"""Apply CORS outside ServerErrorMiddleware, including unhandled 500 responses."""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.core.config import settings


class CORSEnabledFastAPI(FastAPI):
    def build_middleware_stack(self):
        origins = settings.CORS_ORIGINS
        return CORSMiddleware(
            super().build_middleware_stack(),
            allow_origins=origins if isinstance(origins, list) else [origins],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-ID", "Retry-After"],
        )
