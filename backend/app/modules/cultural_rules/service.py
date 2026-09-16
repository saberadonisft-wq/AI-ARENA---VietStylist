from typing import List, Dict, Any
from app.modules.cultural_rules.schemas import (
    CulturalCheckRequest,
    CulturalCheckResponse,
    CulturalRuleWarning,
)
from app.modules.cultural_rules.repository import CulturalRuleRepository
from app.modules.catalog.repository import CatalogRepository


class CulturalRuleService:
    @staticmethod
    def evaluate_outfit(req: CulturalCheckRequest) -> CulturalCheckResponse:
        rules = CulturalRuleRepository.get_active_rules()
        equipped_slots = {it.slot: it for it in req.items}
        item_ids = {it.item_id for it in req.items}
        outerwear = equipped_slots.get("outerwear")
        garment = CatalogRepository.get_item_by_id(outerwear.item_id) if outerwear else None
        garment_type_id = garment.get("garment_type_id") if garment else None

        warnings: List[CulturalRuleWarning] = []

        for rule in rules:
            code = rule.get("code")
            target_garment = rule.get("target_garment_type_id")

            # Bỏ qua nếu rule chỉ áp dụng cho nhóm áo cụ thể mà outfit không dùng nhóm đó
            if target_garment and target_garment != garment_type_id:
                continue

            # 1. Rule Cài khuy bên phải (Hữu nhậm)
            if code == "RULE_VAT_AO_RIGHT":
                if req.overlap_direction == "left_over_right":
                    warnings.append(CulturalRuleWarning(
                        rule_id=rule["id"],
                        code=code,
                        name=rule["name"],
                        severity=rule["severity"],
                        explanation=rule["explanation"],
                        source_title=rule.get("source_title"),
                        source_citation=rule.get("source_citation"),
                        suggested_fix=rule.get("suggested_fix"),
                    ))

            # 2. Rule Lễ nghi áo tấc kèm khăn vấn
            elif code == "RULE_AO_TAC_LE_NGHI":
                if garment_type_id == "ao_tac" and "headwear" not in equipped_slots:
                    # Trong chế độ truyền thống hoặc dịp trang trọng, đưa ra cảnh báo
                    severity = "warning" if req.style_mode == "traditional" else "info"
                    warnings.append(CulturalRuleWarning(
                        rule_id=rule["id"],
                        code=code,
                        name=rule["name"],
                        severity=severity,
                        explanation=rule["explanation"],
                        source_title=rule.get("source_title"),
                        source_citation=rule.get("source_citation"),
                        suggested_fix=rule.get("suggested_fix"),
                    ))

            # 3. Rule Áo lót trắng cổ đứng
            elif code == "RULE_COLOR_CONTRAST":
                if garment_type_id == "ngu_than" and "undergarment" not in equipped_slots:
                    warnings.append(CulturalRuleWarning(
                        rule_id=rule["id"],
                        code=code,
                        name=rule["name"],
                        severity="info",
                        explanation=rule["explanation"],
                        source_title=rule.get("source_title"),
                        source_citation=rule.get("source_citation"),
                        suggested_fix=rule.get("suggested_fix"),
                    ))

        # Đếm số lượng theo mức độ
        strict_count = sum(1 for w in warnings if w.severity == "strict")
        warning_count = sum(1 for w in warnings if w.severity == "warning")
        info_count = sum(1 for w in warnings if w.severity == "info")

        # culturally sound if no strict violations
        is_sound = strict_count == 0

        return CulturalCheckResponse(
            is_culturally_sound=is_sound,
            strict_count=strict_count,
            warning_count=warning_count,
            info_count=info_count,
            warnings=warnings,
        )
