import pytest
from fastapi.testclient import TestClient
from app.main import app
from conftest import auth_header

client = TestClient(app)


@pytest.mark.parametrize("neutral", ["white", "dopaper"])
def test_occasion_background_survives_create_update_and_read(neutral):
    headers = {"Authorization": auth_header("dev-user-test-1")}
    item = {"slot": "outerwear", "itemId": "item_ao_tac_do",
            "transform": {"dx": 25, "dy": -12, "scale": 1.2, "rotation": 15}}
    snapshot = {"items": [item], "lockedSlots": ["outerwear"], "occasionId": "tet",
                "backgroundTheme": "occasion", "neutralBackgroundTheme": neutral, "backgroundFade": 45}
    response = client.post("/api/outfits", headers=headers, json={"snapshot": snapshot})
    assert response.status_code == 200, response.text
    outfit_id = response.json()["id"]
    for theme, revision in [("occasion", 1), (neutral, 2)]:
        if revision == 2:
            snapshot["backgroundTheme"] = neutral
            snapshot["occasionId"] = None
            response = client.put(f"/api/outfits/{outfit_id}", headers=headers,
                                  json={"revision": 1, "snapshot": snapshot})
            assert response.status_code == 200, response.text
        saved = client.get(f"/api/outfits/{outfit_id}", headers=headers).json()
        assert saved["revision"] == revision
        actual = saved["current_snapshot"]
        assert actual["backgroundTheme"] == theme
        assert actual["neutralBackgroundTheme"] == neutral
        assert actual["backgroundFade"] == 45
        assert actual["occasionId"] == snapshot["occasionId"]
        assert actual["lockedSlots"] == ["outerwear"]
        assert actual["items"][0]["transform"] == item["transform"]


@pytest.mark.parametrize("field,value", [("backgroundTheme", "https://invalid.example/image"),
                                         ("neutralBackgroundTheme", "occasion"),
                                         ("backgroundFade", -1), ("backgroundFade", 101)])
def test_invalid_background_values_are_rejected(field, value):
    response = client.post("/api/outfits", headers={"Authorization": auth_header("dev-user-test-1")},
                           json={"snapshot": {"items": [], field: value}})
    assert response.status_code == 422
