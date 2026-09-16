import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "viet-phuc-remix-backend"


def test_list_garment_types():
    response = client.get("/api/catalog/garment-types")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    ids = [gt["id"] for gt in data]
    assert "ngu_than" in ids
    assert "ao_tac" in ids
    assert "nhat_binh" in ids


def test_list_occasions():
    response = client.get("/api/catalog/occasions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 4
    ids = [o["id"] for o in data]
    assert "ky_yeu" in ids
    assert "tet" in ids


def test_list_items_and_filtering():
    # Lọc theo slot outerwear
    res = client.get("/api/catalog/items?slot=outerwear")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 0
    for it in data:
        assert it["slot"] == "outerwear"
        assert "variants" in it

    # Lọc theo garment_type_id
    res_gt = client.get("/api/catalog/items?garment_type_id=nhat_binh")
    assert res_gt.status_code == 200
    data_gt = res_gt.json()
    assert len(data_gt) > 0
    for it in data_gt:
        assert it["garment_type_id"] == "nhat_binh"


def test_get_item_detail():
    res = client.get("/api/catalog/items/item_ngu_than_nam_xanh")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "item_ngu_than_nam_xanh"
    assert len(data["variants"]) > 0
    assert len(data["asset_layers"]) > 0


def test_get_starter_outfits():
    res = client.get("/api/catalog/starter-outfits")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 3
    for outfit in data:
        assert len(outfit["items"]) >= 3
        slots = [it["slot"] for it in outfit["items"]]
        assert "outerwear" in slots
