"""Read-only deployment connectivity check; never print secrets or URLs."""

import os
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

from app.core.config import settings  # noqa: E402
from app.core.database import get_db_connection, verify_schema  # noqa: E402
from app.core.postgres import close_pool  # noqa: E402
from app.infrastructure.r2.client import r2_client  # noqa: E402


def test_all() -> int:
    try:
        with get_db_connection() as connection:
            database = "ready" if verify_schema(connection) else "migration_required"
    except Exception:
        database = "unavailable"
    finally:
        if settings.is_postgres():
            close_pool()

    try:
        media_storage = (
            "r2_ready"
            if r2_client.is_configured and r2_client.check_ready()
            else "unavailable"
        )
    except Exception:
        media_storage = "unavailable"
    finally:
        r2_client.close()

    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Database: {database} ({'PostgreSQL' if settings.is_postgres() else 'SQLite test'})")
    print(f"Media storage: {media_storage}")
    print(f"Google OAuth configured: {bool(settings.GOOGLE_CLIENT_ID)}")
    print(
        "Gemini V3 image generation enabled: "
        f"{bool(settings.GEMINI_TRY_ON_ENABLED and settings.GEMINI_API_KEY)}"
    )
    return 0 if database == "ready" and media_storage == "r2_ready" else 1


if __name__ == "__main__":
    raise SystemExit(test_all())
