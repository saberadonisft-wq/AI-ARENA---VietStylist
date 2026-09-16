from typing import Optional
from fastapi import APIRouter, Query
from app.modules.weather.schemas import WeatherResponse
from app.modules.weather.service import WeatherService

router = APIRouter(prefix="/weather", tags=["Weather Integration"])


@router.get("", response_model=WeatherResponse)
async def get_weather(
    city: str = Query("hanoi", description="Mã thành phố (hanoi, hue, danang, hoian, hcm, sapa, dalat, cantho)"),
    lat: Optional[float] = Query(None, description="Vĩ độ tùy chọn"),
    lon: Optional[float] = Query(None, description="Kinh độ tùy chọn"),
):
    """
    Lấy thông tin thời tiết địa phương và lời khuyên chất liệu/phụ kiện Việt phục phù hợp (F06).
    """
    return await WeatherService.get_city_weather(city_key=city, lat=lat, lon=lon)
