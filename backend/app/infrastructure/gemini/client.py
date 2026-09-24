import anyio
from app.infrastructure.gemini.schemas import ModelRecommendations, parse_recommendations
import json
import logging
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)
_provider_slots = anyio.CapacityLimiter(4)


class GeminiClient:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.text_model = settings.GEMINI_MODEL_TEXT
        self.image_model = settings.GEMINI_MODEL_IMAGE
        self.is_configured = bool(self.api_key)

    async def get_styling_recommendations(
        self,
        prompt: str,
        occasion_id: Optional[str],
        available_items: List[Dict[str, Any]],
        locked_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Gợi ý phối đồ Việt phục bằng Gemini với structured output.
        Nếu API key không có hoặc quá quota, kích hoạt bộ quy tắc nội bộ fallback.
        """
        locked_items = locked_items or []
        items_summary = [
            {
                "id": it["id"],
                "name": it["name"],
                "slot": it["slot"],
                "gender": it.get("gender", "unisex"),
                "description": it.get("description", ""),
                "variants": it.get("variants", []),
            }
            for it in available_items
        ]

        if not self.is_configured:
            return self._fallback_styling(
                prompt, occasion_id, available_items, locked_items,
                notice="Gemini chưa được cấu hình. Đây là gợi ý dự phòng từ danh mục, chưa phân tích đầy đủ yêu cầu của bạn.",
            )

        system_instruction = (
            "Bạn là chuyên gia cố vấn thời trang Việt phục (Việt phục Remix Stylist). "
            "Nhiệm vụ của bạn là chọn từ danh sách trang phục được cung cấp để tạo ra 1 đến 2 bộ phối trang phục phù hợp với sự kiện và yêu cầu người dùng. "
            "QUAN TRỌNG: Chỉ chọn ID món đồ có trong danh sách được cung cấp. Phải giữ nguyên các món đồ đã khóa (locked_items). "
            "Giải thích ngắn gọn lý do phối đồ dựa trên nét đẹp truyền thống và tính thẩm mỹ đương đại."
            " Mỗi vị trí chỉ chọn một món. Chỉ chọn variant_id được cung cấp cho món đó, nếu không có thì trả null."
            " Không khẳng định thẩm định văn hóa. Nếu danh mục không đáp ứng yêu cầu, giải thích rõ giới hạn."
        )

        user_content = {
            "user_request": prompt,
            "occasion": occasion_id,
            "locked_items": locked_items,
            "available_items": items_summary,
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.text_model}:generateContent"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": system_instruction},
                        {"text": json.dumps(user_content, ensure_ascii=False)},
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": ModelRecommendations.model_json_schema(by_alias=False),
                "temperature": 0.3,
            },
        }

        try:
            _provider_slots.acquire_nowait()
        except anyio.WouldBlock:
            return self._fallback_styling(
                prompt, occasion_id, available_items, locked_items,
                notice="Gemini đang bận. Đây là gợi ý dự phòng từ danh mục; bạn có thể thử lại sau.",
            )
        notice = "Gemini trả kết quả chưa hợp lệ. Đây là gợi ý dự phòng từ danh mục."
        try:
            from app.core.http_client import get_shared_async_client

            client = get_shared_async_client(timeout=25.0)
            with anyio.fail_after(30):
                resp = await client.post(
                    url,
                    headers={"X-goog-api-key": self.api_key},
                    json=payload,
                )
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    text_response = "".join(
                        part.get("text", "")
                        for part in candidates[0].get("content", {}).get("parts", [])
                        if not part.get("thought")
                    )
                    parsed = json.loads(text_response)
                    if not isinstance(parsed, dict):
                        raise ValueError("Expected an outfit object")
                    recs = parsed.get(
                        "outfits",
                        parsed.get(
                            "recommendations",
                            [parsed] if isinstance(parsed, dict) else [],
                        ),
                    )
                    if isinstance(recs, list) and len(recs) > 0:
                        return {
                            "source": "gemini",
                            "model": self.text_model,
                            "recommendations": parse_recommendations(recs),
                        }
                    else:
                        logger.warning(
                            "Gemini output structure invalid (empty recommendations), activating fallback"
                        )
            if resp.status_code != 200:
                reason = {
                    400: "Cấu hình yêu cầu Gemini chưa hợp lệ",
                    401: "Khóa API Gemini không được chấp nhận",
                    403: "Khóa API chưa có quyền dùng Gemini",
                    404: "Model Gemini được cấu hình hiện không khả dụng",
                    429: "Gemini đã chạm hạn mức sử dụng",
                }.get(resp.status_code, "Gemini tạm thời không khả dụng")
                notice = f"{reason}. Đây là gợi ý dự phòng từ danh mục, chưa phân tích đầy đủ yêu cầu của bạn."
            logger.warning(
                f"Gemini API returned status {resp.status_code}, activating fallback"
            )
        except Exception as e:
            if isinstance(e, (TimeoutError, httpx.TimeoutException)):
                notice = "Gemini phản hồi quá chậm. Đây là gợi ý dự phòng từ danh mục; bạn có thể thử lại."
            elif isinstance(e, httpx.RequestError):
                notice = "Không kết nối được Gemini. Đây là gợi ý dự phòng từ danh mục."
            logger.warning(
                "Gemini call failed (%s), activating fallback", type(e).__name__
            )
        finally:
            _provider_slots.release()

        return self._fallback_styling(
            prompt, occasion_id, available_items, locked_items, notice=notice
        )

    def _fallback_styling(
        self,
        prompt: str,
        occasion_id: Optional[str],
        available_items: List[Dict[str, Any]],
        locked_items: List[Dict[str, Any]],
        notice: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Quy tắc phối đồ dự phòng thông minh (Rule-based Fallback) tuân thủ di sản văn hóa."""
        locked_slots = {it.get("slot") for it in locked_items if it.get("slot")}

        # Phân loại items theo slot
        outerwear = [i for i in available_items if i.get("slot") == "outerwear"]
        undergarments = [i for i in available_items if i.get("slot") == "undergarment"]
        bottoms = [i for i in available_items if i.get("slot") == "bottom"]
        headwears = [i for i in available_items if i.get("slot") == "headwear"]
        accessories = [i for i in available_items if i.get("slot") == "accessory_front"]
        footwear = [i for i in available_items if i.get("slot") == "footwear"]

        selected_items = list(locked_items)

        # Chọn outerwear phù hợp dịp
        if "outerwear" not in locked_slots and outerwear:
            if occasion_id == "cuoi_hoi":
                chosen_outer = next(
                    (
                        i
                        for i in outerwear
                        if "tac" in i["id"] or "nhat_binh" in i["id"]
                    ),
                    outerwear[0],
                )
            elif occasion_id == "tet":
                chosen_outer = next(
                    (i for i in outerwear if "vang" in i["id"] or "do" in i["id"]),
                    outerwear[0],
                )
            else:
                chosen_outer = outerwear[0]
            selected_items.append({"slot": "outerwear", "itemId": chosen_outer["id"]})

        # Áo lót trắng cổ đứng
        if "undergarment" not in locked_slots and undergarments:
            selected_items.append(
                {"slot": "undergarment", "itemId": undergarments[0]["id"]}
            )

        # Quần ống suông
        if "bottom" not in locked_slots and bottoms:
            selected_items.append({"slot": "bottom", "itemId": bottoms[0]["id"]})

        # Khăn vấn
        if "headwear" not in locked_slots and headwears:
            selected_items.append({"slot": "headwear", "itemId": headwears[0]["id"]})

        # Phụ kiện quạt hoặc kiềng
        if "accessory_front" not in locked_slots and accessories:
            selected_items.append(
                {"slot": "accessory_front", "itemId": accessories[0]["id"]}
            )

        # Guốc mộc hoặc giày
        if "footwear" not in locked_slots and footwear:
            selected_items.append({"slot": "footwear", "itemId": footwear[0]["id"]})

        return {
            "source": "cultural_rule_engine",
            "model": "rule-based-fallback-v1",
            "notice": notice,
            "recommendations": [
                {
                    "title": "Bản phối tham khảo từ danh mục",
                    "explanation": (
                        "Chọn các món đang xuất bản theo vị trí trang phục và giữ các món đã khóa. "
                        "Gợi ý dự phòng chưa phân tích đầy đủ yêu cầu và chưa được thẩm định văn hóa."
                    ),
                    "items": selected_items,
                }
            ],
        }


gemini_client = GeminiClient()
