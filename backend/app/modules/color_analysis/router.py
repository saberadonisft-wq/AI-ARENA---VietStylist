from fastapi import APIRouter
from app.modules.color_analysis.schemas import (
    ColorAnalysisRequest,
    ColorAnalysisResponse,
)
from app.modules.color_analysis.service import ColorAnalysisService

router = APIRouter(prefix="/color-analysis", tags=["Color Harmony Analysis"])


@router.post("", response_model=ColorAnalysisResponse)
def analyze_outfit_colors(req: ColorAnalysisRequest):
    """
    Phân tích độ hài hòa màu sắc, tương phản và đề xuất biến thể màu thay thế (F07).
    """
    return ColorAnalysisService.analyze_colors(req)
