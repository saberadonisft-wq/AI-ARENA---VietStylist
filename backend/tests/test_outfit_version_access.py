from fastapi.testclient import TestClient

from app.core.database import Database
from app.main import app
from conftest import auth_header


client = TestClient(app)
OWNER = "dev-user-test-1"
OTHER = "dev-user-123"


def headers(user=OWNER):
    return {"Authorization": auth_header(user)}


def saved_outfit():
    response = client.post("/api/outfits", headers=headers(), json={
        "title": "Phiên bản để đăng",
        "snapshot": {
            "items": [{"slot": "outerwear", "itemId": "historical-garment", "transform": {"dx": 12, "dy": -9, "scale": 1.2, "rotation": 5}}],
            "styleMode": "traditional",
            "aspectRatio": "1:1",
            "backgroundTheme": "dopaper",
            "backgroundFade": 18,
        },
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_owner_reads_original_snapshot_after_current_version_changes():
    original = saved_outfit()
    version_id = original["current_version_id"]
    changed = client.put("/api/outfits/" + original["id"], headers=headers(), json={
        "revision": original["revision"],
        "snapshot": {"items": [], "styleMode": "remix", "aspectRatio": "9:16", "backgroundTheme": "white"},
    })
    assert changed.status_code == 200, changed.text
    assert changed.json()["current_version_id"] != version_id

    response = client.get("/api/outfits/versions/" + version_id, headers=headers())
    assert response.status_code == 200, response.text
    restored = response.json()
    assert restored["id"] == version_id
    assert restored["outfit_id"] == original["id"]
    assert restored["version_number"] == 1
    assert restored["snapshot"] == original["current_snapshot"]
    assert restored["created_at"]
    assert client.get("/api/outfits/" + original["id"], headers=headers()).json() == changed.json()


def test_version_access_requires_owner_and_active_source():
    original = saved_outfit()
    endpoint = "/api/outfits/versions/" + original["current_version_id"]
    assert client.get(endpoint).status_code == 401
    foreign = client.get(endpoint, headers=headers(OTHER))
    missing = client.get("/api/outfits/versions/missing-version", headers=headers())
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json()["error"]["code"] == missing.json()["error"]["code"] == "OUTFIT_VERSION_NOT_FOUND"
    assert client.delete("/api/outfits/" + original["id"], headers=headers()).status_code == 200
    assert client.get(endpoint, headers=headers()).status_code == 404
    assert Database.fetch_one("SELECT id FROM outfit_versions WHERE id=?", (original["current_version_id"],))


def test_inactive_account_cannot_read_its_version():
    original = saved_outfit()
    Database.execute("UPDATE accounts SET is_active=0 WHERE id=?", (OWNER,))
    response = client.get("/api/outfits/versions/" + original["current_version_id"], headers=headers())
    assert response.status_code == 401
