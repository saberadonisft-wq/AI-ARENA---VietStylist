"""Seed unreviewed example cultural knowledge data for VietStylist V3.

Garments:
1. Áo ngũ thân (garment_ngu_than) — Canonical 5-panel garment
2. Áo tấc (garment_ao_tac) — Ceremonial wide-sleeve variant
3. Ngũ thân nam (garment_ngu_than_nam) & Ngũ thân nữ (garment_ngu_than_nu)
4. Periods, regions, materials, accessories, sources, assertions, and generation profiles.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

# Ensure repo root is on sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

from app.core.database import get_db_connection, db_transaction, init_database


def seed_pilot_data():
    """Insert draft pilot examples without overwriting editorial changes."""
    print("[INFO] Initializing schema if needed...")
    init_database(seed=False)

    with get_db_connection() as conn:
        with conn:
            conn.execute("BEGIN IMMEDIATE")

            # -------------------------------------------------------------
            # 1. SOURCES (cultural_sources_v3)
            # -------------------------------------------------------------
            sources = [
                (
                    "source_ngan_nam_ao_mu",
                    "academic_book",
                    "Ngàn năm áo mũ: Lịch sử trang phục Việt Nam giai đoạn 1009-1945",
                    "Trần Quang Đức",
                    "NXB Thế Giới & Công ty Nhã Nam",
                    "2013",
                    "https://nhanam.vn/ngan-nam-ao-mu",
                    "2026-01-01",
                    json.dumps({"license": "Academic Reference", "public_excerpt": True}),
                    "A_ACADEMIC",
                    "draft",
                    1,
                ),
                (
                    "source_dai_nam_hoi_dien",
                    "archival_record",
                    "Đại Nam hội điển sự lệ (Quyển 78: Lễ bộ nghi thức y quan)",
                    "Nội các triều Nguyễn biên soạn",
                    "Quốc sử quán triều Nguyễn",
                    "1851",
                    None,
                    "2026-01-01",
                    json.dumps({"license": "Public Domain historical record"}),
                    "A_ACADEMIC",
                    "draft",
                    1,
                ),
                (
                    "source_trang_phuc_viet",
                    "academic_book",
                    "Trang phục Việt Nam qua các thời đại",
                    "Đoàn Thị Tình",
                    "NXB Mỹ Thuật Hà Nội",
                    "1987",
                    None,
                    "2026-01-01",
                    json.dumps({"license": "Educational Reference"}),
                    "B_INSTITUTIONAL",
                    "draft",
                    1,
                ),
                (
                    "source_bao_tang_lich_su",
                    "museum_record",
                    "Hồ sơ hiện vật áo ngũ thân và áo tấc cung đình triều Nguyễn",
                    "Bảo tàng Lịch sử Quốc gia Việt Nam",
                    "Bảo tàng Lịch sử Quốc gia",
                    "2020",
                    "https://baotanglichsu.vn",
                    "2026-01-01",
                    json.dumps({"license": "Museum Exhibit Reference"}),
                    "B_INSTITUTIONAL",
                    "draft",
                    1,
                ),
            ]

            conn.executemany(
                """
                INSERT INTO cultural_sources_v3 (
                    id, source_type, title, creator, institution, publication_date,
                    url, accessed_at, rights_json, trust_tier, review_status, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                sources,
            )

            # -------------------------------------------------------------
            # 2. CANONICAL ENTITIES (entity_registry)
            # -------------------------------------------------------------
            entities = [
                # Garments
                (
                    "garment_ngu_than",
                    "garment",
                    "1.0",
                    json.dumps({
                        "name_vi": "Áo ngũ thân",
                        "aliases": ["Ngũ thân tay chẽn", "Áo năm thân", "Áo dài ngũ thân"],
                        "summary_vi": "Trang phục truyền thống năm thân cài khuy bên phải, định hình phong thái người Việt từ thời chúa Nguyễn Phúc Khoát (1744) và phát triển hưng thịnh thời triều Nguyễn.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({"signature_garment": True, "curated_order": 1}),
                ),
                (
                    "garment_ao_tac",
                    "garment",
                    "1.0",
                    json.dumps({
                        "name_vi": "Áo tấc",
                        "aliases": ["Áo thụng", "Lễ phục áo tấc", "Áo ngũ thân tay thụng"],
                        "summary_vi": "Lễ phục trang trọng của triều Nguyễn, có cấu tạo thân như áo ngũ thân nhưng tay áo thụng rộng, chuyên dùng trong tế lễ, hôn lễ và các nghi lễ cung đình.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({"signature_garment": True, "curated_order": 2}),
                ),
                (
                    "garment_ngu_than_nam",
                    "garment_variant",
                    "1.0",
                    json.dumps({
                        "name_vi": "Áo ngũ thân nam tay chẽn",
                        "aliases": ["Ngũ thân nam", "Áo chẽn nam"],
                        "gender": "male",
                        "summary_vi": "Dáng áo thẳng, vạt áo buông vừa phải, mang vẻ thư sinh, thanh lịch và đĩnh đạc.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                (
                    "garment_ngu_than_nu",
                    "garment_variant",
                    "1.0",
                    json.dumps({
                        "name_vi": "Áo ngũ thân nữ tay chẽn",
                        "aliases": ["Ngũ thân nữ", "Áo chẽn nữ"],
                        "gender": "female",
                        "summary_vi": "Đường lượn eo nhẹ nhàng, vạt áo kín đáo tôn nét đài các, dịu dàng của phụ nữ Việt.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                # Periods
                (
                    "period_nguyen",
                    "period",
                    "1.0",
                    json.dumps({
                        "name_vi": "Triều Nguyễn",
                        "years": "1802 - 1945",
                        "description": "Giai đoạn thống nhất quốc gia và điển chế hóa trang phục toàn diện dưới sự trị vì của các hoàng đế triều Nguyễn.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                (
                    "period_chua_nguyen",
                    "period",
                    "1.0",
                    json.dumps({
                        "name_vi": "Thời Chúa Nguyễn (Đàng Trong)",
                        "years": "1558 - 1777",
                        "description": "Giai đoạn định hình thể chế y phục phương Nam, đặc biệt là cải cách năm 1744 của Vũ Vương Nguyễn Phúc Khoát.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                # Regions
                (
                    "region_hue",
                    "region",
                    "1.0",
                    json.dumps({"name_vi": "Cố đô Huế / Thuận Hóa", "locale": "vn_central"}, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                # Accessories & Components
                (
                    "accessory_khan_van",
                    "accessory",
                    "1.0",
                    json.dumps({
                        "name_vi": "Khăn vấn",
                        "aliases": ["Khăn đóng", "Khăn xếp"],
                        "summary_vi": "Khăn quấn đầu bằng lụa hoặc gấm, phụ kiện quan trọng bậc nhất đi kèm áo ngũ thân và áo tấc.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                (
                    "garment_quan_trang",
                    "garment",
                    "1.0",
                    json.dumps({
                        "name_vi": "Quần trắng ống rộng",
                        "aliases": ["Bạch tố quần", "Quần thụng lụa trắng"],
                        "summary_vi": "Quần lụa trắng dài chấm mu bàn chân, mặc cùng áo ngũ thân tạo độ tương phản trang nhã.",
                    }, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                (
                    "material_lua_to_tam",
                    "material",
                    "1.0",
                    json.dumps({"name_vi": "Lụa tơ tằm Vạn Phúc / Bảo Lộc", "composition": "100% natural silk"}, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
                (
                    "material_gam_the",
                    "material",
                    "1.0",
                    json.dumps({"name_vi": "Gấm the hoa văn cổ", "composition": "Brocade / silk blend"}, ensure_ascii=False),
                    "draft",
                    1,
                    json.dumps({}),
                ),
            ]

            conn.executemany(
                """
                INSERT INTO entity_registry (
                    id, entity_type, schema_version, identity_json, status, version, extensions_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                entities,
            )

            # -------------------------------------------------------------
            # 3. ATTRIBUTE DEFINITIONS (attribute_definitions)
            # -------------------------------------------------------------
            attr_defs = [
                (
                    "construction.closure.direction",
                    "Hướng khép vạt áo",
                    "Hướng khép của vạt áo ngoài: 'right_over_left' (Hữu nhậm - vạt phải đè vạt trái).",
                    "enum",
                    "single",
                    json.dumps(["right_over_left", "left_over_right"]),
                    json.dumps(["garment", "garment_variant"]),
                    1, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "construction.body_panels",
                    "Số thân vải",
                    "Số lượng thân vải tạo nên thân áo chính (áo ngũ thân gồm 5 thân).",
                    "number",
                    "single",
                    None,
                    json.dumps(["garment", "garment_variant"]),
                    0, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "construction.collar.type",
                    "Kiểu dáng cổ áo",
                    "Kiểu cổ áo: cổ đứng (cổ lập), cổ tròn, cổ giao lĩnh.",
                    "enum",
                    "single",
                    json.dumps(["standing", "round", "cross_collar"]),
                    json.dumps(["garment", "garment_variant"]),
                    1, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "construction.collar.height_cm",
                    "Chiều cao cổ áo (cm)",
                    "Chiều cao chuẩn của cổ áo ngũ thân (2.5cm đến 4.0cm).",
                    "measurement",
                    "single",
                    None,
                    json.dumps(["garment", "garment_variant"]),
                    1, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "construction.sleeve.type",
                    "Kiểu tay áo",
                    "Tay chẽn (ôm gọn cổ tay) hoặc Tay thụng (rộng thùng thình 30-45cm).",
                    "enum",
                    "single",
                    json.dumps(["tay_chen", "tay_thung", "tay_raglan"]),
                    json.dumps(["garment", "garment_variant"]),
                    1, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "construction.buttons.count",
                    "Số lượng khuy cài",
                    "Số khuy cài: ngũ thân chuẩn có 5 khuy (cổ, nách, ngực, sườn, eo).",
                    "number",
                    "single",
                    None,
                    json.dumps(["garment", "garment_variant"]),
                    0, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "wearing.undergarment.required",
                    "Yêu cầu áo lót trong (Bạch y)",
                    "Có bắt buộc mặc áo lót trắng bên trong để lộ viền cổ hay không.",
                    "boolean",
                    "single",
                    None,
                    json.dumps(["garment", "garment_variant"]),
                    1, 1, 1, "not_collected", "active", 1,
                ),
                (
                    "wearing.headwear.recommended",
                    "Phụ kiện đội đầu khuyến nghị",
                    "Phụ kiện đầu mặc cùng (khăn vấn / khăn đóng).",
                    "entity_ref",
                    "single",
                    None,
                    json.dumps(["garment", "garment_variant"]),
                    1, 1, 1, "not_collected", "active", 1,
                ),
            ]

            conn.executemany(
                """
                INSERT INTO attribute_definitions (
                    key, label_vi, description, value_type, cardinality,
                    allowed_values_json, applies_to_json, contextual, queryable,
                    inheritable, default_missing_state, status, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(key) DO NOTHING
                """,
                attr_defs,
            )

            # -------------------------------------------------------------
            # 4. CULTURAL ASSERTIONS (cultural_assertions_v3)
            # -------------------------------------------------------------
            assertions = [
                (
                    "assert_ngu_than_5_panels",
                    "garment_ngu_than",
                    "construction.body_panels",
                    json.dumps(5),
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "Áo ngũ thân được ghép từ 5 thân vải: 2 thân trước, 2 thân sau và 1 thân con (tiểu nhậm) bên trong vạt trước.",
                    0.99,
                    "strong_consensus",
                    "draft",
                ),
                (
                    "assert_ngu_than_huu_nham",
                    "garment_ngu_than",
                    "construction.closure.direction",
                    json.dumps("right_over_left"),
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "Quy tắc Hữu nhậm: Vạt áo ngũ thân bắt buộc cài khuy từ trái sang phải. Cài vạt ngược (Tả nhậm) là tập tục liệm mai táng cổ đại, tuyệt đối cấm kỵ.",
                    1.0,
                    "strong_consensus",
                    "draft",
                ),
                (
                    "assert_ngu_than_co_dung",
                    "garment_ngu_than",
                    "construction.collar.type",
                    json.dumps("standing"),
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "Cổ áo ngũ thân thời Nguyễn là cổ đứng (cổ lập), cao thẳng trang nghiêm, thể hiện khí tiết đoan chính.",
                    0.95,
                    "strong_consensus",
                    "draft",
                ),
                (
                    "assert_ngu_than_5_buttons",
                    "garment_ngu_than",
                    "construction.buttons.count",
                    json.dumps(5),
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "Năm hạt khuy cài trên áo ngũ thân tượng trưng cho Ngũ luân (quân thần, phụ tử, phu thê, huynh đệ, bằng hữu) và Ngũ thường (Nhân, Lễ, Nghĩa, Trí, Tín).",
                    0.95,
                    "corroborated",
                    "draft",
                ),
                (
                    "assert_ao_tac_tay_thung",
                    "garment_ao_tac",
                    "construction.sleeve.type",
                    json.dumps("tay_thung"),
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "Áo tấc có tay áo may thụng rộng (30-40cm), buông rủ qua bàn tay, tượng trưng cho phong thái khoan thai, trang trọng của lễ giáo cung đình.",
                    0.98,
                    "strong_consensus",
                    "draft",
                ),
                (
                    "assert_bach_y_inner_collar",
                    "garment_ngu_than",
                    "wearing.undergarment.required",
                    json.dumps(True),
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "Theo điển lệ triều Nguyễn, khi mặc áo ngũ thân hoặc áo tấc luôn mặc lót áo trắng bên trong, cổ áo trong lộ ra 1-2mm tạo nét thanh tao.",
                    0.92,
                    "strong_consensus",
                    "draft",
                ),
            ]

            conn.executemany(
                """
                INSERT INTO cultural_assertions_v3 (
                    id, subject_id, predicate, value_json, qualifiers_json,
                    statement_vi, confidence, consensus, review_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                assertions,
            )

            # -------------------------------------------------------------
            # 5. ASSERTION EVIDENCE (assertion_evidence_v3)
            # -------------------------------------------------------------
            evidences = [
                ("ev_ngu_than_panels_1", "assert_ngu_than_5_panels", "source_ngan_nam_ao_mu", "Chương 4: Thời Nguyễn, tr. 195-202"),
                ("ev_ngu_than_panels_2", "assert_ngu_than_5_panels", "source_dai_nam_hoi_dien", "Quyển 78, Y quan triều nghi"),
                ("ev_huu_nham_1", "assert_ngu_than_huu_nham", "source_ngan_nam_ao_mu", "Phần khảo luận về vạt áo Hữu nhậm, tr. 182"),
                ("ev_huu_nham_2", "assert_ngu_than_huu_nham", "source_dai_nam_hoi_dien", "Quyển 78, Chương Y phục bá quan"),
                ("ev_co_dung_1", "assert_ngu_than_co_dung", "source_ngan_nam_ao_mu", "Trang 210-215"),
                ("ev_5_buttons_1", "assert_ngu_than_5_buttons", "source_trang_phuc_viet", "Ý nghĩa ngũ khuy trong triết lý y quan Việt, tr. 84"),
                ("ev_ao_tac_1", "assert_ao_tac_tay_thung", "source_ngan_nam_ao_mu", "Trang 206: Khảo về Áo tấc tay thụng"),
                ("ev_ao_tac_2", "assert_ao_tac_tay_thung", "source_bao_tang_lich_su", "Hiện vật áo tấc sa đoạn triều Nguyễn (mã BTLS-0924)"),
                ("ev_bach_y_1", "assert_bach_y_inner_collar", "source_ngan_nam_ao_mu", "Khảo luận bạch y lót trong cổ phục, tr. 188"),
            ]

            conn.executemany(
                """
                INSERT INTO assertion_evidence_v3 (id, assertion_id, source_id, locator)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                evidences,
            )

            # -------------------------------------------------------------
            # 6. ATTRIBUTE VALUES (attribute_values)
            # -------------------------------------------------------------
            attr_values = [
                # Áo ngũ thân (Canonical)
                (
                    "av_ngu_than_closure", "garment_ngu_than", "construction.closure.direction",
                    "known", json.dumps("right_over_left"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_huu_nham"]),
                ),
                (
                    "av_ngu_than_panels", "garment_ngu_than", "construction.body_panels",
                    "known", json.dumps(5), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_5_panels"]),
                ),
                (
                    "av_ngu_than_collar_type", "garment_ngu_than", "construction.collar.type",
                    "known", json.dumps("standing"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_co_dung"]),
                ),
                (
                    "av_ngu_than_collar_height", "garment_ngu_than", "construction.collar.height_cm",
                    "known", json.dumps(3.5), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_co_dung"]),
                ),
                (
                    "av_ngu_than_sleeve", "garment_ngu_than", "construction.sleeve.type",
                    "known", json.dumps("tay_chen"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "[]",
                ),
                (
                    "av_ngu_than_buttons", "garment_ngu_than", "construction.buttons.count",
                    "known", json.dumps(5), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_5_buttons"]),
                ),
                (
                    "av_ngu_than_undergarment", "garment_ngu_than", "wearing.undergarment.required",
                    "known", json.dumps(True), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_bach_y_inner_collar"]),
                ),
                (
                    "av_ngu_than_headwear", "garment_ngu_than", "wearing.headwear.recommended",
                    "known", json.dumps("accessory_khan_van"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    "[]",
                ),
                # Áo tấc (Ceremonial Variant)
                (
                    "av_ao_tac_closure", "garment_ao_tac", "construction.closure.direction",
                    "known", json.dumps("right_over_left"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_huu_nham"]),
                ),
                (
                    "av_ao_tac_panels", "garment_ao_tac", "construction.body_panels",
                    "known", json.dumps(5), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_5_panels"]),
                ),
                (
                    "av_ao_tac_sleeve", "garment_ao_tac", "construction.sleeve.type",
                    "known", json.dumps("tay_thung"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ao_tac_tay_thung"]),
                ),
                (
                    "av_ao_tac_collar_type", "garment_ao_tac", "construction.collar.type",
                    "known", json.dumps("standing"), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_ngu_than_co_dung"]),
                ),
                (
                    "av_ao_tac_undergarment", "garment_ao_tac", "wearing.undergarment.required",
                    "known", json.dumps(True), "[]",
                    json.dumps({"period_ids": ["period_nguyen"]}),
                    json.dumps(["assert_bach_y_inner_collar"]),
                ),
            ]

            conn.executemany(
                """
                INSERT INTO attribute_values (
                    id, entity_id, attribute_key, state, value_json,
                    candidate_values_json, qualifiers_json, assertion_ids_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                attr_values,
            )

            # -------------------------------------------------------------
            # 7. RELATION DEFINITIONS & RELATIONS
            # -------------------------------------------------------------
            rel_defs = [
                ("regional_variant_of", "Biến thể vùng của", json.dumps(["garment_variant", "garment"]), json.dumps(["garment"]), 1, None, 1, 0, "active", 1),
                ("variant_of", "Biến thể của", json.dumps(["garment_variant", "garment"]), json.dumps(["garment"]), 1, None, 1, 0, "active", 1),
                ("used_during", "Sử dụng trong triều đại", json.dumps(["garment", "accessory"]), json.dumps(["period"]), 1, None, 1, 1, "active", 1),
                ("used_with", "Sử dụng kèm với", json.dumps(["garment", "garment_variant", "accessory"]), json.dumps(["garment", "garment_variant", "accessory"]), 0, None, 1, 1, "active", 1),
                ("made_from", "Được chế tác từ chất liệu", json.dumps(["garment", "garment_variant", "accessory"]), json.dumps(["material"]), 1, None, 1, 1, "active", 1),
                ("layered_over", "Mặc phủ lên trên", json.dumps(["garment"]), json.dumps(["garment"]), 1, "layered_under", 1, 1, "active", 1),
            ]

            conn.executemany(
                """
                INSERT INTO relation_definitions (
                    key, label_vi, source_types_json, target_types_json,
                    directional, inverse_relation_key, contextual, inheritable, status, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(key) DO NOTHING
                """,
                rel_defs,
            )

            relations = [
                ("rel_ao_tac_ngu_than", "garment_ao_tac", "variant_of", "garment_ngu_than", "known", "{}", "[]"),
                ("rel_ngu_than_nam_ngu_than", "garment_ngu_than_nam", "variant_of", "garment_ngu_than", "known", "{}", "[]"),
                ("rel_ngu_than_nu_ngu_than", "garment_ngu_than_nu", "variant_of", "garment_ngu_than", "known", "{}", "[]"),
                ("rel_ngu_than_period", "garment_ngu_than", "used_during", "period_nguyen", "known", "{}", "[]"),
                ("rel_ao_tac_period", "garment_ao_tac", "used_during", "period_nguyen", "known", "{}", "[]"),
                ("rel_ngu_than_khan_van", "garment_ngu_than", "used_with", "accessory_khan_van", "known", "{}", "[]"),
                ("rel_ao_tac_khan_van", "garment_ao_tac", "used_with", "accessory_khan_van", "known", "{}", "[]"),
                ("rel_ngu_than_quan_trang", "garment_ngu_than", "used_with", "garment_quan_trang", "known", "{}", "[]"),
                ("rel_ngu_than_material", "garment_ngu_than", "made_from", "material_lua_to_tam", "known", "{}", "[]"),
                ("rel_ao_tac_material", "garment_ao_tac", "made_from", "material_gam_the", "known", "{}", "[]"),
            ]

            conn.executemany(
                """
                INSERT INTO entity_relations (
                    id, subject_id, relation_type, object_id, state, qualifiers_json, assertion_ids_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                relations,
            )

            # -------------------------------------------------------------
            # 8. GENERATION PROFILES (generation_profiles_v3)
            # -------------------------------------------------------------
            gen_profiles = [
                (
                    "gen_profile_ngu_than",
                    "garment_ngu_than",
                    json.dumps([
                        {"feature": "construction.closure.direction", "value": "right_over_left", "assertion_ids": ["assert_ngu_than_huu_nham"]},
                        {"feature": "construction.body_panels", "value": 5, "assertion_ids": ["assert_ngu_than_5_panels"]},
                        {"feature": "construction.collar.type", "value": "standing", "assertion_ids": ["assert_ngu_than_co_dung"]},
                        {"feature": "construction.buttons.count", "value": 5, "assertion_ids": ["assert_ngu_than_5_buttons"]},
                        {"feature": "wearing.undergarment.required", "value": True, "assertion_ids": ["assert_bach_y_inner_collar"]},
                    ], ensure_ascii=False),
                    json.dumps([
                        "visual.fabric.color",
                        "visual.fabric.texture",
                        "visual.fabric.pattern",
                        "visual.buttons.material",
                    ], ensure_ascii=False),
                    json.dumps([
                        "left_over_right_closure",
                        "bare_neck_without_collar",
                        "sleeveless",
                        "western_lapel",
                        "exposed_midriff",
                    ], ensure_ascii=False),
                    json.dumps(["source_ngan_nam_ao_mu", "source_bao_tang_lich_su"]),
                    1,
                ),
                (
                    "gen_profile_ao_tac",
                    "garment_ao_tac",
                    json.dumps([
                        {"feature": "construction.closure.direction", "value": "right_over_left", "assertion_ids": ["assert_ngu_than_huu_nham"]},
                        {"feature": "construction.sleeve.type", "value": "tay_thung", "assertion_ids": ["assert_ao_tac_tay_thung"]},
                        {"feature": "construction.collar.type", "value": "standing", "assertion_ids": ["assert_ngu_than_co_dung"]},
                        {"feature": "wearing.undergarment.required", "value": True, "assertion_ids": ["assert_bach_y_inner_collar"]},
                    ], ensure_ascii=False),
                    json.dumps([
                        "visual.fabric.color",
                        "visual.fabric.brocade_motif",
                        "visual.accessories",
                    ], ensure_ascii=False),
                    json.dumps([
                        "left_over_right_closure",
                        "narrow_modern_sleeves",
                        "missing_headwear",
                    ], ensure_ascii=False),
                    json.dumps(["source_ngan_nam_ao_mu", "source_bao_tang_lich_su"]),
                    1,
                ),
            ]

            conn.executemany(
                """
                INSERT INTO generation_profiles_v3 (
                    id, canonical_entity_id, must_preserve_json, may_vary_json,
                    forbidden_json, reference_media_ids_json, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                gen_profiles,
            )

            # -------------------------------------------------------------
            # 9. LEGACY MAPPINGS (legacy_entity_mappings_v3)
            # -------------------------------------------------------------
            legacy_maps = [
                ("garment_types", "ngu_than", "garment_ngu_than", "taxonomy"),
                ("garment_types", "ao_tac", "garment_ao_tac", "taxonomy"),
                ("items", "item_ngu_than_nam_xanh", "garment_ngu_than_nam", "catalog_item"),
                ("items", "item_ngu_than_nu_hong", "garment_ngu_than_nu", "catalog_item"),
                ("items", "item_ao_tac_do", "garment_ao_tac", "catalog_item"),
                ("items", "item_khan_van_den", "accessory_khan_van", "catalog_item"),
                ("items", "item_quan_trang_lua", "garment_quan_trang", "catalog_item"),
            ]

            conn.executemany(
                """
                INSERT INTO legacy_entity_mappings_v3 (
                    legacy_table, legacy_id, entity_id, mapping_kind
                ) VALUES (?, ?, ?, ?)
                ON CONFLICT(legacy_table, legacy_id) DO NOTHING
                """,
                legacy_maps,
            )

    print(f"[SUCCESS] Draft pilot seed checked; existing editorial data preserved:")
    print(f"  - Sources: {len(sources)}")
    print(f"  - Entities: {len(entities)}")
    print(f"  - Attribute Definitions: {len(attr_defs)}")
    print(f"  - Assertions: {len(assertions)}")
    print(f"  - Evidence Links: {len(evidences)}")
    print(f"  - Attribute Values: {len(attr_values)}")
    print(f"  - Relations: {len(relations)}")
    print(f"  - Generation Profiles: {len(gen_profiles)}")
    print(f"  - Legacy Mappings: {len(legacy_maps)}")


if __name__ == "__main__":
    seed_pilot_data()

