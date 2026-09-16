from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class CityLocation(BaseModel):
    key: str
    name: str
    region: str # Bac, Trung, Nam
    latitude: float
    longitude: float


class WeatherData(BaseModel):
    temperature_c: float
    apparent_temperature_c: float
    humidity_percent: int
    weather_condition: str # Nang, Nhieu may, Mua nhe, Mua rao, Se lanh
    is_rainy: bool
    wind_speed_kmh: float


class WeatherRecommendation(BaseModel):
    layer_advice: str # 1-2 lớp mỏng mát, hoặc 2-3 lớp giữ ấm
    fabric_advice: str # Lụa sa, đũi mộc mạc thoáng mát, hoặc gấm dệt giữ ấm
    suggested_accessories: List[str] # Quạt xếp giấy dó, nón bài thơ, khăn vấn
    reason: str


class WeatherResponse(BaseModel):
    location: CityLocation
    weather: WeatherData
    recommendation: WeatherRecommendation
    cached: bool
    source: str = "open_meteo"
