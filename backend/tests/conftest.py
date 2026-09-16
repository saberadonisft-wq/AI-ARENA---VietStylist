import sys
import os
import pytest

# Đưa thư mục backend vào sys.path để pytest import app.* sạch sẽ
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


@pytest.fixture(autouse=True)
def isolated_runtime(tmp_path, monkeypatch):
    """Tests never mutate the developer's database/media or call paid services."""
    from app.core import database
    from app.core.config import settings
    from app.infrastructure.r2.client import r2_client
    from app.infrastructure.gemini.client import gemini_client
    import httpx

    monkeypatch.setattr(database, "SQLITE_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setattr(settings, "LOCAL_MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setattr(r2_client, "local_dir", str(tmp_path / "media"))
    monkeypatch.setattr(r2_client, "is_configured", False)
    monkeypatch.setattr(gemini_client, "is_configured", False)
    original_client = httpx.AsyncClient

    def respond(request):
        if request.url.host == "api.open-meteo.com":
            return httpx.Response(200, json={"current": {"temperature_2m": 26, "relative_humidity_2m": 70, "weather_code": 1}})
        raise AssertionError(f"Unexpected outbound request: {request.url.host}")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: original_client(**kwargs, transport=httpx.MockTransport(respond)))
    database.init_database()
    yield
