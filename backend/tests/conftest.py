import os
import sys
import secrets
import tempfile
from pathlib import Path
import pytest

# Establish isolation BEFORE test modules import app/settings/singletons.
_collection_root = tempfile.TemporaryDirectory(prefix="vietstylist-tests-")
os.environ.update(
    {
        "VIETSTYLIST_IGNORE_DOTENV": "1",
        "ENVIRONMENT": "test",
        "DEBUG": "false",
        "DATABASE_URL": "sqlite:///"
        + str(Path(_collection_root.name) / "collection.db"),
        "LOCAL_MEDIA_DIR": str(Path(_collection_root.name) / "media"),
        "LOCAL_MEDIA_ENABLED": "true",
        "JWT_SIGNING_SECRET": secrets.token_urlsafe(48),
        "R2_ACCOUNT_ID": "",
        "R2_ACCESS_KEY_ID": "",
        "R2_SECRET_ACCESS_KEY": "",
        "R2_BUCKET_PUBLIC": "viet-phuc-public",
        "R2_BUCKET_PRIVATE": "viet-phuc-private",
        "GEMINI_API_KEY": "",
        "GOOGLE_CLIENT_ID": "",
        "API_PUBLIC_ORIGIN": "http://localhost:4000",
        "FRONTEND_PUBLIC_ORIGIN": "http://localhost:3000",
        "JWT_ISSUER": "viet-phuc-remix",
        "JWT_AUDIENCE": "viet-phuc-remix-api",
        "AUTH_MODE": "local",
        "R2_PUBLIC_DOMAIN": "https://media.example.invalid",
        "MEDIA_IMAGE_MAX_BYTES": "10485760",
        "MEDIA_VIDEO_MAX_BYTES": "52428800",
        "MEDIA_MAX_PIXELS": "40000000",
        "MEDIA_UPLOAD_TTL": "900",
        "MEDIA_OPERATION_LEASE": "600",
        "CORS_ORIGINS": '["http://localhost:3000"]',
        "FFPROBE_PATH": "ffprobe",
    }
)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def auth_header(user_id):
    from app.core.security import create_access_token

    return "Bearer " + create_access_token(user_id)


@pytest.fixture(autouse=True)
def isolated_runtime(tmp_path, monkeypatch):
    from app.core import database, http_client
    from app.core.config import settings
    from app.infrastructure.gemini.client import gemini_client
    import httpx
    import botocore.endpoint

    def deny_r2(*args, **kwargs):
        raise AssertionError("Unexpected outbound R2 request")

    monkeypatch.setattr(botocore.endpoint.Endpoint, "make_request", deny_r2)
    monkeypatch.setattr(database, "SQLITE_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setattr(gemini_client, "is_configured", False)
    monkeypatch.setattr(http_client, "_clients", {})

    def respond(request):
        if request.url.host == "api.open-meteo.com":
            return httpx.Response(
                200,
                json={
                    "current": {
                        "temperature_2m": 26,
                        "relative_humidity_2m": 70,
                        "weather_code": 1,
                    }
                },
            )
        raise AssertionError("Unexpected outbound request")

    async def no_network(self, request):
        return respond(request)

    def no_sync_network(self, request):
        raise AssertionError("Unexpected outbound request")

    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", no_network)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", no_sync_network)
    database.init_database()
    for user_id in (
        "dev-user-test-1",
        "dev-user-123",
        "dev-user-media-1",
        "dev-user-admin",
        "dev-user-form-1",
    ):
        database.Database.execute(
            "INSERT INTO accounts(id,email,display_name,is_active) VALUES(?,?,?,1)",
            (user_id, user_id + "@example.invalid", user_id),
        )
        database.Database.execute(
            "INSERT INTO user_roles(id,user_id,role) VALUES(?,?,?)",
            (user_id, user_id, "admin" if user_id == "dev-user-admin" else "user"),
        )
    yield


@pytest.fixture
def png_bytes():
    import io
    from PIL import Image

    output = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(output, format="PNG")
    return output.getvalue()
