"""Tests for V3 Dual-Run Cultural Rule Engine parity with V1."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from conftest import auth_header
from app.modules.cultural_rules.schemas import CulturalCheckRequest, OutfitItemInput
from app.modules.cultural_data_v3.services.dual_run import DualRunEvaluator

client = TestClient(app)


def test_dual_run_vat_ao_right_violation():
    """Verify both V1 and V3 engines detect left_over_right violation with parity."""
    req = CulturalCheckRequest(
        overlap_direction="left_over_right",
        style_mode="traditional",
        items=[
            OutfitItemInput(slot="outerwear", item_id="item_ngu_than_nam_xanh"),
            OutfitItemInput(slot="undergarment", item_id="item_ao_lot_trang"),
            OutfitItemInput(slot="headwear", item_id="item_khan_van_den"),
        ],
    )
    result = DualRunEvaluator.evaluate(req)

    assert result["has_parity"] is True
    assert "RULE_VAT_AO_RIGHT" in result["v1_codes"]
    assert "RULE_VAT_AO_RIGHT" in result["v3_codes"]


def test_dual_run_ao_tac_missing_headwear():
    """Verify both V1 and V3 detect missing headwear for ceremonial áo tấc."""
    req = CulturalCheckRequest(
        overlap_direction="right_over_left",
        style_mode="traditional",
        items=[
            OutfitItemInput(slot="outerwear", item_id="item_ao_tac_do"),
            OutfitItemInput(slot="undergarment", item_id="item_ao_lot_trang"),
        ],
    )
    result = DualRunEvaluator.evaluate(req)

    assert result["has_parity"] is True
    assert "RULE_AO_TAC_LE_NGHI" in result["v1_codes"]
    assert "RULE_AO_TAC_LE_NGHI" in result["v3_codes"]


def test_dual_run_ngu_than_missing_undergarment():
    """Verify both V1 and V3 recommend white inner collar for áo ngũ thân."""
    req = CulturalCheckRequest(
        overlap_direction="right_over_left",
        style_mode="traditional",
        items=[
            OutfitItemInput(slot="outerwear", item_id="item_ngu_than_nam_xanh"),
            OutfitItemInput(slot="headwear", item_id="item_khan_van_den"),
        ],
    )
    result = DualRunEvaluator.evaluate(req)

    assert result["has_parity"] is True
    assert "RULE_COLOR_CONTRAST" in result["v1_codes"]
    assert "RULE_COLOR_CONTRAST" in result["v3_codes"]


def test_dual_run_clean_outfit_parity():
    """Verify culturally sound outfit passes both engines with zero violations."""
    req = CulturalCheckRequest(
        overlap_direction="right_over_left",
        style_mode="traditional",
        items=[
            OutfitItemInput(slot="outerwear", item_id="item_ngu_than_nam_xanh"),
            OutfitItemInput(slot="undergarment", item_id="item_ao_lot_trang"),
            OutfitItemInput(slot="headwear", item_id="item_khan_van_den"),
        ],
    )
    result = DualRunEvaluator.evaluate(req)

    assert result["has_parity"] is True
    assert result["v1_codes"] == []
    assert result["v3_codes"] == []


def test_dual_run_api_endpoint():
    """Verify POST /api/v3/cultural-check/dual-run returns audit parity."""
    response = client.post("/api/v3/cultural-check/dual-run", headers={"Authorization": auth_header("dev-user-admin")}, json={
        "overlap_direction": "left_over_right",
        "style_mode": "traditional",
        "items": [
            {"slot": "outerwear", "item_id": "item_ngu_than_nam_xanh"},
        ],
    })
    assert response.status_code == 200
    data = response.json()
    assert data["has_parity"] is True
    assert "RULE_VAT_AO_RIGHT" in data["v3_codes"]
