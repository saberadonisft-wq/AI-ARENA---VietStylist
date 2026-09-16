import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_cultural_rules_huu_nham_strict_violation():
    # Khi người dùng chọn tả nhậm (left_over_right), rule Hữu nhậm phải báo STRICT
    payload = {
        "garment_type_id": "ngu_than",
        "occasion_id": "ky_yeu",
        "style_mode": "traditional",
        "overlap_direction": "left_over_right",
        "items": [
            {"slot": "outerwear", "item_id": "item_ngu_than_nam_xanh"},
            {"slot": "undergarment", "item_id": "item_ao_lot_trang"},
            {"slot": "bottom", "item_id": "item_quan_trang_lua"},
        ]
    }
    res = client.post("/api/cultural-check", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_culturally_sound"] is False
    assert data["strict_count"] >= 1
    rule_codes = [w["code"] for w in data["warnings"]]
    assert "RULE_VAT_AO_RIGHT" in rule_codes
    assert data["warnings"][0]["suggested_fix"] is not None


def test_cultural_rules_ao_tac_headwear_warning():
    # Áo tấc không đội khăn vấn trong phong cách truyền thống
    payload = {
        "garment_type_id": "ao_tac",
        "occasion_id": "cuoi_hoi",
        "style_mode": "traditional",
        "overlap_direction": "right_over_left",
        "items": [
            {"slot": "outerwear", "item_id": "item_ao_tac_do"},
            {"slot": "undergarment", "item_id": "item_ao_lot_trang"},
            {"slot": "bottom", "item_id": "item_quan_trang_lua"},
        ]
    }
    res = client.post("/api/cultural-check", json=payload)
    assert res.status_code == 200
    data = res.json()
    rule_codes = [w["code"] for w in data["warnings"]]
    assert "RULE_AO_TAC_LE_NGHI" in rule_codes


def test_cultural_rules_compliant_outfit():
    # Bộ phối chuẩn mực đầy đủ
    payload = {
        "garment_type_id": "ngu_than",
        "occasion_id": "ky_yeu",
        "style_mode": "traditional",
        "overlap_direction": "right_over_left",
        "items": [
            {"slot": "outerwear", "item_id": "item_ngu_than_nam_xanh"},
            {"slot": "undergarment", "item_id": "item_ao_lot_trang"},
            {"slot": "bottom", "item_id": "item_quan_trang_lua"},
            {"slot": "headwear", "item_id": "item_khan_van_den"},
            {"slot": "accessory_front", "item_id": "item_quat_xep_giay_do"},
        ]
    }
    res = client.post("/api/cultural-check", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["is_culturally_sound"] is True
    assert data["strict_count"] == 0
    assert len(data["warnings"]) == 0
