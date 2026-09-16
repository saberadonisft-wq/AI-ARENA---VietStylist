from typing import List, Dict, Any
from app.modules.catalog.repository import CatalogRepository
from app.infrastructure.gemini.client import gemini_client
from app.modules.weather.service import WeatherService
from app.modules.recommendations.schemas import (
    ContextRecommendationRequest,
    AIRecommendationRequest,
    RecommendationResponse,
    RecommendedOutfitOutput,
    RecommendedItemOutput,
)


class RecommendationService:
    @staticmethod
    async def get_context_recommendations(req: ContextRecommendationRequest) -> RecommendationResponse:
        # Lấy thời tiết
        weather_res = await WeatherService.get_city_weather(req.city_key or "hanoi")
        weather_rec = weather_res.recommendation

        # Lấy items thuộc occasion
        items = CatalogRepository.get_items(occasion_id=req.occasion_id, gender=req.gender)
        if not items:
            items = CatalogRepository.get_items(gender=req.gender)

        # Build prompt bối cảnh
        prompt = (
            f"Gợi ý phối đồ cho dịp {req.occasion_id}, phong cách {req.style_mode}. "
            f"Thời tiết {weather_res.weather.temperature_c}°C ({weather_res.weather.weather_condition}). "
            f"Lời khuyên chất liệu: {weather_rec.fabric_advice}."
        )

        locked_data = [{"slot": it.slot, "item_id": it.item_id, "variant_id": it.variant_id} for it in req.locked_items]

        raw_result = await gemini_client.get_styling_recommendations(
            prompt=prompt,
            occasion_id=req.occasion_id,
            available_items=items,
            locked_items=locked_data,
        )

        return RecommendationService._format_recommendation_result(raw_result, items, locked_data)

    @staticmethod
    async def get_ai_recommendations(req: AIRecommendationRequest) -> RecommendationResponse:
        items = CatalogRepository.get_items(gender=req.gender, occasion_id=req.occasion_id)
        if not items:
            items = CatalogRepository.get_items(gender=req.gender)

        locked_data = [{"slot": it.slot, "item_id": it.item_id, "variant_id": it.variant_id} for it in req.locked_items]

        raw_result = await gemini_client.get_styling_recommendations(
            prompt=f"{req.prompt} Phong cách: {req.style_mode}.",
            occasion_id=req.occasion_id,
            available_items=items,
            locked_items=locked_data,
        )

        return RecommendationService._format_recommendation_result(raw_result, items, locked_data)

    @staticmethod
    def _format_recommendation_result(raw: Dict[str, Any], available_items=None, locked_items=None) -> RecommendationResponse:
        raw_outfits = raw.get("recommendations", [])
        formatted_outfits: List[RecommendedOutfitOutput] = []

        available_items = available_items if available_items is not None else CatalogRepository.get_items(limit=100)
        locked_items = locked_items or []
        all_items = {it["id"]: it for it in available_items}
        for locked in locked_items:
            item = CatalogRepository.get_item_by_id(locked["item_id"])
            if item and item["is_published"] and item["slot"] == locked["slot"]:
                all_items[item["id"]] = item
        if not raw_outfits:
            raw_outfits = [{"title": "Bộ phối gợi ý", "items": [{"itemId": item["id"]} for item in available_items]}]
            raw = {**raw, "source": "cultural_rule_engine", "model": "rule-based-fallback-v1"}

        for o in raw_outfits:
            title = o.get("title", "Bộ phối đề xuất")
            explanation = o.get("explanation", "Bản phối trang phục thanh nhã tôn vinh nét đẹp cổ phong.")
            locked_slots = {item["slot"] for item in locked_items}
            items_list = list(locked_items) + [item for item in o.get("items", []) if item.get("slot") not in locked_slots]
            used_slots = set()

            formatted_items: List[RecommendedItemOutput] = []
            for it in items_list:
                item_id = it.get("itemId") or it.get("item_id")
                slot = it.get("slot")
                if not item_id or item_id not in all_items:
                    continue

                db_item = all_items[item_id]
                variants = CatalogRepository.get_variants_by_item_id(item_id)
                slot = db_item["slot"]
                if slot in used_slots:
                    continue
                used_slots.add(slot)
                requested_variant = it.get("variantId") or it.get("variant_id")
                chosen_var = next((variant for variant in variants if variant["id"] == requested_variant), variants[0] if variants else None)

                formatted_items.append(RecommendedItemOutput(
                    slot=slot or db_item["slot"],
                    item_id=item_id,
                    variant_id=chosen_var["id"] if chosen_var else None,
                    item_name=db_item["name"],
                    color_name=chosen_var["color_name"] if chosen_var else None,
                    hex_color=chosen_var["hex_color"] if chosen_var else None,
                ))

            if formatted_items:
                formatted_outfits.append(RecommendedOutfitOutput(
                    title=title,
                    explanation=explanation,
                    items=formatted_items,
                ))

        if not formatted_outfits and raw.get("source") == "gemini":
            return RecommendationService._format_recommendation_result({}, available_items, locked_items)

        return RecommendationResponse(
            source=raw.get("source", "cultural_rule_engine"),
            model=raw.get("model", "vietstylist-stylist-v1"),
            outfits=formatted_outfits,
        )
