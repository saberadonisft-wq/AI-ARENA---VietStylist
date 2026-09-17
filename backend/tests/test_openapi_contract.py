import json
import os
from pathlib import Path
import pytest
from app.main import app


def test_openapi_no_drift(isolated_runtime):
    """R10: Verify runtime app.openapi() has zero drift compared to shared/openapi.json"""
    repo_root = Path(__file__).resolve().parent.parent.parent
    openapi_file = repo_root / "shared" / "openapi.json"

    assert openapi_file.exists(), f"OpenAPI contract file not found at {openapi_file}"

    with open(openapi_file, "r", encoding="utf-8") as f:
        committed_schema = json.load(f)

    runtime_schema = app.openapi()

    assert runtime_schema == committed_schema, (
        "OpenAPI schema drift detected! "
        "Run 'python backend/scripts/export_openapi.py' to synchronize shared/openapi.json."
    )


def test_openapi_security_schemes():
    """R10: OpenAPI schema must declare HTTPBearer security scheme"""
    schema = app.openapi()
    components = schema.get("components", {})
    security_schemes = components.get("securitySchemes", {})
    assert "HTTPBearer" in security_schemes or "BearerAuth" in security_schemes


def test_openapi_key_operations_present():
    """R10: OpenAPI schema must contain operations that were previously missing"""
    schema = app.openapi()
    paths = schema.get("paths", {})

    # Auth operations
    assert "/api/auth/register" in paths
    assert "post" in paths["api/auth/register"] if "/api/auth/register" not in paths else "post" in paths["/api/auth/register"]
    assert "/api/auth/login" in paths
    assert "/api/auth/me" in paths
    assert "/api/auth/google" in paths

    # Share revoke operation
    assert "/api/lookbooks/{lookbook_id}/shares" in paths
    assert "delete" in paths["/api/lookbooks/{lookbook_id}/shares"]

    # Public share resolution
    assert "/api/shares/{token}" in paths
    assert "get" in paths["/api/shares/{token}"]


def test_openapi_schemas_defined():
    """R10: Required request and response schemas must be present in components.schemas"""
    schema = app.openapi()
    schemas = schema.get("components", {}).get("schemas", {})

    expected_schemas = [
        "RegisterRequest",
        "LoginRequest",
        "AuthResponse",
        "UserResponse",
        "GoogleAuthRequest",
        "CreateStoryRequest",
    ]
    for s in expected_schemas:
        assert s in schemas, f"Missing schema '{s}' in components.schemas"

