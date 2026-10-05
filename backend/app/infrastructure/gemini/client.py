import anyio
from app.infrastructure.gemini.schemas import ModelRecommendations, parse_recommendations
import json
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)
_provider_slots = anyio.CapacityLimiter(4)
_TEXT_MODEL_CHAIN = (
    "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash",
)
_MODEL_ATTEMPT_TIMEOUT = 25.0
# A busy/slow model must not consume the whole budget before the rest of the
# configured fallback chain gets a chance to answer.
_RECOMMENDATION_TIMEOUT = 100.0


def _retry_after_seconds(response: httpx.Response) -> float:
    value = response.headers.get("Retry-After", "")
    try:
        return max(0.0, float(value))
    except ValueError:
        try:
            retry_at = parsedate_to_datetime(value)
            return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())
        except (ValueError, TypeError, OverflowError):
            return 0.0


class GeminiClient:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.text_model = settings.GEMINI_MODEL_TEXT
        self.image_model = settings.GEMINI_MODEL_IMAGE
        self.is_configured = bool(self.api_key)

    @property
    def text_models(self) -> tuple[str, ...]:
        # Start at the configured version; never upgrade or replace a custom model.
        if self.text_model in _TEXT_MODEL_CHAIN:
            return _TEXT_MODEL_CHAIN[_TEXT_MODEL_CHAIN.index(self.text_model):]
        return (self.text_model,)

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
            models = self.text_models
            with anyio.fail_after(_RECOMMENDATION_TIMEOUT) as deadline:
                for index, model in enumerate(models):
                    remaining = deadline.deadline - anyio.current_time()
                    if remaining <= 0:
                        raise TimeoutError
                    # Give the selected model its normal timeout. Dividing the
                    # budget by fallback count prematurely cancels valid answers.
                    # The outer scope bounds every attempt and Retry-After. Keep
                    # distinct deadlines instead of racing two equal cancel scopes.
                    try:
                        with anyio.fail_after(_MODEL_ATTEMPT_TIMEOUT):
                            resp = await client.post(
                                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                                headers={"X-goog-api-key": self.api_key},
                                json=payload,
                            )
                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            # A blocked answer must not be retried with another model.
                            if data.get("promptFeedback", {}).get("blockReason") or any(
                                candidate.get("finishReason") in {
                                    "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII",
                                } for candidate in candidates
                            ):
                                break
                            if not candidates:
                                raise ValueError("Expected a candidate")
                            text_response = "".join(
                                part.get("text", "")
                                for part in candidates[0].get("content", {}).get("parts", [])
                                if not part.get("thought")
                            )
                            parsed = json.loads(text_response)
                            if not isinstance(parsed, dict):
                                raise ValueError("Expected an outfit object")
                            recs = parsed.get("outfits", parsed.get("recommendations", [parsed]))
                            return {
                                "source": "gemini",
                                "model": model,
                                "recommendations": parse_recommendations(recs),
                            }
                        reason = {
                            400: "Cấu hình yêu cầu Gemini chưa hợp lệ",
                            401: "Khóa API Gemini không được chấp nhận",
                            403: "Khóa API chưa có quyền dùng Gemini",
                            404: "Model Gemini được cấu hình hiện không khả dụng",
                            429: "Gemini đã chạm hạn mức sử dụng",
                        }.get(resp.status_code, "Gemini tạm thời không khả dụng")
                        notice = f"{reason}. Đây là gợi ý dự phòng từ danh mục, chưa phân tích đầy đủ yêu cầu của bạn."
                        logger.warning("Gemini model %s returned status %s", model, resp.status_code)
                        if resp.status_code not in {404, 408, 429, 500, 502, 503, 504}:
                            break
                        if index < len(models) - 1:
                            delay = _retry_after_seconds(resp)
                            if delay >= deadline.deadline - anyio.current_time():
                                break
                            if delay:
                                await anyio.sleep(delay)
                    except (TimeoutError, httpx.TimeoutException):
                        notice = "Gemini phản hồi quá chậm. Đây là gợi ý dự phòng từ danh mục; bạn có thể thử lại."
                        logger.warning("Gemini model %s timed out", model)
                    except httpx.RequestError:
                        notice = "Không kết nối được Gemini. Đây là gợi ý dự phòng từ danh mục."
                        logger.warning("Gemini model %s connection failed", model)
                    except (ValueError, TypeError, AttributeError):
                        notice = "Gemini trả kết quả chưa hợp lệ. Đây là gợi ý dự phòng từ danh mục."
                        logger.warning("Gemini model %s returned invalid recommendations", model)
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
