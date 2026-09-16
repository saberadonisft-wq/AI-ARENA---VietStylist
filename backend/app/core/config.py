from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "Việt phục Remix API"
    ENVIRONMENT: str = "development"
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
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

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
    SUPABASE_JWT_SECRET: str = "your-supabase-jwt-secret-for-local-dev-vietphucremix2026"
    JWT_SIGNING_SECRET: str = ""
    JWT_ISSUER: str = "viet-phuc-remix"
    JWT_AUDIENCE: str = "viet-phuc-remix-api"
    AUTH_MODE: str = "local"
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
    R2_PUBLIC_DOMAIN: str = "http://localhost:4000/media/public"
    LOCAL_MEDIA_DIR: str = "./media_storage"
    LOCAL_MEDIA_ENABLED: Optional[bool] = None

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
            raise ValueError(f"Unsupported database scheme: '{v}'. Only sqlite:/// is supported for M1.")
        return v

    def get_jwt_secret(self) -> str:
        secret = self.JWT_SIGNING_SECRET or self.SUPABASE_JWT_SECRET
        return secret

    def is_local_media_enabled(self) -> bool:
        if self.LOCAL_MEDIA_ENABLED is not None:
            return self.LOCAL_MEDIA_ENABLED
        return self.ENVIRONMENT != "production"

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.ENVIRONMENT == "production":
            if self.DEBUG is True:
                raise ValueError("DEBUG must be False in production mode")
            secret = self.get_jwt_secret()
            if not secret or secret == "your-supabase-jwt-secret-for-local-dev-vietphucremix2026" or len(secret) < 32:
                raise ValueError("Production requires a strong JWT secret (at least 32 characters, non-default)")
            if not self.FRONTEND_PUBLIC_ORIGIN or not self.FRONTEND_PUBLIC_ORIGIN.startswith("https://"):
                raise ValueError("FRONTEND_PUBLIC_ORIGIN must use HTTPS scheme in production")
        return self


settings = Settings()
