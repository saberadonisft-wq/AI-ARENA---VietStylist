from fastapi import APIRouter, Depends
from app.core.rate_limit import ai_rate_limit
from app.modules.recommendations.schemas import (
    ContextRecommendationRequest,
    AIRecommendationRequest,
    RecommendationResponse,
)
from app.modules.recommendations.service import RecommendationService

router = APIRouter(
    prefix="/recommendations",
    tags=["Styling Recommendations"],
    dependencies=[Depends(ai_rate_limit)],
)


@router.post("/context", response_model=RecommendationResponse)
async def get_context_recommendations(req: ContextRecommendationRequest):
    """
    Gợi ý phối đồ thông minh kết hợp điều kiện thời tiết địa phương và sự kiện (F06).
    """
    return await RecommendationService.get_context_recommendations(req)


@router.post("/ai", response_model=RecommendationResponse)
async def get_ai_recommendations(req: AIRecommendationRequest):
    """
    Trợ lý ảo Gemini gợi ý phối đồ theo yêu cầu ngôn ngữ tự nhiên, tôn trọng các món đã khóa (F11).
    """
    return await RecommendationService.get_ai_recommendations(req)
