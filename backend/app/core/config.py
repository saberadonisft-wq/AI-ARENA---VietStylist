from typing import List, Optional, Union, Literal
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    PROJECT_NAME: str = "Việt phục Remix API"
    ENVIRONMENT: Literal["development", "test", "staging", "production"] = "development"
    DEBUG: Union[bool, str] = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            if v.lower() in ("true", "1", "yes", "debug", "dev", "development"):
                return True
            if v.lower() in ("false", "0", "no", "release", "prod", "production"):
                return False
            return True
        return bool(v)

    HOST: str = "0.0.0.0"
    PORT: int = 4000

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database
    DATABASE_URL: str = "sqlite:///./viet_phuc_remix.db"
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = (
        "your-supabase-jwt-secret-for-local-dev-vietphucremix2026"
    )
    JWT_SIGNING_SECRET: str = ""
    JWT_ISSUER: str = "viet-phuc-remix"
    JWT_AUDIENCE: str = "viet-phuc-remix-api"
    AUTH_MODE: Literal["local"] = "local"
    GOOGLE_CLIENT_ID: str = ""

    # Frontend / Public URLs
    FRONTEND_PUBLIC_ORIGIN: str = "http://localhost:3000"
    API_PUBLIC_ORIGIN: str = "http://localhost:4000"

    # Cloudflare R2 / Storage
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_PUBLIC: str = "viet-phuc-public"
    R2_BUCKET_PRIVATE: str = "viet-phuc-private"
    R2_PUBLIC_DOMAIN: str = ""
    LOCAL_MEDIA_DIR: str = "./media_storage"
    LOCAL_MEDIA_ENABLED: Optional[bool] = None

    MEDIA_IMAGE_MAX_BYTES: int = 10 * 1024 * 1024
    MEDIA_VIDEO_MAX_BYTES: int = 50 * 1024 * 1024
    MEDIA_MAX_PIXELS: int = 40_000_000
    MEDIA_UPLOAD_TTL: int = 900
    MEDIA_OPERATION_LEASE: int = 600
    FFPROBE_PATH: str = "ffprobe"

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_TEXT: str = "gemini-2.5-flash"
    GEMINI_MODEL_IMAGE: str = "gemini-2.5-flash-image"
    GEMINI_TRY_ON_ENABLED: bool = False

    # Worker
    WORKER_CONCURRENCY: int = 2
    WORKER_POLL_INTERVAL_SECONDS: int = 3

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("sqlite:///"):
            raise ValueError("Only sqlite:/// is supported for M1.")
        return v

    def get_jwt_secret(self) -> str:
        secret = self.JWT_SIGNING_SECRET or self.SUPABASE_JWT_SECRET
        return secret

    def is_local_media_enabled(self) -> bool:
        if self.ENVIRONMENT not in ("development", "test"):
            return False
        if self.LOCAL_MEDIA_ENABLED is not None:
            return self.LOCAL_MEDIA_ENABLED
        return self.ENVIRONMENT != "production"

    @model_validator(mode="after")
    def validate_production_settings(self):
        if not self.JWT_ISSUER or not self.JWT_AUDIENCE:
            raise ValueError("JWT issuer and audience are required")
        from urllib.parse import urlsplit

        for value in (self.FRONTEND_PUBLIC_ORIGIN, self.API_PUBLIC_ORIGIN):
            origin = urlsplit(value)
            if (
                origin.scheme not in ("http", "https")
                or not origin.hostname
                or origin.username
                or origin.password
                or origin.query
                or origin.fragment
                or origin.path not in ("", "/")
            ):
                raise ValueError(
                    "Public origins must be absolute HTTP(S) origins without credentials, path or query"
                )
        if self.R2_BUCKET_PUBLIC == self.R2_BUCKET_PRIVATE:
            raise ValueError("Public and private storage buckets must be different")
        if self.ENVIRONMENT == "production":
            if self.DEBUG is True:
                raise ValueError("DEBUG must be False in production mode")
            secret = self.get_jwt_secret()
            if (
                not secret
                or secret == "your-supabase-jwt-secret-for-local-dev-vietphucremix2026"
                or len(secret) < 32
            ):
                raise ValueError(
                    "Production requires a strong JWT secret (at least 32 characters, non-default)"
                )
            if (
                not self.FRONTEND_PUBLIC_ORIGIN
                or not self.FRONTEND_PUBLIC_ORIGIN.startswith("https://")
                or not self.API_PUBLIC_ORIGIN.startswith("https://")
            ):
                raise ValueError("Public origins must use HTTPS in production")
            if self.R2_PUBLIC_DOMAIN and not self.R2_PUBLIC_DOMAIN.startswith(
                "https://"
            ):
                raise ValueError("R2 public domain must use HTTPS in production")
        return self


settings = (
    Settings(_env_file=None)
    if os.environ.get("VIETSTYLIST_IGNORE_DOTENV") == "1"
    else Settings()
)
