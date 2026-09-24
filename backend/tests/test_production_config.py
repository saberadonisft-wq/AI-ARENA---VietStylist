import pytest

from app.core.config import Settings


def production_settings(**overrides):
    values = {
        "ENVIRONMENT": "production",
        "DEBUG": False,
        "SUPABASE_DATABASE_URL": "postgresql://user:password@db.example.invalid/postgres",
        "JWT_SIGNING_SECRET": "x" * 48,
        "FRONTEND_PUBLIC_ORIGIN": "https://app.example.invalid",
        "API_PUBLIC_ORIGIN": "https://api.example.invalid",
        "CORS_ORIGINS": ["https://app.example.invalid"],
        "R2_ACCOUNT_ID": "account",
        "R2_ACCESS_KEY_ID": "access",
        "R2_SECRET_ACCESS_KEY": "secret",
        "R2_PUBLIC_DOMAIN": "https://media.example.invalid",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_production_accepts_explicit_public_origins_and_r2():
    assert production_settings().ENVIRONMENT == "production"


@pytest.mark.parametrize("override", [
    {"FRONTEND_PUBLIC_ORIGIN": "https://localhost"},
    {"CORS_ORIGINS": ["http://localhost:3000"]},
    {"R2_ACCESS_KEY_ID": ""},
    {"R2_PUBLIC_DOMAIN": ""},
])
def test_production_rejects_local_or_incomplete_deployment(override):
    with pytest.raises(ValueError):
        production_settings(**override)
