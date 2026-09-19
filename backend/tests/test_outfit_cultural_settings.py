from fastapi.testclient import TestClient
from app.main import app
from conftest import auth_header


def test_cultural_settings_survive_create_update_read_and_revision_conflict():
    client = TestClient(app)
    headers = {"Authorization": auth_header("dev-user-media-1")}
    settings = {"dataset_version": "ds_archived", "ruleset_version": "rules_archived", "context": {
        "period_ids": ["period_nguyen"], "region_ids": ["region_hue"], "place_ids": [],
        "community_ids": [], "occasion_ids": ["occasion_festival"], "social_context_ids": []}}
    created = client.post("/api/outfits", headers=headers, json={"snapshot": {"items": [], "culturalSettings": settings}})
    assert created.status_code == 200, created.text
    outfit = created.json()
    path = f"/api/outfits/{outfit['id']}"
    assert outfit["current_snapshot"]["culturalSettings"] == settings
    snapshot = outfit["current_snapshot"]
    snapshot["backgroundTheme"] = "dopaper"
    updated = client.put(path, headers=headers, json={"revision": outfit["revision"], "snapshot": snapshot})
    assert updated.status_code == 200, updated.text
    assert updated.json()["current_snapshot"]["culturalSettings"] == settings
    conflict = client.put(path, headers=headers, json={"revision": outfit["revision"], "snapshot": {"items": []}})
    assert conflict.status_code == 409
    assert client.get(path, headers=headers).json()["current_snapshot"]["culturalSettings"] == settings
    assert client.get(path).status_code == 401


def test_cultural_settings_validate_shape_but_allow_archived_references_for_preservation():
    client = TestClient(app)
    headers = {"Authorization": auth_header("dev-user-media-1")}
    for settings in [
        {"context": {"period_ids": ["invalid/id"]}},
        {"context": {"region_ids": [f"region_{i}" for i in range(33)]}},
        {"context": {"period_ids": "period_nguyen"}},
        {"context": {"arbitrary": True}},
        {"dataset_version": ""},
        {"unknown_setting": 1},
    ]:
        response = client.post("/api/outfits", headers=headers, json={"snapshot": {"items": [], "culturalSettings": settings}})
        assert response.status_code == 422, response.text
    legacy = client.post("/api/outfits", headers=headers, json={"snapshot": {"items": []}})
    assert legacy.status_code == 200
    assert legacy.json()["current_snapshot"]["culturalSettings"] is None
