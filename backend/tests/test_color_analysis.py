import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_color_analysis_high_contrast():
    payload = {
        "colors": [
            {"slot": "outerwear", "hex_color": "#1A365D", "color_name": "Xanh Chàm"},
            {"slot": "bottom", "hex_color": "#FFFFFF", "color_name": "Trắng Tinh Khôi"},
        ]
    }
    res = client.post("/api/color-analysis", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["dominant_color"] == "#1A365D"
    assert data["contrast_ratio"] >= 4.5
    assert data["contrast_rating"] == "good"
    assert len(data["suggested_variants"]) > 0


def test_color_analysis_analogous():
    payload = {
        "colors": [
            {"slot": "outerwear", "hex_color": "#276749", "color_name": "Xanh Rêu"},
            {"slot": "headwear", "hex_color": "#2F855A", "color_name": "Xanh Lá Cổ"},
        ]
    }
    res = client.post("/api/color-analysis", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["palette_type"] in ("analogous", "monochromatic", "neutral_balance")
