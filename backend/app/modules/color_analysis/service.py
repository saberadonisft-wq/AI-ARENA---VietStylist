import colorsys
import re
from typing import List, Tuple, Dict, Any
from app.core.database import Database
from app.modules.color_analysis.schemas import (
    ColorAnalysisRequest,
    ColorAnalysisResponse,
    ColorVariantSuggestion,
)


def hex_to_rgb(hex_str: str) -> Tuple[float, float, float]:
    hex_clean = hex_str.lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    if len(hex_clean) != 6:
        return (0.5, 0.5, 0.5)
    r = int(hex_clean[0:2], 16) / 255.0
    g = int(hex_clean[2:4], 16) / 255.0
    b = int(hex_clean[4:6], 16) / 255.0
    return (r, g, b)


def rgb_to_hsl(r: float, g: float, b: float) -> Tuple[float, float, float]:
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (h * 360.0, s, l)


def get_luminance(r: float, g: float, b: float) -> float:
    def channel_lum(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    return 0.2126 * channel_lum(r) + 0.7152 * channel_lum(g) + 0.0722 * channel_lum(b)


def calculate_contrast_ratio(hex1: str, hex2: str) -> float:
    r1, g1, b1 = hex_to_rgb(hex1)
    r2, g2, b2 = hex_to_rgb(hex2)
    l1 = get_luminance(r1, g1, b1)
    l2 = get_luminance(r2, g2, b2)
    bright = max(l1, l2)
    dark = min(l1, l2)
    return round((bright + 0.05) / (dark + 0.05), 2)


class ColorAnalysisService:
    @staticmethod
    def analyze_colors(req: ColorAnalysisRequest) -> ColorAnalysisResponse:
        colors = req.colors
        if not colors:
            return ColorAnalysisResponse(
                dominant_color="#1A365D",
                accent_colors=[],
                palette_type="neutral_balance",
                contrast_rating="good",
                contrast_ratio=4.5,
                aesthetic_comment="Chưa chọn đủ màu sắc trang phục để phân tích chi tiết.",
                suggested_variants=[],
            )

        # Outerwear thường là màu chủ đạo
        outerwear_item = next((c for c in colors if c.slot == "outerwear"), colors[0])
        dominant_hex = outerwear_item.hex_color
        accent_hexes = [c.hex_color for c in colors if c.hex_color != dominant_hex]

        r_dom, g_dom, b_dom = hex_to_rgb(dominant_hex)
        h_dom, s_dom, l_dom = rgb_to_hsl(r_dom, g_dom, b_dom)

        # Tính toán tỷ lệ tương phản giữa áo và quần (nếu có) hoặc màu thứ 2
        bottom_item = next((c for c in colors if c.slot == "bottom"), None)
        contrast_hex = (
            bottom_item.hex_color
            if bottom_item
            else (accent_hexes[0] if accent_hexes else "#FFFFFF")
        )
        contrast_ratio = calculate_contrast_ratio(dominant_hex, contrast_hex)

        contrast_rating = (
            "good"
            if contrast_ratio >= 4.5
            else ("moderate" if contrast_ratio >= 3.0 else "low")
        )

        # Xác định loại bảng màu
        palette_type = "neutral_balance"
        comment = "Bản phối màu có sự cân bằng giữa sắc thái trang phục chính và điểm nhấn phụ kiện."

        if accent_hexes:
            r_acc, g_acc, b_acc = hex_to_rgb(accent_hexes[0])
            h_acc, s_acc, l_acc = rgb_to_hsl(r_acc, g_acc, b_acc)
            diff = abs(h_dom - h_acc)
            if diff > 180:
                diff = 360 - diff

            if diff < 35:
                palette_type = "analogous"
                comment = "Bảng màu tương đồng mang lại cảm giác dịu mắt, hài hòa và liền mạch cho tổng thể trang phục."
            elif 150 <= diff <= 210:
                palette_type = "complementary"
                comment = "Bảng màu bổ túc (đối lập) tạo điểm nhấn mạnh mẽ, thu hút ánh nhìn và làm nổi bật các chi tiết hoa văn."
            elif 100 <= diff <= 140:
                palette_type = "triadic"
                comment = "Bảng màu tam giác màu sinh động, phong phú nhưng vẫn giữ được sự cân đối truyền thống."
            else:
                palette_type = (
                    "monochromatic" if s_dom < 0.2 or s_acc < 0.2 else "neutral_balance"
                )

        if contrast_rating == "good":
            comment += f" Độ tương phản đạt {contrast_ratio}:1 rất rõ nét, giúp phom dáng áo ngũ thân hiển thị nổi bật."
        elif contrast_rating == "low":
            comment += f" Độ tương phản {contrast_ratio}:1 hơi nhẹ, bạn có thể cân nhắc phối cùng quần trắng hoặc phụ kiện sáng màu để trang phục thêm sắc nét."

        # Gợi ý các biến thể có thật trong database
        suggested_variants: List[ColorVariantSuggestion] = []
        rows = Database.fetch_all(
            """
            SELECT v.id as variant_id, v.item_id, v.color_name, v.hex_color, i.name as item_name
            FROM item_variants v
            JOIN items i ON v.item_id = i.id
            WHERE i.is_published = 1 AND v.hex_color != ?
            LIMIT 3
        """,
            (dominant_hex,),
        )

        for r in rows:
            suggested_variants.append(
                ColorVariantSuggestion(
                    item_id=r["item_id"],
                    variant_id=r["variant_id"],
                    color_name=r["color_name"],
                    hex_color=r["hex_color"],
                    harmony_reason=f"Màu {r['color_name']} tạo độ tương phản trang nhã khi phối cùng {dominant_hex}.",
                )
            )

        return ColorAnalysisResponse(
            dominant_color=dominant_hex,
            accent_colors=accent_hexes[:3],
            palette_type=palette_type,
            contrast_rating=contrast_rating,
            contrast_ratio=contrast_ratio,
            aesthetic_comment=comment,
            suggested_variants=suggested_variants,
        )
