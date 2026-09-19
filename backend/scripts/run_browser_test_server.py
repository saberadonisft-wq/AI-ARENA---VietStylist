"""Run the real API on 4100 using disposable data and no live credentials."""
import os
from pathlib import Path
import secrets
import sys
import tempfile


def main():
    with tempfile.TemporaryDirectory(prefix="vietstylist-browser-") as directory:
        os.environ.update({
            "VIETSTYLIST_IGNORE_DOTENV": "1", "ENVIRONMENT": "test", "DEBUG": "false",
            "DATABASE_URL": "sqlite:///" + str(Path(directory) / "browser.db"),
            "LOCAL_MEDIA_DIR": str(Path(directory) / "media"), "LOCAL_MEDIA_ENABLED": "true",
            "JWT_SIGNING_SECRET": secrets.token_urlsafe(48), "AUTH_MODE": "local",
            "JWT_ISSUER": "viet-phuc-remix", "JWT_AUDIENCE": "viet-phuc-remix-api",
            "R2_ACCOUNT_ID": "", "R2_ACCESS_KEY_ID": "", "R2_SECRET_ACCESS_KEY": "",
            "R2_BUCKET_PUBLIC": "test-public", "R2_BUCKET_PRIVATE": "test-private",
            "GEMINI_API_KEY": "", "GEMINI_TRY_ON_ENABLED": "false", "GOOGLE_CLIENT_ID": "",
            "SUPABASE_SERVICE_ROLE_KEY": "", "SUPABASE_ANON_KEY": "",
            "API_PUBLIC_ORIGIN": "http://127.0.0.1:4100", "FRONTEND_PUBLIC_ORIGIN": "http://127.0.0.1:3100",
            "CORS_ORIGINS": '["http://127.0.0.1:3100"]',
        })
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        import uvicorn
        uvicorn.run("app.main:app", host="127.0.0.1", port=4100, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
