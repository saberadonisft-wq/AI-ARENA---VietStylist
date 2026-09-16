from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json


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
    GOOGLE_CLIENT_ID: str = ""

    # Cloudflare R2
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_PUBLIC: str = "viet-phuc-public"
    R2_BUCKET_PRIVATE: str = "viet-phuc-private"
    R2_PUBLIC_DOMAIN: str = "http://localhost:4000/media/public"
    LOCAL_MEDIA_DIR: str = "./media_storage"

    # Gemini
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL_TEXT: str = "gemini-2.5-flash"
    GEMINI_MODEL_IMAGE: str = "gemini-2.5-flash-image"
    GEMINI_TRY_ON_ENABLED: bool = False

    # Worker
    WORKER_CONCURRENCY: int = 2
    WORKER_POLL_INTERVAL_SECONDS: int = 3


settings = Settings()
