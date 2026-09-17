from fastapi import APIRouter
from app.modules.cultural_rules.schemas import (
    CulturalCheckRequest,
    CulturalCheckResponse,
)
from app.modules.cultural_rules.service import CulturalRuleService

router = APIRouter(prefix="/cultural-check", tags=["Cultural Rules Engine"])


@router.post("", response_model=CulturalCheckResponse)
def check_cultural_compliance(req: CulturalCheckRequest):
    """
    Kiểm tra độ tuân thủ quy chuẩn văn hóa của bộ phối (F10).
    Trả về các cảnh báo (hướng cài vạt áo, lễ phục, khăn vấn), trích dẫn nguồn lịch sử và gợi ý 1-click sửa nhanh.
    """
    return CulturalRuleService.evaluate_outfit(req)
