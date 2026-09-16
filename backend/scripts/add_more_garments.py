"""
Script bổ sung thêm danh mục áo cổ phục phong phú (Giao lĩnh, Viên lĩnh, Áo ngũ thân tím Huế,
Áo ngũ thân xanh rêu, Áo ngũ thân bạch thư sinh, Áo tấc hoàng yến, Áo ngũ thân Remix)
kèm các lớp SVG chất lượng cao vào database SQLite viet_phuc_remix.db.
"""

import os
import sqlite3
import json

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH = os.path.join(BASE_DIR, "viet_phuc_remix.db")

# ================= SVG CHO CÁC MẪU ÁO MỚI =================

# 1. ÁO GIAO LĨNH LAM KHÓI (Cổ chéo vạt giao nhau thời Lê - Nguyễn)
SVG_GIAO_LINH_LAM = '''<g id="layer-giao-linh-lam">
  <defs>
    <linearGradient id="giaoLinhLamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A5F"/>
      <stop offset="40%" stop-color="#2D5B8C"/>
      <stop offset="80%" stop-color="#21426B"/>
      <stop offset="100%" stop-color="#142B47"/>
    </linearGradient>
    <pattern id="cloudWavePattern" width="70" height="70" patternUnits="userSpaceOnUse">
      <path d="M10 35 Q25 20 40 35 Q55 50 70 35" fill="none" stroke="#63B3ED" stroke-width="0.8" opacity="0.3"/>
      <circle cx="40" cy="35" r="8" fill="none" stroke="#63B3ED" stroke-width="0.8" opacity="0.25"/>
    </pattern>
  </defs>

  <!-- Tay áo thụng vừa phải -->
  <path d="M312 398 L215 620 L260 635 L332 460 Z" fill="url(#giaoLinhLamGrad)" stroke="#0E1C30" stroke-width="2"/>
  <path d="M488 398 Q525 480 495 535 L442 565 L428 530 Q470 490 465 430 Z" fill="url(#giaoLinhLamGrad)" stroke="#0E1C30" stroke-width="2"/>

  <!-- Thân áo vạt dài -->
  <path d="M312 398 Q400 380 488 398 L524 855 Q400 875 276 855 L312 398 Z" fill="url(#giaoLinhLamGrad)" stroke="#0E1C30" stroke-width="2.2"/>
  <path d="M312 398 Q400 380 488 398 L524 855 Q400 875 276 855 L312 398 Z" fill="url(#cloudWavePattern)"/>

  <!-- ================= CỔ ÁO GIAO LĨNH CHÉO (HỮU NHẬM) ================= -->
  <!-- Viền áo lót trắng bên trong giao chéo -->
  <path d="M366 345 L420 440 L414 445 L360 350 Z" fill="#FFFFFF" stroke="#CBD5E0" stroke-width="1"/>
  <path d="M434 345 L380 440 L386 445 L440 350 Z" fill="#FFFFFF" stroke="#CBD5E0" stroke-width="1"/>

  <!-- Vạt áo giao lĩnh bên trái đè chéo sang sườn phải -->
  <path d="M368 348 L448 468 L440 475 L360 355 Z" fill="#152840" stroke="#0A1422" stroke-width="1.8"/>
  <path d="M432 348 L352 468" stroke="#0A1422" stroke-width="2.5" fill="none"/>
  <path d="M368 348 L448 468" stroke="#0A1422" stroke-width="2.5" fill="none"/>
  <!-- Vạt ngoài phủ xuống sườn phải -->
  <path d="M448 468 L460 855" stroke="#0A1422" stroke-width="2.5" fill="none"/>

  <!-- Thắt lưng lụa (Đại đới) thắt ngang eo với nút thắt cổ điển -->
  <rect x="330" y="520" width="140" height="24" rx="4" fill="#B7791F" stroke="#744210" stroke-width="1.5"/>
  <rect x="388" y="516" width="24" height="32" rx="3" fill="#D69E2E" stroke="#744210" stroke-width="1.5"/>
  <!-- Dải lụa thắt buông rủ xuống trước bụng -->
  <path d="M394 548 L390 690 L400 685 L404 548 Z" fill="#D69E2E" stroke="#744210" stroke-width="1.2"/>
  <path d="M400 548 L406 670 L414 665 L410 548 Z" fill="#B7791F" stroke="#744210" stroke-width="1.2"/>
</g>'''


# 2. ÁO VIÊN LĨNH ĐỎ CHU VIỀN (Cổ tròn Bàn lĩnh Sĩ tử Khoa bảng thời Lý - Trần - Lê)
SVG_VIEN_LINH_DO = '''<g id="layer-vien-linh-do">
  <defs>
    <linearGradient id="vienLinhDoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#821E1E"/>
      <stop offset="40%" stop-color="#C53030"/>
      <stop offset="80%" stop-color="#9B2C2C"/>
      <stop offset="100%" stop-color="#5A1515"/>
    </linearGradient>
    <radialGradient id="goldButtonVienLinh" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFF3C4"/>
      <stop offset="50%" stop-color="#ECC94B"/>
      <stop offset="100%" stop-color="#975A16"/>
    </radialGradient>
  </defs>

  <!-- Tay áo rộng thư sinh -->
  <path d="M312 398 L225 615 L268 630 L332 455 Z" fill="url(#vienLinhDoGrad)" stroke="#4A0E0E" stroke-width="2"/>
  <path d="M488 398 Q525 480 495 535 L442 565 L428 530 Q470 490 465 430 Z" fill="url(#vienLinhDoGrad)" stroke="#4A0E0E" stroke-width="2"/>

  <!-- Thân áo dáng thụng nho nhã -->
  <path d="M312 398 Q400 375 488 398 L524 855 Q400 875 276 855 L312 398 Z" fill="url(#vienLinhDoGrad)" stroke="#4A0E0E" stroke-width="2.2"/>

  <!-- Nếp vải uyển chuyển -->
  <path d="M340 450 Q355 660 348 855" stroke="#4A0E0E" stroke-width="3" fill="none" opacity="0.45"/>
  <path d="M450 460 Q455 660 452 855" stroke="#4A0E0E" stroke-width="3" fill="none" opacity="0.45"/>

  <!-- ================= CỔ TRÒN VIÊN LĨNH (BÀN LĨNH) ================= -->
  <!-- Viền áo lót trắng bên trong -->
  <circle cx="400" cy="380" r="34" fill="none" stroke="#FFFFFF" stroke-width="3"/>
  <!-- Cổ tròn ôm sát chân cổ cài cúc vai phải -->
  <circle cx="400" cy="380" r="32" fill="none" stroke="#D69E2E" stroke-width="4"/>
  <circle cx="400" cy="380" r="30" fill="none" stroke="#5A1515" stroke-width="2"/>

  <!-- Đường xẻ cài cúc bên vai phải đặc trưng Viên Lĩnh -->
  <path d="M430 380 Q450 405 460 440" stroke="#4A0E0E" stroke-width="2.5" fill="none"/>

  <!-- 2 Khuy vàng cài bên vai phải -->
  <circle cx="432" cy="382" r="5" fill="url(#goldButtonVienLinh)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
  <circle cx="448" cy="410" r="5" fill="url(#goldButtonVienLinh)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>

  <!-- Bổ tử vuông trước ngực (Họa tiết chim hạc khoa bảng) -->
  <rect x="360" y="440" width="80" height="80" rx="4" fill="#1A202C" stroke="#D69E2E" stroke-width="2"/>
  <circle cx="400" cy="480" r="28" fill="none" stroke="#D69E2E" stroke-width="1.2" stroke-dasharray="4,2"/>
  <!-- Chim hạc tung cánh -->
  <path d="M390 485 Q400 465 410 485 M380 475 Q400 472 420 475 M400 470 L400 495" stroke="#ECC94B" stroke-width="1.6" fill="none"/>
</g>'''


# 3. ÁO NGŨ THÂN NỮ TÍM HUẾ (Mộng mơ, quý phái, lụa sa trơn)
SVG_NGU_THAN_TIM_HUE = '''<g id="layer-ngu-than-tim-hue">
  <defs>
    <linearGradient id="silkTimHue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#44286E"/>
      <stop offset="35%" stop-color="#6B46C1"/>
      <stop offset="70%" stop-color="#553C9A"/>
      <stop offset="100%" stop-color="#321A4D"/>
    </linearGradient>
    <radialGradient id="pearlTimButton" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#E9D8FD"/>
      <stop offset="85%" stop-color="#B794F4"/>
      <stop offset="100%" stop-color="#553C9A"/>
    </radialGradient>
  </defs>

  <!-- Tay áo ôm nhẹ nhàng duyên dáng -->
  <path d="M315 405 L252 585 L284 595 L332 450 Z" fill="url(#silkTimHue)" stroke="#2D154B" stroke-width="1.6"/>
  <path d="M485 405 Q520 480 495 535 L445 565 L430 530 Q470 490 465 430 Z" fill="url(#silkTimHue)" stroke="#2D154B" stroke-width="1.6"/>

  <!-- Thân áo ngũ thân chiết eo thanh tao xứ Huế -->
  <path d="M315 405 Q400 388 485 405 L512 850 Q400 870 288 850 L315 405 Z" fill="url(#silkTimHue)" stroke="#2D154B" stroke-width="2"/>

  <!-- Vạt áo hữu nhậm lượn cong mềm mại -->
  <path d="M426 388 Q450 435 458 475 L460 850" stroke="#230E3D" stroke-width="2.5" fill="none"/>
  <path d="M425 388 Q449 435 457 475 L459 850" stroke="#E9D8FD" stroke-width="1" fill="none" opacity="0.6"/>

  <!-- Cổ đứng thanh mảnh có viền áo lót trắng hé lộ -->
  <path d="M372 342 Q400 348 428 342 L430 365 Q400 371 370 365 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2"/>
  <path d="M373 345 Q400 351 427 345 L430 390 Q400 400 370 390 Z" fill="url(#silkTimHue)" stroke="#2D154B" stroke-width="1.8"/>

  <!-- 5 Khuy ngọc trai tím Huế -->
  <circle cx="422" cy="363" r="4.5" fill="url(#pearlTimButton)"/>
  <circle cx="429" cy="395" r="4.5" fill="url(#pearlTimButton)"/>
  <circle cx="444" cy="434" r="4.5" fill="url(#pearlTimButton)"/>
  <circle cx="455" cy="476" r="4.5" fill="url(#pearlTimButton)"/>
  <circle cx="457" cy="528" r="4.5" fill="url(#pearlTimButton)"/>
</g>'''


# 4. ÁO NGŨ THÂN XANH RÊU CỔ MỘC (Thanh lịch, trầm ổn)
SVG_NGU_THAN_XANH_REU = '''<g id="layer-ngu-than-xanh-reu">
  <defs>
    <linearGradient id="silkReuGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1C4532"/>
      <stop offset="40%" stop-color="#276749"/>
      <stop offset="75%" stop-color="#22543D"/>
      <stop offset="100%" stop-color="#122A1E"/>
    </linearGradient>
    <radialGradient id="goldButtonReu" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFF3C4"/>
      <stop offset="50%" stop-color="#ECC94B"/>
      <stop offset="100%" stop-color="#744210"/>
    </radialGradient>
  </defs>

  <path d="M312 400 L245 585 L280 596 L332 450 Z" fill="url(#silkReuGrad)" stroke="#0D2017" stroke-width="1.8"/>
  <path d="M488 400 Q525 480 500 535 L445 565 L430 530 Q475 490 468 430 Z" fill="url(#silkReuGrad)" stroke="#0D2017" stroke-width="1.8"/>
  <path d="M312 400 Q400 380 488 400 L518 845 Q400 865 282 845 L312 400 Z" fill="url(#silkReuGrad)" stroke="#0D2017" stroke-width="2.2"/>

  <!-- Vạt áo hữu nhậm sang phải -->
  <path d="M428 388 Q452 435 462 475 L464 850" stroke="#08140E" stroke-width="3" fill="none"/>
  <path d="M427 388 Q451 435 461 475 L463 850" stroke="#9AE6B4" stroke-width="1" fill="none" opacity="0.4"/>

  <!-- Cổ đứng lập lĩnh -->
  <path d="M370 342 Q400 348 430 342 L433 365 Q400 371 367 365 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2"/>
  <path d="M371 345 Q400 351 429 345 L432 390 Q400 400 368 390 Z" fill="url(#silkReuGrad)" stroke="#0D2017" stroke-width="2"/>

  <!-- 5 Khuy cài đồng hoàng gia -->
  <circle cx="422" cy="362" r="5" fill="url(#goldButtonReu)"/>
  <circle cx="430" cy="394" r="5" fill="url(#goldButtonReu)"/>
  <circle cx="446" cy="432" r="5" fill="url(#goldButtonReu)"/>
  <circle cx="458" cy="474" r="5" fill="url(#goldButtonReu)"/>
  <circle cx="460" cy="525" r="5" fill="url(#goldButtonReu)"/>
</g>'''


# 5. ÁO TẤC VÀNG HOÀNG YẾN (Lễ phục hoàng tộc, gấm dệt hoa cúc)
SVG_AO_TAC_VANG = '''<g id="layer-ao-tac-vang">
  <defs>
    <linearGradient id="silkHoangYen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#975A16"/>
      <stop offset="35%" stop-color="#D69E2E"/>
      <stop offset="70%" stop-color="#B7791F"/>
      <stop offset="100%" stop-color="#744210"/>
    </linearGradient>
  </defs>

  <!-- Tay thụng rộng thênh thang bên trái -->
  <path d="M312 398 L165 670 Q210 690 280 675 L335 460 Z" fill="url(#silkHoangYen)" stroke="#55300B" stroke-width="2"/>
  <path d="M165 670 Q210 690 280 675" stroke="#ECC94B" stroke-width="2" opacity="0.7"/>

  <!-- Tay thụng bên phải -->
  <path d="M488 398 L635 670 Q590 690 520 675 L465 460 Z" fill="url(#silkHoangYen)" stroke="#55300B" stroke-width="2"/>
  <path d="M635 670 Q590 690 520 675" stroke="#ECC94B" stroke-width="2" opacity="0.7"/>

  <!-- Thân áo tấc dài quá gối -->
  <path d="M312 398 Q400 375 488 398 L532 875 Q400 895 268 875 L312 398 Z" fill="url(#silkHoangYen)" stroke="#55300B" stroke-width="2.5"/>

  <!-- Vạt áo hữu nhậm -->
  <path d="M428 388 Q455 440 466 480 L468 880" stroke="#3D2207" stroke-width="3" fill="none"/>

  <!-- Cổ đứng có viền áo lót trắng -->
  <path d="M370 342 Q400 348 430 342 L433 365 Q400 371 367 365 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2"/>
  <path d="M371 345 Q400 351 429 345 L432 390 Q400 400 368 390 Z" fill="url(#silkHoangYen)" stroke="#55300B" stroke-width="2"/>

  <!-- 5 Khuy ngọc bích viền vàng -->
  <circle cx="423" cy="363" r="5" fill="#285E61" stroke="#ECC94B" stroke-width="1.5"/>
  <circle cx="431" cy="395" r="5" fill="#285E61" stroke="#ECC94B" stroke-width="1.5"/>
  <circle cx="448" cy="434" r="5" fill="#285E61" stroke="#ECC94B" stroke-width="1.5"/>
  <circle cx="460" cy="476" r="5" fill="#285E61" stroke="#ECC94B" stroke-width="1.5"/>
  <circle cx="463" cy="528" r="5" fill="#285E61" stroke="#ECC94B" stroke-width="1.5"/>
</g>'''


def add_more_garments():
    print(f"Connecting to database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Bổ sung Garment Types mới nếu chưa có
    cursor.execute("""
        INSERT OR IGNORE INTO garment_types (id, name, description, gender_compatibility, era, slot_schema, is_active)
        VALUES 
        ('giao_linh', 'Áo Giao Lĩnh (Vạt chéo)', 'Mẫu cổ phục vạt chéo kinh điển thời Lê - Nguyễn. Cổ áo giao chéo nhau trước ngực, có đai lưng lụa thả dài thướt tha.', 'unisex', 'Lê - Nguyễn', '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front"]', 1),
        ('vien_linh', 'Áo Viên Lĩnh (Cổ tròn Bàn lĩnh)', 'Trang phục cổ tròn đặc trưng thời Lý - Trần - Lê, biểu tượng của quan viên, sĩ tử khoa bảng và văn nhân nho nhã.', 'unisex', 'Lý - Trần - Lê', '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front"]', 1)
    """)
    print("Checked/Inserted new garment types.")

    # 2. Danh sách các mẫu ÁO MỚI (Items)
    new_items = [
        ('item_giao_linh_lam', 'giao_linh', 'outerwear', 'Áo Giao Lĩnh Lam Khói (Thời Lê)', 'unisex', 'Cổ áo vạt chéo giao nhau trước ngực, sắc xanh lam khói cổ điển, thắt đai lưng lụa nho nhã.', 'Lê', 1, json.dumps({"style": "cổ phong", "era": "Lê"})),
        ('item_vien_linh_do', 'vien_linh', 'outerwear', 'Áo Viên Lĩnh Đỏ Chu Viền (Sĩ tử)', 'unisex', 'Phom cổ tròn cài khuy vai truyền thống thời Lê, bổ tử thêu chim hạc đỗ đạt khoa cử.', 'Lê', 1, json.dumps({"style": "khoa cử", "era": "Lê"})),
        ('item_ngu_than_tim_hue', 'ngu_than', 'outerwear', 'Áo ngũ thân Nữ Tím Mộng Xứ Huế', 'female', 'Sắc tím hoàng cung trầm mặc dịu dàng, lụa sa mềm mại ôm dáng thanh tao.', 'Nguyễn', 1, json.dumps({"style": "quý phái", "era": "Nguyễn"})),
        ('item_ngu_than_xanh_reu', 'ngu_than', 'outerwear', 'Áo ngũ thân Xanh Rêu Cổ Mộc', 'male', 'Sắc xanh rêu tự nhiên của cỏ cây non ngàn, chất liệu đũi tơ tằm cổ điển.', 'Nguyễn', 1, json.dumps({"style": "thanh nhã", "era": "Nguyễn"})),
        ('item_ao_tac_vang', 'ao_tac', 'outerwear', 'Áo tấc Vàng Hoàng Yến Hoàng Tộc', 'unisex', 'Lễ phục tay thụng sắc vàng rực rỡ, may bằng gấm dệt hoa cúc triều đình Huế.', 'Nguyễn', 1, json.dumps({"style": "hoàng tộc", "era": "Nguyễn"}))
    ]

    for item in new_items:
        cursor.execute("""
            INSERT OR REPLACE INTO items (id, garment_type_id, slot, name, gender, description, era, is_published, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, item)
    print("Inserted 5 new shirt items.")

    # 3. Biến thể màu (Item Variants)
    new_variants = [
        ('var_giao_linh_lam', 'item_giao_linh_lam', 'Lam Khói Cổ Điển', '#2D5B8C', '#1E3A5F', 'Lụa tơ tằm vân mây', 'medium', 'Họa tiết mây cuộn sóng nước', 1),
        ('var_vien_linh_do', 'item_vien_linh_do', 'Đỏ Chu Sa Sĩ Tử', '#C53030', '#821E1E', 'Gấm thượng hạng', 'heavy', 'Bổ tử hạc trắng khoa cử', 1),
        ('var_ngu_than_tim_hue', 'item_ngu_than_tim_hue', 'Tím Mộng Xứ Huế', '#6B46C1', '#44286E', 'Lụa sa trơn cao cấp', 'light', 'Mặt vải bóng óng ả', 1),
        ('var_ngu_than_xanh_reu', 'item_ngu_than_xanh_reu', 'Xanh Rêu Cổ Mộc', '#276749', '#1C4532', 'Đũi tơ tằm dệt thủ công', 'medium', 'Vân đũi mộc mạc', 1),
        ('var_ao_tac_vang', 'item_ao_tac_vang', 'Vàng Hoàng Yến', '#D69E2E', '#975A16', 'Gấm thêu hoa cúc vàng', 'heavy', 'Hoa cúc đại đóa triều Nguyễn', 1)
    ]

    for var in new_variants:
        cursor.execute("""
            INSERT OR REPLACE INTO item_variants (id, item_id, color_name, hex_color, secondary_hex, material, thickness_level, pattern_description, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, var)
    print("Inserted 5 new variants.")

    # 4. Gắn vào các bối cảnh (Item Occasions)
    new_occasions = [
        ('item_giao_linh_lam', 'ky_yeu', 96, 'Rất được học sinh - sinh viên yêu thích cho phong cách tiên khí, cổ phong tao nhã.'),
        ('item_vien_linh_do', 'ky_yeu', 94, 'Trang phục đỗ đạt khoa bảng, ý nghĩa vinh quy bái tổ cho lễ tốt nghiệp.'),
        ('item_ngu_than_tim_hue', 'dao_pho', 97, 'Sắc tím dịu dàng tôn nét nữ tính khi dạo cảnh di tích cổ kính.'),
        ('item_ngu_than_xanh_reu', 'tet', 93, 'Sắc xanh tươi mới mang lại sinh khí và sự an lành cho năm mới.'),
        ('item_ao_tac_vang', 'cuoi_hoi', 99, 'Sắc vàng quyền quý kết hợp hài hòa trong ngày trọng đại.')
    ]

    for io in new_occasions:
        cursor.execute("""
            INSERT OR REPLACE INTO item_occasions (item_id, occasion_id, priority_score, editorial_note)
            VALUES (?, ?, ?, ?)
        """, io)
    print("Linked to occasions.")

    # 5. Asset Layers SVG đồ họa cao cấp
    new_layers = [
        ('layer_giao_linh_lam', 'item_giao_linh_lam', 'var_giao_linh_lam', None, 'outerwear', 40, 0, 0, 1, 1, 'svg', SVG_GIAO_LINH_LAM),
        ('layer_vien_linh_do', 'item_vien_linh_do', 'var_vien_linh_do', None, 'outerwear', 40, 0, 0, 1, 1, 'svg', SVG_VIEN_LINH_DO),
        ('layer_ngu_than_tim_hue', 'item_ngu_than_tim_hue', 'var_ngu_than_tim_hue', None, 'outerwear', 40, 0, 0, 1, 1, 'svg', SVG_NGU_THAN_TIM_HUE),
        ('layer_ngu_than_xanh_reu', 'item_ngu_than_xanh_reu', 'var_ngu_than_xanh_reu', None, 'outerwear', 40, 0, 0, 1, 1, 'svg', SVG_NGU_THAN_XANH_REU),
        ('layer_ao_tac_vang', 'item_ao_tac_vang', 'var_ao_tac_vang', None, 'outerwear', 40, 0, 0, 1, 1, 'svg', SVG_AO_TAC_VANG)
    ]

    for layer in new_layers:
        cursor.execute("""
            INSERT OR REPLACE INTO asset_layers (id, item_id, variant_id, avatar_id, slot, z_index, anchor_x, anchor_y, scale_x, scale_y, layer_type, svg_content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, layer)
    print("Inserted 5 high-fidelity SVG asset layers.")

    conn.commit()
    conn.close()
    print("SUCCESSFULLY EXPANDED GARMENT COLLECTION!")


if __name__ == "__main__":
    add_more_garments()

