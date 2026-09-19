"""Dual-run validator comparing legacy V1 cultural rules with V3 data-driven rule engine.

Ensures zero regressions during phased transition and full audit parity.
"""
from __future__ import annotations

from typing import Any, Dict, List
from app.modules.cultural_rules.schemas import CulturalCheckRequest, CulturalCheckResponse
from app.modules.cultural_rules.service import CulturalRuleService
from app.modules.cultural_data_v3.services.rule_engine import evaluate_condition


# V3 Data-Driven Cultural Rule Declarations (JSON AST format)
V3_CULTURAL_RULES = [
    {
        "code": "RULE_VAT_AO_RIGHT",
        "name": "Quy tắc Hữu nhậm (Vạt áo khép bên phải)",
        "severity": "strict",
        "condition": {
            "field": "outfit.overlap_direction",
            "operator": "eq",
            "value": "left_over_right",
        },
        "explanation": "Cổ phục Việt Nam tuân theo quy tắc Hữu nhậm (vạt áo trái đè lên vạt phải hoặc cài khuy sang nách phải). Khép vạt ngược lại là tập tục Tả nhậm, chỉ dùng cho người đã khuất.",
        "suggested_fix": "Đổi hướng vạt áo sang phải đè trái (right_over_left)",
    },
    {
        "code": "RULE_AO_TAC_LE_NGHI",
        "name": "Lễ nghi áo tấc kèm khăn vấn",
        "severity": "warning",
        "condition": {
            "operator": "all",
            "conditions": [
                {"field": "outerwear.garment_type_id", "operator": "eq", "value": "ao_tac"},
                {"field": "slots.headwear", "operator": "missing"},
            ],
        },
        "explanation": "Áo tấc là lễ phục cung đình và cưới hỏi trang trọng bậc nhất. Theo điển lệ, bắt buộc phải đội khăn vấn (khăn đóng) đi kèm để đảm bảo trang nghiêm.",
        "suggested_fix": "Trang bị thêm Khăn vấn vào vị trí đầu",
    },
    {
        "code": "RULE_COLOR_CONTRAST",
        "name": "Quy chuẩn Bạch y lót trong áo ngũ thân",
        "severity": "info",
        "condition": {
            "operator": "all",
            "conditions": [
                {"field": "outerwear.garment_type_id", "operator": "eq", "value": "ngu_than"},
                {"field": "slots.undergarment", "operator": "missing"},
            ],
        },
        "explanation": "Áo ngũ thân truyền thống thường mặc cùng một lớp áo lót trắng bên trong (Bạch y) nhằm để lộ cổ lót trắng cao hơn 1-2mm so với cổ áo ngoài.",
        "suggested_fix": "Thêm áo lót trắng cổ đứng để hoàn thiện trang phục ngũ thân",
    },
]


class DualRunEvaluator:
    """Evaluates outfits under both V1 and V3 rules to ensure complete parity."""

    @staticmethod
    def evaluate(req: CulturalCheckRequest) -> Dict[str, Any]:
        # 1. Run Legacy V1 Evaluation
        v1_result = CulturalRuleService.evaluate_outfit(req)

        # 2. Build context for V3 Data-Driven Rule Engine
        equipped_slots = {it.slot: it.item_id for it in req.items}
        outerwear_id = equipped_slots.get("outerwear")

        # Determine garment_type_id
        garment_type_id = None
        if outerwear_id:
            if "ao_tac" in outerwear_id:
                garment_type_id = "ao_tac"
            elif "ngu_than" in outerwear_id:
                garment_type_id = "ngu_than"

        ctx: Dict[str, Any] = {
            "outfit": {
                "overlap_direction": req.overlap_direction,
                "style_mode": req.style_mode,
            },
            "slots": equipped_slots,
            "outerwear": {
                "item_id": outerwear_id,
                "garment_type_id": garment_type_id,
            },
        }

        # 3. Run V3 Engine
        v3_violations: List[Dict[str, Any]] = []
        for r in V3_CULTURAL_RULES:
            is_violation = evaluate_condition(r["condition"], ctx)
            if is_violation:
                v3_violations.append({
                    "code": r["code"],
                    "name": r["name"],
                    "severity": r["severity"],
                    "explanation": r["explanation"],
                    "suggested_fix": r["suggested_fix"],
                })

        # 4. Check Parity
        v1_codes = {w.code for w in v1_result.warnings}
        v3_codes = {v["code"] for v in v3_violations}
        has_parity = (v1_codes == v3_codes)

        return {
            "has_parity": has_parity,
            "v1_codes": sorted(v1_codes),
            "v3_codes": sorted(v3_codes),
            "v1_result": v1_result.model_dump(),
            "v3_violations": v3_violations,
        }

