"""Studio catalog options authored for the reviewed pilot datasets."""
from __future__ import annotations

import json
from typing import Any


AO_DAI_CLASSIC = """<g id="pilot-ao-dai-classic">
  <path d="M365 350 Q400 338 435 350 L455 430 L492 520 L466 536 L446 474 L442 770 L486 1000 Q442 1030 400 1002 Q358 1030 314 1000 L358 770 L354 474 L334 536 L308 520 L345 430 Z" fill="VAR_COLOR_PRIMARY" stroke="#513B37" stroke-width="4" stroke-linejoin="round"/>
  <path d="M378 347 Q400 372 422 347 L426 392 Q400 405 374 392 Z" fill="#F7F1E8" stroke="#513B37" stroke-width="3"/>
  <path d="M400 402 L400 996" stroke="#F7F1E8" stroke-width="5" opacity="0.9"/>
  <path d="M358 770 Q400 792 442 770" fill="none" stroke="#513B37" stroke-width="3"/>
  <path d="M349 445 Q400 464 451 445" fill="none" stroke="#F7F1E8" stroke-width="2" opacity="0.55"/>
  <circle cx="424" cy="414" r="4" fill="#D3AF68"/><circle cx="430" cy="438" r="4" fill="#D3AF68"/><circle cx="435" cy="462" r="4" fill="#D3AF68"/>
</g>"""

AO_DAI_RAGLAN = """<g id="pilot-ao-dai-raglan">
  <path d="M362 352 Q400 334 438 352 L470 448 L510 540 L479 555 L447 486 L444 774 L492 1004 Q445 1029 400 1000 Q355 1029 308 1004 L356 774 L353 486 L321 555 L290 540 L330 448 Z" fill="VAR_COLOR_PRIMARY" stroke="#3E3542" stroke-width="4" stroke-linejoin="round"/>
  <path d="M373 350 Q400 373 427 350 L430 394 Q400 409 370 394 Z" fill="#EEE9DF" stroke="#3E3542" stroke-width="3"/>
  <path d="M362 354 L331 448 M438 354 L469 448" stroke="#E8D6B3" stroke-width="5" fill="none"/>
  <path d="M400 405 L400 999" stroke="#E8D6B3" stroke-width="4" opacity="0.8"/>
  <path d="M354 775 Q400 794 446 775" fill="none" stroke="#3E3542" stroke-width="3"/>
  <circle cx="427" cy="420" r="4" fill="#D9B46F"/><circle cx="433" cy="446" r="4" fill="#D9B46F"/><circle cx="438" cy="472" r="4" fill="#D9B46F"/>
</g>"""

AO_TU_THAN_RURAL = """<g id="pilot-ao-tu-than-rural">
  <path d="M374 356 Q400 341 426 356 L442 418 L480 518 L452 530 L430 470 L433 720 L488 994 L414 1015 L400 786 L386 1015 L312 994 L367 720 L370 470 L348 530 L320 518 L358 418 Z" fill="VAR_COLOR_PRIMARY" stroke="#352D29" stroke-width="4" stroke-linejoin="round"/>
  <path d="M383 367 Q400 390 417 367 L424 535 Q400 558 376 535 Z" fill="#B5464D" stroke="#352D29" stroke-width="3"/>
  <path d="M366 719 L400 786 L434 719" fill="#D6B768" stroke="#352D29" stroke-width="3"/>
  <path d="M345 716 Q400 742 455 716" fill="none" stroke="#D6B768" stroke-width="12"/>
  <path d="M400 558 L400 1007" stroke="#F1E4CB" stroke-width="4" opacity="0.72"/>
  <path d="M325 990 Q400 1028 475 990" fill="none" stroke="#352D29" stroke-width="3"/>
</g>"""

AO_TU_THAN_HANOI = """<g id="pilot-ao-tu-than-hanoi">
  <path d="M370 352 Q400 339 430 352 L447 420 L488 520 L458 534 L434 472 L437 718 L493 1001 L414 1018 L400 790 L386 1018 L307 1001 L363 718 L366 472 L342 534 L312 520 L353 420 Z" fill="VAR_COLOR_PRIMARY" stroke="#2F2927" stroke-width="4" stroke-linejoin="round"/>
  <path d="M380 360 Q400 385 420 360 L427 540 Q400 565 373 540 Z" fill="#C14E57" stroke="#2F2927" stroke-width="3"/>
  <path d="M350 704 Q400 728 450 704" fill="none" stroke="#DAB85D" stroke-width="13"/>
  <path d="M400 562 L400 1011" stroke="#EFE1C5" stroke-width="4" opacity="0.8"/>
  <path d="M333 960 Q400 982 467 960" fill="none" stroke="#DAB85D" stroke-width="3" opacity="0.85"/>
</g>"""

AO_TU_THAN_STAGE = """<g id="pilot-ao-tu-than-stage">
  <path d="M368 350 Q400 336 432 350 L454 420 L500 520 L468 538 L438 476 L442 710 L500 992 L415 1017 L400 786 L385 1017 L300 992 L358 710 L362 476 L332 538 L300 520 L346 420 Z" fill="VAR_COLOR_PRIMARY" stroke="#3B2A31" stroke-width="4" stroke-linejoin="round"/>
  <path d="M378 358 Q400 382 422 358 L430 536 Q400 566 370 536 Z" fill="#F2C14E" stroke="#3B2A31" stroke-width="3"/>
  <path d="M345 700 Q400 728 455 700" fill="none" stroke="#35A77A" stroke-width="14"/>
  <path d="M400 563 L400 1008" stroke="#F9E7A5" stroke-width="5"/>
  <path d="M320 955 Q400 988 480 955" fill="none" stroke="#F2C14E" stroke-width="8" opacity="0.9"/>
  <circle cx="350" cy="690" r="7" fill="#F2C14E"/><circle cx="450" cy="690" r="7" fill="#F2C14E"/>
</g>"""


CATALOGS: dict[str, dict[str, Any]] = {
    "ao-dai-pilot-1": {
        "garment_type": {
            "id": "ao_dai",
            "name": "Áo dài",
            "description": "Các dáng áo dài tiêu biểu trong bộ dữ liệu thí điểm.",
            "gender_compatibility": "unisex",
            "era": "Thế kỷ 20 - đương đại",
        },
        "items": [
            {
                "id": "item_ao_dai_modern_classic",
                "canonical_entity_id": "variant_ao_dai_modern_classic",
                "name": "Áo dài cổ điển hiện đại",
                "description": "Dáng hai tà, thân ôm vừa và tay raglan; minh họa từ hồ sơ thí điểm Áo dài.",
                "era": "Đương đại",
                "svg": AO_DAI_CLASSIC,
                "variants": [
                    ("var_ao_dai_classic_ngoc", "Xanh ngọc", "#1F6E73", "#D5B36A"),
                    ("var_ao_dai_classic_do", "Đỏ son", "#A2353A", "#E5C985"),
                    ("var_ao_dai_classic_nga", "Trắng ngà", "#E8DFCF", "#9A6B48"),
                ],
            },
            {
                "id": "item_ao_dai_raglan_1958",
                "canonical_entity_id": "variant_ao_dai_raglan_1958_1960",
                "name": "Áo dài Raglan 1958-1960",
                "description": "Dáng tái hiện cấu trúc ráp tay raglan trong hồ sơ lịch sử đang thẩm định.",
                "era": "1958-1960",
                "svg": AO_DAI_RAGLAN,
                "variants": [
                    ("var_ao_dai_raglan_tim", "Tím khói", "#735A7A", "#E8D6B3"),
                    ("var_ao_dai_raglan_lam", "Lam cổ vịt", "#285F68", "#D9B46F"),
                ],
            },
        ],
    },
    "ao-tu-than-pilot-1": {
        "garment_type": {
            "id": "ao_tu_than",
            "name": "Áo tứ thân",
            "description": "Các bộ áo tứ thân lịch sử và sân khấu trong bộ dữ liệu thí điểm.",
            "gender_compatibility": "female",
            "era": "Thế kỷ 17 - đương đại",
        },
        "items": [
            {
                "id": "item_ao_tu_than_rural_north",
                "canonical_entity_id": "ensemble_ao_tu_than_rural_north",
                "name": "Bộ áo tứ thân Bắc Bộ",
                "description": "Bộ minh họa áo tứ thân, yếm và dải thắt lưng trong bối cảnh nông thôn Bắc Bộ.",
                "era": "Thế kỷ 17-19",
                "svg": AO_TU_THAN_RURAL,
                "variants": [
                    ("var_ao_tu_than_rural_nau", "Nâu non", "#5A4638", "#D6B768"),
                    ("var_ao_tu_than_rural_cham", "Chàm sẫm", "#293943", "#C69B53"),
                ],
            },
            {
                "id": "item_ao_tu_than_hanoi_1914",
                "canonical_entity_id": "ensemble_ao_tu_than_hanoi_1914_1920",
                "name": "Áo tứ thân Hà Nội 1914-1920",
                "description": "Minh họa lớp áo sẫm, yếm màu và thắt lưng dựa trên hồ sơ Hà Nội đầu thế kỷ 20.",
                "era": "1914-1920",
                "svg": AO_TU_THAN_HANOI,
                "variants": [
                    ("var_ao_tu_than_hanoi_linh", "Nâu lĩnh", "#463A36", "#DAB85D"),
                    ("var_ao_tu_than_hanoi_den", "Đen huyền", "#25272C", "#CDAA58"),
                ],
            },
            {
                "id": "item_ao_tu_than_modern_stage",
                "canonical_entity_id": "variant_ao_tu_than_modern_stage",
                "name": "Áo tứ thân sân khấu hiện đại",
                "description": "Bản phối màu biểu diễn hiện đại, không được gắn nhãn tái hiện lịch sử chính xác.",
                "era": "Đương đại",
                "svg": AO_TU_THAN_STAGE,
                "variants": [
                    ("var_ao_tu_than_stage_do", "Đỏ gấc", "#A23B3B", "#F2C14E"),
                    ("var_ao_tu_than_stage_xanh", "Xanh lá", "#34725B", "#F2C14E"),
                    ("var_ao_tu_than_stage_vang", "Vàng nghệ", "#C58B2A", "#A23B3B"),
                ],
            },
        ],
    },
}


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _inserted(cursor) -> int:
    return 1 if cursor.rowcount == 1 else 0


def import_catalog_options(conn, dataset_version: str) -> dict[str, int]:
    catalog = CATALOGS[dataset_version]
    garment_type = catalog["garment_type"]
    counts = {
        "garment_types": 0,
        "catalog_items": 0,
        "item_variants": 0,
        "asset_layers": 0,
        "legacy_mappings": 0,
        "renderable_items": 0,
        "renderable_variants": 0,
        "render_profiles": 0,
    }
    counts["garment_types"] += _inserted(conn.execute(
        """INSERT INTO garment_types
        (id,name,description,gender_compatibility,era,slot_schema,is_active)
        VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING""",
        (
            garment_type["id"], garment_type["name"], garment_type["description"],
            garment_type["gender_compatibility"], garment_type["era"],
            _json(["outerwear", "bottom", "headwear", "accessory_front", "footwear"]),
        ),
    ))

    for item in catalog["items"]:
        metadata = {
            "pilot_dataset": dataset_version,
            "canonical_entity_id": item["canonical_entity_id"],
            "visual_status": "illustration",
        }
        counts["catalog_items"] += _inserted(conn.execute(
            """INSERT INTO items
            (id,garment_type_id,slot,name,gender,description,era,cultural_notes,is_signature,is_published,metadata)
            VALUES(?,?,'outerwear',?,'unisex',?,?,?,1,1,?) ON CONFLICT(id) DO NOTHING""",
            (
                item["id"], garment_type["id"], item["name"], item["description"], item["era"],
                "Minh họa lựa chọn Studio; dữ liệu văn hóa liên kết vẫn đang được thẩm định.", _json(metadata),
            ),
        ))

        default_variant_id = item["variants"][0][0]
        for index, (variant_id, color_name, hex_color, secondary_hex) in enumerate(item["variants"]):
            counts["item_variants"] += _inserted(conn.execute(
                """INSERT INTO item_variants
                (id,item_id,color_name,hex_color,secondary_hex,material,thickness_level,pattern_description,is_default)
                VALUES(?,?,?,?,?,'Lụa minh họa','light','Màu minh họa từ hồ sơ thí điểm',?)
                ON CONFLICT(id) DO NOTHING""",
                (variant_id, item["id"], color_name, hex_color, secondary_hex, int(index == 0)),
            ))

        layer_id = f"layer_{item['id']}"
        counts["asset_layers"] += _inserted(conn.execute(
            """INSERT INTO asset_layers
            (id,item_id,variant_id,slot,z_index,anchor_x,anchor_y,scale_x,scale_y,layer_type,svg_content,color_mask_rule)
            VALUES(?,?,?,'outerwear',40,0,0,1,1,'svg',?,'{}') ON CONFLICT(id) DO NOTHING""",
            (layer_id, item["id"], default_variant_id, item["svg"]),
        ))
        counts["legacy_mappings"] += _inserted(conn.execute(
            """INSERT INTO legacy_entity_mappings_v3(legacy_table,legacy_id,entity_id,mapping_kind)
            VALUES('items',?,?, 'catalog_item') ON CONFLICT(legacy_table,legacy_id) DO NOTHING""",
            (item["id"], item["canonical_entity_id"]),
        ))

        renderable_id = f"renderable_{item['id']}"
        counts["renderable_items"] += _inserted(conn.execute(
            """INSERT INTO renderable_items_v3
            (id,canonical_entity_id,slot,name,asset_format,metadata_json,is_active)
            VALUES(?,?,'outerwear',?,'svg',?,1) ON CONFLICT(id) DO NOTHING""",
            (renderable_id, item["canonical_entity_id"], item["name"], _json({"legacy_item_id": item["id"]})),
        ))
        for variant_id, color_name, hex_color, _ in item["variants"]:
            render_variant_id = f"render_{variant_id}"
            counts["renderable_variants"] += _inserted(conn.execute(
                """INSERT INTO renderable_variants_v3
                (id,renderable_item_id,color_name,hex_color,material,style_json,is_default)
                VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
                (
                    render_variant_id, renderable_id, color_name, hex_color, "Lụa minh họa",
                    _json({"legacy_variant_id": variant_id}), int(variant_id == default_variant_id),
                ),
            ))
            rendered_svg = item["svg"].replace("VAR_COLOR_PRIMARY", hex_color)
            standalone_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200">{rendered_svg}</svg>'
            counts["render_profiles"] += _inserted(conn.execute(
                """INSERT INTO render_profiles_v3
                (id,renderable_item_id,variant_id,pose,z_index,svg_content,transform_json)
                VALUES(?,?,?,'front_01',40,?,'{}') ON CONFLICT(id) DO NOTHING""",
                (f"profile_{render_variant_id}", renderable_id, render_variant_id, standalone_svg),
            ))
    return counts
