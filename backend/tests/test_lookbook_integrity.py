import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app


def register_user(client: TestClient, email: str, display_name: str = "User"):
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "display_name": display_name,
        "role": "user"
    })
    assert res.status_code == 200, res.text
    return res.json()["user"]["id"], res.json()["access_token"]


def test_r07_cannot_reference_foreign_outfit_version(isolated_runtime):
    """R07: User B cannot reference User A's outfit_version_id in lookbook create or update"""
    client = TestClient(app, raise_server_exceptions=False)
    user_a_id, token_a = register_user(client, "user_a_r07@example.com", "User A")
    user_b_id, token_b = register_user(client, "user_b_r07@example.com", "User B")

    # A creates an outfit
    res_a = client.post("/api/outfits", json={
        "title": "A Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200, res_a.text
    a_version_id = res_a.json()["current_version_id"]

    # B creates outfit of their own
    res_b = client.post("/api/outfits", json={
        "title": "B Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 200, res_b.text
    b_version_id = res_b.json()["current_version_id"]

    # B attempts to create lookbook containing A's version
    lb_res = client.post("/api/lookbooks", json={
        "title": "B stealing A version",
        "visibility": "public",
        "entries": [{"outfit_version_id": a_version_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert lb_res.status_code == 422
    assert lb_res.json()["error"]["code"] == "INVALID_OUTFIT_VERSION"

    # B creates valid lookbook with B's version
    lb_ok = client.post("/api/lookbooks", json={
        "title": "B valid lookbook",
        "visibility": "public",
        "entries": [{"outfit_version_id": b_version_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert lb_ok.status_code == 200, lb_ok.text
    b_lb_id = lb_ok.json()["id"]

    # B attempts to update lookbook by adding A's version
    update_fail = client.put(f"/api/lookbooks/{b_lb_id}", json={
        "entries": [
            {"outfit_version_id": b_version_id, "sort_order": 1},
            {"outfit_version_id": a_version_id, "sort_order": 2},
        ]
    }, headers={"Authorization": f"Bearer {token_b}"})
    assert update_fail.status_code == 422
    assert update_fail.json()["error"]["code"] == "INVALID_OUTFIT_VERSION"


def test_r07_cannot_reference_deleted_or_nonexistent_outfit_version(isolated_runtime):
    """R07: Cannot reference nonexistent or deleted outfit version"""
    client = TestClient(app, raise_server_exceptions=False)
    owner_id, token = register_user(client, "owner_r07@example.com", "Owner")

    # Nonexistent version
    res_fake = client.post("/api/lookbooks", json={
        "title": "Fake version lookbook",
        "entries": [{"outfit_version_id": "non-existent-uuid", "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    assert res_fake.status_code == 422
    assert res_fake.json()["error"]["code"] == "INVALID_OUTFIT_VERSION"

    # Create outfit then soft-delete it
    outfit_res = client.post("/api/outfits", json={
        "title": "Deleted Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token}"})
    assert outfit_res.status_code == 200, outfit_res.text
    outfit_id = outfit_res.json()["id"]
    version_id = outfit_res.json()["current_version_id"]

    del_res = client.delete(f"/api/outfits/{outfit_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 200

    # Try to reference deleted outfit's version
    res_deleted = client.post("/api/lookbooks", json={
        "title": "Deleted version lookbook",
        "entries": [{"outfit_version_id": version_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    assert res_deleted.status_code == 422
    assert res_deleted.json()["error"]["code"] == "INVALID_OUTFIT_VERSION"


def test_r08_atomic_update_preserves_entries_on_failure(isolated_runtime):
    """R08: Update failure does not wipe existing lookbook entries"""
    client = TestClient(app, raise_server_exceptions=False)
    owner_id, token = register_user(client, "owner_r08@example.com", "Owner")

    outfit_res = client.post("/api/outfits", json={
        "title": "Owner Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token}"})
    assert outfit_res.status_code == 200, outfit_res.text
    v_id = outfit_res.json()["current_version_id"]

    lb_res = client.post("/api/lookbooks", json={
        "title": "Original Title",
        "visibility": "public",
        "entries": [{"outfit_version_id": v_id, "sort_order": 1, "notes": "Initial Note"}]
    }, headers={"Authorization": f"Bearer {token}"})
    assert lb_res.status_code == 200, lb_res.text
    lb_id = lb_res.json()["id"]
    assert len(lb_res.json()["entries"]) == 1

    # Update with an invalid entry (non-existent version)
    update_res = client.put(f"/api/lookbooks/{lb_id}", json={
        "title": "New Title Attempt",
        "entries": [{"outfit_version_id": "invalid-version-uuid", "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    assert update_res.status_code == 422

    # Fetch lookbook: original title, visibility, and entries must be strictly preserved!
    fetch_res = client.get(f"/api/lookbooks/{lb_id}", headers={"Authorization": f"Bearer {token}"})
    assert fetch_res.status_code == 200
    data = fetch_res.json()
    assert data["title"] == "Original Title"
    assert len(data["entries"]) == 1
    assert data["entries"][0]["outfit_version_id"] == v_id
    assert data["entries"][0]["notes"] == "Initial Note"


def test_r08_update_entries_omitted_vs_cleared(isolated_runtime):
    """R08: Omitting entries preserves them; sending entries=[] clears them"""
    client = TestClient(app, raise_server_exceptions=False)
    owner_id, token = register_user(client, "owner_r08_2@example.com", "Owner")

    outfit_res = client.post("/api/outfits", json={
        "title": "Outfit",
        "snapshot": {"schemaVersion": 1, "avatarId": "av1", "items": []}
    }, headers={"Authorization": f"Bearer {token}"})
    assert outfit_res.status_code == 200, outfit_res.text
    v_id = outfit_res.json()["current_version_id"]

    lb_res = client.post("/api/lookbooks", json={
        "title": "My Lookbook",
        "entries": [{"outfit_version_id": v_id, "sort_order": 1}]
    }, headers={"Authorization": f"Bearer {token}"})
    assert lb_res.status_code == 200, lb_res.text
    lb_id = lb_res.json()["id"]

    # Update only title (entries is None/omitted)
    up_res = client.put(f"/api/lookbooks/{lb_id}", json={
        "title": "Renamed Lookbook"
    }, headers={"Authorization": f"Bearer {token}"})
    assert up_res.status_code == 200, up_res.text

    fetch_res = client.get(f"/api/lookbooks/{lb_id}", headers={"Authorization": f"Bearer {token}"})
    assert fetch_res.json()["title"] == "Renamed Lookbook"
    assert len(fetch_res.json()["entries"]) == 1

    # Update with entries=[] (explicitly clearing entries)
    up_clear = client.put(f"/api/lookbooks/{lb_id}", json={
        "entries": []
    }, headers={"Authorization": f"Bearer {token}"})
    assert up_clear.status_code == 200, up_clear.text

    fetch_res2 = client.get(f"/api/lookbooks/{lb_id}", headers={"Authorization": f"Bearer {token}"})
    assert len(fetch_res2.json()["entries"]) == 0

