from starlette.concurrency import run_in_threadpool
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import httpx
from app.core.database import Database
from app.core.http_client import get_shared_async_client
from app.modules.weather.schemas import (
    CityLocation,
    WeatherData,
    WeatherRecommendation,
    WeatherResponse,
)

VIETNAM_CITIES: Dict[str, CityLocation] = {
    "hanoi": CityLocation(
        key="hanoi", name="Hà Nội", region="Bắc", latitude=21.0285, longitude=105.8542
    ),
    "hue": CityLocation(
        key="hue",
        name="Cố đô Huế",
        region="Trung",
        latitude=16.4637,
        longitude=107.5909,
    ),
    "danang": CityLocation(
        key="danang",
        name="Đà Nẵng",
        region="Trung",
        latitude=16.0544,
        longitude=108.2022,
    ),
    "hoian": CityLocation(
        key="hoian",
        name="Phố cổ Hội An",
        region="Trung",
        latitude=15.8801,
        longitude=108.3380,
    ),
    "hcm": CityLocation(
        key="hcm",
        name="TP. Hồ Chí Minh",
        region="Nam",
        latitude=10.8231,
        longitude=106.6297,
    ),
    "sapa": CityLocation(
        key="sapa", name="Sa Pa", region="Bắc", latitude=22.3364, longitude=103.8438
    ),
    "dalat": CityLocation(
        key="dalat", name="Đà Lạt", region="Trung", latitude=11.9404, longitude=108.4583
    ),
    "cantho": CityLocation(
        key="cantho", name="Cần Thơ", region="Nam", latitude=10.0452, longitude=105.7469
    ),
}


class WeatherService:
    @staticmethod
    async def get_city_weather(
        city_key: str = "hanoi",
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> WeatherResponse:
        location = VIETNAM_CITIES.get(city_key.lower(), VIETNAM_CITIES["hanoi"])
        if lat is not None and lon is not None:
            location = CityLocation(
                key=f"custom:{lat:.5f}:{lon:.5f}",
                name="Tọa độ tùy chọn",
                region="Việt Nam",
                latitude=lat,
                longitude=lon,
            )

        # 1. Kiểm tra cache
        now_iso = datetime.now(timezone.utc).isoformat()
        cached_row = await run_in_threadpool(
            Database.fetch_one,
            "SELECT * FROM weather_cache WHERE location_key = ? AND expires_at > ?",
            (location.key, now_iso),
        )
        if cached_row and cached_row.get("weather_data"):
            data = cached_row["weather_data"]
            return WeatherResponse(
                location=location,
                weather=WeatherData(**data["weather"]),
                recommendation=WeatherRecommendation(**data["recommendation"]),
                cached=True,
                source=data.get("source", "open_meteo"),
            )

        # 2. Gọi Open-Meteo API
        weather_info = None
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={location.latitude}&longitude={location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
            client = get_shared_async_client(timeout=5.0)
            res = await client.get(url)
            if res.status_code == 200:
                api_data = res.json().get("current", {})
                temp = api_data.get("temperature_2m", 26.0)
                app_temp = api_data.get("apparent_temperature", temp)
                humidity = int(api_data.get("relative_humidity_2m", 70))
                precip = api_data.get("precipitation", 0.0)
                wind = api_data.get("wind_speed_10m", 8.0)
                code = api_data.get("weather_code", 0)

                condition = "Nắng đẹp"
                if precip > 0 or code in (51, 53, 55, 61, 63, 65, 80, 81, 82):
                    condition = "Mưa rào / Mưa nhẹ"
                elif code in (1, 2, 3):
                    condition = "Nhiều mây, dịu mát"
                elif temp < 18:
                    condition = "Trời se lạnh"

                weather_info = WeatherData(
                    temperature_c=temp,
                    apparent_temperature_c=app_temp,
                    humidity_percent=humidity,
                    weather_condition=condition,
                    is_rainy=precip > 0.2,
                    wind_speed_kmh=wind,
                )
        except Exception:
            pass

        # 3. Fallback thời tiết Việt Nam nếu API ngoài gặp sự cố
        source = "open_meteo" if weather_info else "sample"
        if not weather_info:
            weather_info = WeatherData(
                temperature_c=27.5,
                apparent_temperature_c=29.0,
                humidity_percent=75,
                weather_condition="Dịu mát, nắng nhẹ",
                is_rainy=False,
                wind_speed_kmh=9.5,
            )

        # 4. Sinh lời khuyên thời trang Việt phục
        rec = WeatherService._generate_recommendation(weather_info)

        # 5. Lưu cache (hạn 60 phút)
        expires_at = (
            datetime.now(timezone.utc)
            + timedelta(minutes=60 if source == "open_meteo" else 1)
        ).isoformat()
        cache_content = json.dumps(
            {
                "source": source,
                "weather": weather_info.model_dump(),
                "recommendation": rec.model_dump(),
            },
            ensure_ascii=False,
        )

        await run_in_threadpool(
            Database.execute,
            """
            INSERT OR REPLACE INTO weather_cache (id, location_key, latitude, longitude, weather_data, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                str(uuid.uuid4()),
                location.key,
                location.latitude,
                location.longitude,
                cache_content,
                expires_at,
            ),
        )

        return WeatherResponse(
            location=location,
            weather=weather_info,
            recommendation=rec,
            cached=False,
            source=source,
        )

    @staticmethod
    def _generate_recommendation(w: WeatherData) -> WeatherRecommendation:
        t = w.temperature_c
        accessories = []

        if t >= 28:
            layer = "Phối 1-2 lớp (Áo lót trắng cánh mỏng và áo ngũ thân vải nhẹ)"
            fabric = "Nên chọn vải Sa lụa, Đũi tơ tằm thoáng khí hoặc Voan lụa thấm mồ hôi tốt"
            accessories.append("Quạt xếp nan tre giấy dó")
            accessories.append("Nón bài thơ / Nón quai thao")
            reason = f"Nhiệt độ {t}°C ấm áp/oi bức. Chất liệu lụa tơ tằm mềm mát cùng quạt xếp giấy dó sẽ giúp bạn thoải mái du xuân, chụp ảnh mà vẫn giữ trọn phong thái thanh tao."
        elif t <= 19:
            layer = "Phối 2-3 lớp giữ ấm (Áo lót trong, áo ngũ thân gấm dày và có thể khoác áo tấc tay thụng)"
            fabric = (
                "Chất liệu Gấm dệt hoa, Lụa the hoặc Nhung gấm giữ nhiệt trang trọng"
            )
            accessories.append("Khăn vấn nếp dày")
            accessories.append("Kiềng bạc cổ truyền")
            reason = f"Nhiệt độ {t}°C se lạnh. Cổ áo đứng ôm kín cổ của áo ngũ thân và chất gấm tơ tằm dày dặn sẽ giữ ấm hoàn hảo cho cơ thể khi dạo phố."
        else:
            layer = (
                "Phối tiêu chuẩn (Áo lót trắng hé viền cổ + Áo ngũ thân lụa Vạn Phúc)"
            )
            fabric = "Lụa tơ tằm Hà Đông, Sa trơn óng ánh rủ tự nhiên"
            accessories.append("Quạt xếp giấy dó")
            accessories.append("Khăn vấn đen")
            reason = f"Thời tiết {t}°C vô cùng lý tưởng. Bạn có thể tự do phối mọi sắc màu từ Xanh chàm, Hồng đào đến Vàng hoàng yến để có những bức hình kỷ yếu tuyệt đẹp."

        if w.is_rainy:
            accessories.append("Guốc mộc cao đế")
            reason += " Lưu ý có mưa ẩm: Nên phối cùng guốc mộc để bước đi thanh thoát và không làm lấm tà áo lụa dài."

        return WeatherRecommendation(
            layer_advice=layer,
            fabric_advice=fabric,
            suggested_accessories=accessories,
            reason=reason,
        )
