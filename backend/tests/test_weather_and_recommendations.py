import pytest
from fastapi.testclient import TestClient
from app.main import app
from conftest import auth_header

client = TestClient(app)


def test_get_weather_hanoi():
    res = client.get("/api/weather?city=hanoi")
    assert res.status_code == 200
    data = res.json()
    assert data["location"]["name"] == "Hà Nội"
    assert "temperature_c" in data["weather"]
    assert "layer_advice" in data["recommendation"]
    assert "fabric_advice" in data["recommendation"]
    assert len(data["recommendation"]["suggested_accessories"]) > 0


def test_context_recommendations():
    payload = {
        "occasion_id": "ky_yeu",
        "city_key": "hue",
        "gender": "male",
        "style_mode": "traditional",
        "locked_items": [
            {"slot": "outerwear", "item_id": "item_ngu_than_nam_xanh"}
        ]
    }
    res = client.post("/api/recommendations/context", headers={"Authorization": auth_header("dev-user-test-1")}, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["outfits"]) > 0
    outfit = data["outfits"][0]
    slots = [it["slot"] for it in outfit["items"]]
    assert "outerwear" in slots
    outer_item = next(it for it in outfit["items"] if it["slot"] == "outerwear")
    # Món đã khóa phải được giữ nguyên
    assert outer_item["item_id"] == "item_ngu_than_nam_xanh"


def test_recommendations_require_login():
    context = client.post("/api/recommendations/context", json={"occasion_id": "ky_yeu"})
    ai = client.post("/api/recommendations/ai", json={"prompt": "Gợi ý một bộ cổ phục"})
    assert context.status_code == 401
    assert ai.status_code == 401


def test_ai_styling_recommendations():
    payload = {
        "prompt": "Gợi ý cho tôi một bộ cổ phục thanh lịch màu hồng cho bạn nữ chụp ảnh tốt nghiệp",
        "occasion_id": "ky_yeu",
        "gender": "female",
        "style_mode": "traditional",
        "locked_items": []
    }
    res = client.post("/api/recommendations/ai", headers={"Authorization": auth_header("dev-user-test-1")}, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["outfits"]) > 0
    assert data["outfits"][0]["title"] is not None
