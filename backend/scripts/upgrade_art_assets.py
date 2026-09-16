"""
Script nâng cấp toàn diện chất lượng đồ họa vector SVG cho Avatar và các lớp trang phục 2D.
Cập nhật trực tiếp vào cơ sở dữ liệu SQLite viet_phuc_remix.db và supabase/seed.sql.
"""

import os
import sqlite3

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DB_PATH = os.path.join(BASE_DIR, "viet_phuc_remix.db")

# 1. AVATAR NAM CHUẨN (Đĩnh đạc, thanh tú, chuẩn tỷ lệ giải phẫu học)
AVATAR_NAM_SVG = '''<svg viewBox="0 0 800 1200" width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Gradient da tự nhiên ấm áp -->
    <radialGradient id="skinGradNamHigh" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#FFF3EB"/>
      <stop offset="60%" stop-color="#FCE1D2"/>
      <stop offset="100%" stop-color="#F2CBB5"/>
    </radialGradient>
    <!-- Gradient bóng đổ cơ thể -->
    <linearGradient id="skinShadowGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8B59B"/>
      <stop offset="100%" stop-color="#D99E82"/>
    </linearGradient>
    <!-- Gradient tóc đen ánh mượt -->
    <linearGradient id="hairGradNamHigh" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2D2826"/>
      <stop offset="40%" stop-color="#1A1817"/>
      <stop offset="100%" stop-color="#0E0C0C"/>
    </linearGradient>
    <!-- Gradient mống mắt sâu thẳm -->
    <radialGradient id="eyeIrisGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#543324"/>
      <stop offset="70%" stop-color="#26160F"/>
      <stop offset="100%" stop-color="#120A06"/>
    </radialGradient>
    <!-- Gradient môi tự nhiên -->
    <linearGradient id="lipsGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D47E74"/>
      <stop offset="100%" stop-color="#BA5E54"/>
    </linearGradient>
    <!-- Nền vầng sáng cổ phong hoàng cung -->
    <radialGradient id="bgCourtGlow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#FFFDF7" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#F6EFE3" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#E8DDD0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- ================= VÙNG NỀN & BÓNG ĐỔ SÀN ================= -->
  <circle cx="400" cy="560" r="330" fill="url(#bgCourtGlow)"/>
  <circle cx="400" cy="560" r="325" fill="none" stroke="#D69E2E" stroke-width="1.2" stroke-dasharray="8,6" opacity="0.45"/>
  <circle cx="400" cy="560" r="320" fill="none" stroke="#B7791F" stroke-width="0.6" opacity="0.25"/>
  <!-- Hoa văn thủy ba / hoa sen cách điệu chìm ở nền -->
  <g opacity="0.1" stroke="#8C5325" stroke-width="1.5" fill="none">
    <path d="M400 320 C420 360 450 380 400 420 C350 380 380 360 400 320 Z"/>
    <path d="M400 700 C430 730 460 760 400 800 C340 760 370 730 400 700 Z"/>
    <circle cx="400" cy="560" r="160"/>
  </g>
  <!-- Bóng đổ mặt đất -->
  <ellipse cx="400" cy="1080" rx="200" ry="24" fill="#2D3748" opacity="0.14"/>
  <ellipse cx="400" cy="1080" rx="140" ry="15" fill="#1A202C" opacity="0.12"/>

  <!-- ================= CHÂN & CƠ THỂ PHÍA DƯỚI ================= -->
  <g id="avatar-legs">
    <!-- Chân trái -->
    <path d="M358 740 L345 1060 L378 1060 L395 740 Z" fill="#F0C7B0"/>
    <!-- Chân phải -->
    <path d="M442 740 L455 1060 L422 1060 L405 740 Z" fill="#E8BD9F"/>
    <!-- Bóng giữa 2 chân -->
    <path d="M395 740 L400 860 L405 740 Z" fill="#D99E82"/>
  </g>

  <!-- ================= TAY TRÁI (Thả tự nhiên cạnh sườn) ================= -->
  <g id="avatar-arm-left">
    <!-- Cánh tay trái -->
    <path d="M310 405 Q285 500 272 590 L298 595 Q312 505 330 430 Z" fill="url(#skinGradNamHigh)"/>
    <!-- Bóng sườn cánh tay -->
    <path d="M298 595 Q312 505 330 430 L320 425 Q302 505 288 592 Z" fill="url(#skinShadowGrad)" opacity="0.4"/>
    <!-- Bàn tay trái thả lỏng tao nhã -->
    <!-- Mu bàn tay -->
    <path d="M272 590 Q265 615 270 635 Q278 642 288 638 Q296 630 298 595 Z" fill="#FCE1D2"/>
    <!-- Ngón tay thon dài khép nhẹ -->
    <path d="M270 635 Q273 646 278 645 Q282 642 281 635" stroke="#E2A992" stroke-width="1.2" fill="#FCE1D2"/>
    <path d="M276 637 Q280 648 285 647 Q288 643 286 636" stroke="#E2A992" stroke-width="1.2" fill="#FCE1D2"/>
    <path d="M282 636 Q286 646 290 644 Q293 640 291 633" stroke="#E2A992" stroke-width="1.2" fill="#FCE1D2"/>
  </g>

  <!-- ================= CỔ VÀ KHUÔN NGỰC ================= -->
  <g id="avatar-neck-chest">
    <!-- Bờ vai và cơ ngực kết nối liền mạch với cổ áo -->
    <path d="M320 405 Q360 382 400 382 Q440 382 480 405 L460 480 Q400 495 340 480 Z" fill="url(#skinGradNamHigh)"/>
    <!-- Cổ đĩnh đạc vươn cao, thanh thoát -->
    <path d="M374 315 L372 388 Q400 400 428 388 L426 315 Z" fill="url(#skinGradNamHigh)"/>
    <!-- Bóng đổ dưới cằm -->
    <path d="M374 315 Q400 338 426 315 L427 335 Q400 355 373 335 Z" fill="url(#skinShadowGrad)" opacity="0.6"/>
    <!-- Hõm xương quai xanh tinh tế -->
    <path d="M388 388 Q400 394 412 388" stroke="#DDA892" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>

  <!-- ================= KHUÔN MẶT ĐIỂN TRAI ĐĨNH ĐẠC ================= -->
  <g id="avatar-head">
    <!-- Đường viền khuôn mặt chữ điền thanh thoát -->
    <path d="M336 225 C332 270 338 300 365 325 C385 342 415 342 435 325 C462 300 468 270 464 225 C460 175 340 175 336 225 Z" fill="url(#skinGradNamHigh)"/>
    
    <!-- Tai trái & Tai phải có cấu trúc giải phẫu mềm mại -->
    <g id="avatar-ears">
      <!-- Tai trái -->
      <path d="M338 245 C328 255 326 280 336 295 C339 299 342 295 340 285 C335 275 336 258 340 250 Z" fill="#FCE1D2" stroke="#E2A992" stroke-width="1"/>
      <path d="M334 260 C331 268 333 278 337 282" stroke="#DDA892" stroke-width="1.2" fill="none"/>
      <!-- Tai phải -->
      <path d="M462 245 C472 255 474 280 464 295 C461 299 458 295 460 285 C465 275 464 258 460 250 Z" fill="#FCE1D2" stroke="#E2A992" stroke-width="1"/>
      <path d="M466 260 C469 268 467 278 463 282" stroke="#DDA892" stroke-width="1.2" fill="none"/>
    </g>

    <!-- Mái tóc đen chải mượt tự nhiên -->
    <path d="M334 235 C330 200 360 168 400 166 C440 168 470 200 466 235 C460 210 440 195 400 195 C360 195 340 210 334 235 Z" fill="url(#hairGradNamHigh)"/>
    <!-- Tóc mai hai bên gọn gàng -->
    <path d="M336 230 L340 262 L345 235 Z" fill="url(#hairGradNamHigh)"/>
    <path d="M464 230 L460 262 L455 235 Z" fill="url(#hairGradNamHigh)"/>

    <!-- Lông mày kiếm (Kiếm mi) sắc sảo, nam tính -->
    <path d="M355 248 C368 244 382 244 392 249" stroke="#1F1A18" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <path d="M355 248 C368 244 382 244 392 249" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M445 248 C432 244 418 244 408 249" stroke="#1F1A18" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <path d="M445 248 C432 244 418 244 408 249" stroke="#4A3B32" stroke-width="2" stroke-linecap="round" fill="none"/>

    <!-- Đôi mắt sáng ngời, có thần thái trang nhã -->
    <!-- Mắt trái -->
    <g id="left-eye">
      <!-- Tròng trắng -->
      <path d="M360 266 C368 260 384 260 392 267 C384 274 368 274 360 266 Z" fill="#FFFFFF"/>
      <!-- Mí mắt trên sắc nét -->
      <path d="M358 266 C368 259 385 259 394 267" stroke="#1C1410" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <!-- Nếp mí đôi nhẹ -->
      <path d="M363 259 C372 255 382 256 388 261" stroke="#D59E87" stroke-width="1" stroke-linecap="round" fill="none"/>
      <!-- Mống mắt nâu hổ phách -->
      <ellipse cx="376" cy="267" rx="6" ry="6" fill="url(#eyeIrisGrad)"/>
      <ellipse cx="376" cy="267" rx="2.5" ry="2.5" fill="#0A0604"/>
      <!-- Điểm sáng mắt long lanh (Catchlight) -->
      <circle cx="374.5" cy="265" r="1.5" fill="#FFFFFF"/>
      <circle cx="378" cy="268.5" r="0.8" fill="#FFFFFF" opacity="0.8"/>
      <!-- Viền mi dưới mềm mại -->
      <path d="M363 268 C371 273 381 273 389 269" stroke="#A86F59" stroke-width="1" stroke-linecap="round" fill="none"/>
    </g>

    <!-- Mắt phải -->
    <g id="right-eye">
      <!-- Tròng trắng -->
      <path d="M440 266 C432 260 416 260 408 267 C416 274 432 274 440 266 Z" fill="#FFFFFF"/>
      <!-- Mí mắt trên sắc nét -->
      <path d="M442 266 C432 259 415 259 406 267" stroke="#1C1410" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <!-- Nếp mí đôi nhẹ -->
      <path d="M437 259 C428 255 418 256 412 261" stroke="#D59E87" stroke-width="1" stroke-linecap="round" fill="none"/>
      <!-- Mống mắt nâu hổ phách -->
      <ellipse cx="424" cy="267" rx="6" ry="6" fill="url(#eyeIrisGrad)"/>
      <ellipse cx="424" cy="267" rx="2.5" ry="2.5" fill="#0A0604"/>
      <!-- Điểm sáng mắt long lanh -->
      <circle cx="422.5" cy="265" r="1.5" fill="#FFFFFF"/>
      <circle cx="426" cy="268.5" r="0.8" fill="#FFFFFF" opacity="0.8"/>
      <!-- Viền mi dưới mềm mại -->
      <path d="M437 268 C429 273 419 273 411 269" stroke="#A86F59" stroke-width="1" stroke-linecap="round" fill="none"/>
    </g>

    <!-- Má ửng hào sắc tươi tắn -->
    <ellipse cx="360" cy="282" rx="14" ry="7" fill="#F4B09A" opacity="0.28"/>
    <ellipse cx="440" cy="282" rx="14" ry="7" fill="#F4B09A" opacity="0.28"/>

    <!-- Sống mũi cao thanh tú, có bóng đổ 3D -->
    <path d="M397 256 L396 288 Q396 298 400 299 Q404 298 404 288 L403 256" stroke="#E6B49F" stroke-width="1" fill="none"/>
    <!-- Đầu mũi và cánh mũi thon gọn -->
    <path d="M394 296 Q400 302 406 296" stroke="#C88269" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    <ellipse cx="392" cy="295" rx="2" ry="1.2" fill="#D39077" opacity="0.6"/>
    <ellipse cx="408" cy="295" rx="2" ry="1.2" fill="#D39077" opacity="0.6"/>

    <!-- Đôi môi có đường nét rõ ràng, mỉm cười nhẹ quý phái -->
    <path d="M388 322 C394 319 398 320 400 321 C402 320 406 319 412 322 C407 325 403 325 400 324 C397 325 393 325 388 322 Z" fill="url(#lipsGrad)"/>
    <path d="M390 323 Q400 331 410 323" stroke="#9C443B" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <!-- Bóng dưới môi dưới tạo chiều sâu -->
    <path d="M394 330 Q400 334 406 330" stroke="#DDA892" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7"/>
  </g>

  <!-- ================= TAY PHẢI (Cầm quạt tao nhã trước ngực) ================= -->
  <g id="avatar-arm-right">
    <!-- Cánh tay trên đến khuỷu tay -->
    <path d="M480 405 Q505 480 488 535 L462 528 Q475 480 460 425 Z" fill="url(#skinGradNamHigh)"/>
    <!-- Cẳng tay gập ngang hướng về phía quạt -->
    <path d="M488 535 Q445 560 375 585 L368 565 Q435 540 462 528 Z" fill="url(#skinGradNamHigh)"/>
    <!-- Bàn tay phải cầm cán quạt điêu luyện -->
    <!-- Mu bàn tay -->
    <path d="M375 585 C360 590 348 585 342 572 C346 562 358 560 368 565 Z" fill="#FCE1D2"/>
    <!-- Ngón cái ôm lấy nan quạt -->
    <path d="M356 564 Q346 568 344 578 Q352 582 358 574 Z" fill="#F5D0B8" stroke="#E2A992" stroke-width="1"/>
    <!-- Các ngón tay cuộn giữ chắc cán quạt -->
    <path d="M344 576 Q338 584 345 590 Q352 588 350 580" stroke="#DDA892" stroke-width="1.4" fill="#FCE1D2"/>
    <path d="M348 578 Q344 588 350 593 Q356 590 354 582" stroke="#DDA892" stroke-width="1.4" fill="#FCE1D2"/>
    <path d="M353 580 Q350 590 356 594 Q361 591 358 584" stroke="#DDA892" stroke-width="1.4" fill="#FCE1D2"/>
  </g>
</svg>'''


# 2. LỚP ÁO NGŨ THÂN TAY CHẼN (Nối liền cổ, tà áo lượn chuẩn hữu nhậm, khuy đồng 3D, hoa văn gấm)
LAYER_NGU_THAN_NAM_SVG = '''<g id="layer-ngu-than-nam-xanh">
  <defs>
    <!-- Gradient vải lụa tơ tằm óng ánh -->
    <linearGradient id="silkFabricBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#152A4A"/>
      <stop offset="35%" stop-color="#22487A"/>
      <stop offset="70%" stop-color="#1A365D"/>
      <stop offset="100%" stop-color="#0F213A"/>
    </linearGradient>
    <!-- Gradient bóng nếp gấp tà áo -->
    <linearGradient id="fabricShadowFold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#091424" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#091424" stop-opacity="0"/>
    </linearGradient>
    <!-- Gradient khuy đồng 3D hoàng cung -->
    <radialGradient id="goldButton3D" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFF3C4"/>
      <stop offset="45%" stop-color="#ECC94B"/>
      <stop offset="85%" stop-color="#B7791F"/>
      <stop offset="100%" stop-color="#744210"/>
    </radialGradient>
    <!-- Pattern hoa văn chữ Thọ & Tản vân chìm trên gấm -->
    <pattern id="damaskThoPattern" width="80" height="80" patternUnits="userSpaceOnUse">
      <!-- Vòng tròn chữ Thọ cách điệu -->
      <circle cx="40" cy="40" r="16" fill="none" stroke="#3182CE" stroke-width="1.2" opacity="0.35"/>
      <path d="M32 40 L48 40 M40 32 L40 48 M35 35 L45 45 M35 45 L45 35" stroke="#3182CE" stroke-width="1" opacity="0.3"/>
      <!-- Mây cuộn tản vân nhỏ -->
      <path d="M10 20 Q20 15 25 22 Q30 20 28 26" fill="none" stroke="#63B3ED" stroke-width="0.8" opacity="0.25"/>
      <path d="M60 65 Q70 60 75 67 Q80 65 78 71" fill="none" stroke="#63B3ED" stroke-width="0.8" opacity="0.25"/>
    </pattern>
  </defs>

  <!-- ================= TAY ÁO CHẼN (Trái & Phải) ================= -->
  <!-- Tay trái buông tự nhiên -->
  <path d="M312 400 L245 585 L280 596 L332 450 Z" fill="url(#silkFabricBlue)" stroke="#0E1C30" stroke-width="1.8"/>
  <path d="M280 596 L245 585" stroke="#63B3ED" stroke-width="1.2" opacity="0.5"/>
  <!-- Nếp nhăn cùi chỏ tay trái -->
  <path d="M280 495 Q295 500 305 492" stroke="#0B1626" stroke-width="2" fill="none" opacity="0.7"/>
  <path d="M276 510 Q292 516 302 508" stroke="#0B1626" stroke-width="1.5" fill="none" opacity="0.6"/>

  <!-- Tay phải co về phía trước cầm quạt -->
  <path d="M488 400 Q525 480 500 535 L445 565 L430 530 Q475 490 468 430 Z" fill="url(#silkFabricBlue)" stroke="#0E1C30" stroke-width="1.8"/>
  <!-- Nếp gấp khuỷu tay phải -->
  <path d="M485 500 Q470 515 455 510" stroke="#0B1626" stroke-width="2.5" fill="none" opacity="0.7"/>
  <path d="M492 515 Q478 528 460 522" stroke="#0B1626" stroke-width="2" fill="none" opacity="0.6"/>
  <!-- Cửa tay chẽn ôm sát cổ tay phải -->
  <path d="M445 565 L430 530" stroke="#63B3ED" stroke-width="1.5" opacity="0.6"/>

  <!-- ================= THÂN ÁO NGŨ THÂN (Dáng chữ A, vạt hữu nhậm) ================= -->
  <!-- Thân chính của áo phủ từ vai xuống qua gối -->
  <path d="M312 400 Q400 380 488 400 L518 845 Q400 865 282 845 L312 400 Z" fill="url(#silkFabricBlue)" stroke="#0E1C30" stroke-width="2.2"/>
  <!-- Phủ lớp hoa văn gấm chữ Thọ chìm sang trọng -->
  <path d="M312 400 Q400 380 488 400 L518 845 Q400 865 282 845 L312 400 Z" fill="url(#damaskThoPattern)"/>

  <!-- Đường xẻ tà bên hông trái & phải (Đặc trưng ngũ thân xẻ tà phóng khoáng) -->
  <path d="M305 660 L282 845" stroke="#0A1524" stroke-width="2" fill="none"/>
  <path d="M495 660 L518 845" stroke="#0A1524" stroke-width="2" fill="none"/>

  <!-- Nếp lượn sóng vải và bóng đổ sống động -->
  <path d="M340 450 Q360 650 350 850" stroke="#0B1728" stroke-width="3" fill="none" opacity="0.45"/>
  <path d="M400 450 Q405 650 402 855" stroke="#4299E1" stroke-width="2.5" fill="none" opacity="0.25"/>
  <path d="M440 470 Q450 660 445 850" stroke="#0B1728" stroke-width="3.5" fill="none" opacity="0.5"/>

  <!-- ================= ĐƯỜNG CẮT VẠT ÁO HỮU NHẬM (Cài sang phải) ================= -->
  <!-- Vạt áo bên trái đè lên vạt phải uốn cong mềm mại từ cổ sang sườn phải -->
  <path d="M428 388 Q452 435 462 475 L464 850" stroke="#0A1422" stroke-width="3" fill="none"/>
  <!-- Viền chỉ viền tà áo tinh tế -->
  <path d="M427 388 Q451 435 461 475 L463 850" stroke="#63B3ED" stroke-width="1" fill="none" opacity="0.5"/>

  <!-- ================= CỔ ĐỨNG LẬP LĨNH (Kín khít, có viền áo lót trắng) ================= -->
  <!-- 1. Viền áo lót trắng (Bạch y / Thụ lĩnh) hé lộ 2.5mm quanh cổ -->
  <path d="M370 342 Q400 348 430 342 L433 365 Q400 371 367 365 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2"/>
  <!-- 2. Cổ đứng ngũ thân ôm khít chân cổ nối liền thân áo -->
  <path d="M371 345 Q400 351 429 345 L432 390 Q400 400 368 390 Z" fill="url(#silkFabricBlue)" stroke="#0E1C30" stroke-width="2"/>
  <!-- Khâu ráp cổ áo vào thân vai -->
  <path d="M368 390 Q400 400 432 390" stroke="#091424" stroke-width="2" fill="none"/>

  <!-- ================= 5 CÚC KHUY ĐỒNG HOÀNG GIA (NGŨ THƯỜNG) ================= -->
  <!-- Khuy 1: Trên cổ đứng -->
  <g transform="translate(422, 362)">
    <!-- Vòng thòng lọng khuy vải tơ -->
    <path d="M-6 0 Q-2 -3 4 0" stroke="#0F213A" stroke-width="2" fill="none"/>
    <circle cx="2" cy="0" r="5" fill="url(#goldButton3D)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
    <circle cx="1" cy="-1" r="1.5" fill="#FFFDF0" opacity="0.8"/>
  </g>

  <!-- Khuy 2: Tại ngã rẽ chân cổ xương quai xanh -->
  <g transform="translate(430, 394)">
    <path d="M-6 0 Q-2 -3 4 0" stroke="#0F213A" stroke-width="2" fill="none"/>
    <circle cx="2" cy="0" r="5" fill="url(#goldButton3D)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
    <circle cx="1" cy="-1" r="1.5" fill="#FFFDF0" opacity="0.8"/>
  </g>

  <!-- Khuy 3: Giữa ngực phải -->
  <g transform="translate(446, 432)">
    <path d="M-6 0 Q-2 -3 4 0" stroke="#0F213A" stroke-width="2" fill="none"/>
    <circle cx="2" cy="0" r="5" fill="url(#goldButton3D)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
    <circle cx="1" cy="-1" r="1.5" fill="#FFFDF0" opacity="0.8"/>
  </g>

  <!-- Khuy 4: Dưới nách sườn phải -->
  <g transform="translate(458, 474)">
    <path d="M-6 0 Q-2 -3 4 0" stroke="#0F213A" stroke-width="2" fill="none"/>
    <circle cx="2" cy="0" r="5" fill="url(#goldButton3D)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
    <circle cx="1" cy="-1" r="1.5" fill="#FFFDF0" opacity="0.8"/>
  </g>

  <!-- Khuy 5: Ngang eo sườn phải -->
  <g transform="translate(460, 525)">
    <path d="M-6 0 Q-2 -3 4 0" stroke="#0F213A" stroke-width="2" fill="none"/>
    <circle cx="2" cy="0" r="5" fill="url(#goldButton3D)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
    <circle cx="1" cy="-1" r="1.5" fill="#FFFDF0" opacity="0.8"/>
  </g>

  <!-- Gấu áo viền tròn đường chỉ lót lụa -->
  <path d="M282 845 Q400 865 518 845" stroke="#091424" stroke-width="3" fill="none"/>
  <path d="M284 841 Q400 861 516 841" stroke="#4299E1" stroke-width="1" fill="none" opacity="0.4"/>
</g>'''


# 3. LỚP QUẦN LỤA TRẮNG (Ống thụng mềm mại, nếp rủ tự nhiên)
LAYER_QUAN_TRANG_SVG = '''<g id="layer-quan-trang">
  <defs>
    <linearGradient id="silkPantsWhite" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E2E8F0"/>
      <stop offset="30%" stop-color="#FFFFFF"/>
      <stop offset="70%" stop-color="#F7FAFC"/>
      <stop offset="100%" stop-color="#CBD5E0"/>
    </linearGradient>
  </defs>
  <!-- Quần ống rộng dáng thụng dài chạm mu bàn chân -->
  <path d="M332 720 L308 1055 Q345 1062 382 1055 L398 810 L418 1055 Q455 1062 492 1055 L468 720 Q400 740 332 720 Z" fill="url(#silkPantsWhite)" stroke="#CBD5E0" stroke-width="1.6"/>
  <!-- Nếp li quần chính diện (Li quần ủi phẳng) -->
  <path d="M345 770 L342 1055" stroke="#CBD5E0" stroke-width="1.8" fill="none"/>
  <path d="M455 770 L458 1055" stroke="#CBD5E0" stroke-width="1.8" fill="none"/>
  <!-- Nếp vải gợn sóng tự nhiên khi đứng -->
  <path d="M322 830 Q315 940 312 1054" stroke="#A0AEC0" stroke-width="1.5" fill="none" opacity="0.5"/>
  <path d="M478 830 Q485 940 488 1054" stroke="#A0AEC0" stroke-width="1.5" fill="none" opacity="0.5"/>
  <!-- Đáy quần có bóng đổ chiều sâu -->
  <path d="M398 810 L400 870" stroke="#A0AEC0" stroke-width="2" fill="none" opacity="0.7"/>
</g>'''


# 4. LỚP KHĂN VẤN ĐEN (Quấn 7 nếp chữ Nhân 人 chuẩn mực)
LAYER_KHAN_VAN_SVG = '''<g id="layer-khan-van-den">
  <defs>
    <linearGradient id="turbanVelvetBlack" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2D3748"/>
      <stop offset="50%" stop-color="#1A202C"/>
      <stop offset="100%" stop-color="#0D1117"/>
    </linearGradient>
  </defs>
  <!-- Thân và đỉnh khăn vấn tròn ôm trọn đỉnh đầu -->
  <ellipse cx="400" cy="210" rx="72" ry="26" fill="url(#turbanVelvetBlack)" stroke="#0E1217" stroke-width="2"/>
  <ellipse cx="400" cy="204" rx="55" ry="18" fill="#0E1217" opacity="0.8"/>

  <!-- Các lớp nếp gấp vải khăn quấn tạo hình chữ Nhân (人) ở chính diện trán -->
  <!-- Lớp 1 (ngoài cùng) -->
  <path d="M328 220 Q400 252 472 220 Q474 200 400 185 Q326 200 328 220 Z" fill="url(#turbanVelvetBlack)" stroke="#0A0D12" stroke-width="1.5"/>
  <!-- Nếp gấp chữ Nhân giao nhau tại trán -->
  <path d="M336 215 Q395 240 402 242 Q408 240 464 215" stroke="#4A5568" stroke-width="1.5" fill="none"/>
  <path d="M344 208 Q396 233 402 235 Q407 233 456 208" stroke="#4A5568" stroke-width="1.5" fill="none"/>
  <path d="M352 201 Q397 225 402 227 Q406 225 448 201" stroke="#4A5568" stroke-width="1.5" fill="none"/>
  <path d="M360 195 Q398 217 402 219 Q405 217 440 195" stroke="#2D3748" stroke-width="1.2" fill="none"/>
  <!-- Đỉnh giao chữ Nhân trung tâm -->
  <path d="M400 185 L402 245" stroke="#171923" stroke-width="1.5" opacity="0.6"/>
</g>'''


# 5. LỚP QUẠT XẾP GIẤY DÓ (Nan tre cật già bồi giấy dó, có tua rua tơ đỏ)
LAYER_QUAT_XEP_SVG = '''<g id="layer-quat-xep">
  <defs>
    <linearGradient id="doPaperGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#EED7A1"/>
      <stop offset="50%" stop-color="#DFC085"/>
      <stop offset="100%" stop-color="#C79F5E"/>
    </linearGradient>
    <linearGradient id="tasselRed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E53E3E"/>
      <stop offset="70%" stop-color="#C53030"/>
      <stop offset="100%" stop-color="#742A2A"/>
    </linearGradient>
  </defs>

  <!-- Bóng đổ của quạt lên tà áo -->
  <path d="M352 575 L285 460 A90 90 0 0 1 425 460 Z" fill="#000000" opacity="0.18" filter="blur(3px)"/>

  <!-- Mặt quạt giấy dó mở xòe cung bán nguyệt trang nhã -->
  <path d="M355 575 L290 465 A85 85 0 0 1 420 465 Z" fill="url(#doPaperGrad)" stroke="#8C5325" stroke-width="1.8"/>

  <!-- Họa tiết cành trúc / hoa sen thủy mặc vẽ trên mặt quạt -->
  <g opacity="0.45" stroke="#3D2413" stroke-width="1.2" fill="none">
    <path d="M335 500 Q355 480 370 472 Q380 482 390 475"/>
    <circle cx="370" cy="472" r="3" fill="#C53030" stroke="none"/>
    <circle cx="375" cy="470" r="2" fill="#E53E3E" stroke="none"/>
  </g>

  <!-- Các nan quạt bằng tre cật bóng mượt -->
  <g stroke="#744210" stroke-width="1.4" stroke-linecap="round">
    <line x1="355" y1="575" x2="290" y2="465"/>
    <line x1="355" y1="575" x2="310" y2="460"/>
    <line x1="355" y1="575" x2="332" y2="457"/>
    <line x1="355" y1="575" x2="355" y2="455"/>
    <line x1="355" y1="575" x2="378" y2="457"/>
    <line x1="355" y1="575" x2="400" y2="460"/>
    <line x1="355" y1="575" x2="420" y2="465"/>
  </g>

  <!-- Chốt đinh quạt bằng đồng sơn son -->
  <circle cx="355" cy="575" r="4.5" fill="#ECC94B" stroke="#744210" stroke-width="1.2"/>

  <!-- Dây tua rua tơ tằm đỏ son buông rủ thanh lịch -->
  <!-- Dây tết -->
  <path d="M355 579 Q352 590 354 598" stroke="#9B2C2C" stroke-width="2" fill="none"/>
  <!-- Hạt ngọc bích điểm xuyết -->
  <circle cx="354" cy="598" r="3.5" fill="#319795" stroke="#234E52" stroke-width="1"/>
  <!-- Chùm tua tơ buông mềm -->
  <path d="M354 602 L350 635 L358 635 Z" fill="url(#tasselRed)"/>
  <path d="M351 635 L349 642 M354 635 L354 644 M357 635 L359 642" stroke="#C53030" stroke-width="1"/>
</g>'''


# 6. LỚP GUỐC MỘC QUAI NHUNG (Đế gỗ mít tự nhiên vân đẹp, quai nhung đen êm)
LAYER_GUOC_MOC_SVG = '''<g id="layer-guoc-moc">
  <defs>
    <!-- Vân gỗ mít mộc mạc -->
    <linearGradient id="woodSoleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#B7791F"/>
      <stop offset="40%" stop-color="#D69E2E"/>
      <stop offset="80%" stop-color="#B7791F"/>
      <stop offset="100%" stop-color="#975A16"/>
    </linearGradient>
    <linearGradient id="velvetStrap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4A5568"/>
      <stop offset="100%" stop-color="#1A202C"/>
    </linearGradient>
  </defs>

  <!-- Guốc mộc chân trái -->
  <g id="guoc-trai">
    <!-- Bóng chân trái -->
    <ellipse cx="348" cy="1075" rx="34" ry="10" fill="#1A202C" opacity="0.25"/>
    <!-- Đế gỗ uốn lượn hình dáng guốc cổ -->
    <path d="M318 1066 C322 1058 370 1058 378 1066 C380 1074 372 1078 348 1078 C324 1078 316 1074 318 1066 Z" fill="url(#woodSoleGrad)" stroke="#744210" stroke-width="1.8"/>
    <!-- Vân gỗ sọc ngang -->
    <path d="M328 1068 Q348 1071 368 1068" stroke="#744210" stroke-width="1" opacity="0.4" fill="none"/>
    <!-- Quai nhung đen cong mềm mu bàn chân -->
    <path d="M326 1068 Q348 1050 370 1068" stroke="url(#velvetStrap)" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M328 1067 Q348 1052 368 1067" stroke="#718096" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>

  <!-- Guốc mộc chân phải -->
  <g id="guoc-phai">
    <!-- Bóng chân phải -->
    <ellipse cx="452" cy="1075" rx="34" ry="10" fill="#1A202C" opacity="0.25"/>
    <!-- Đế gỗ uốn lượn -->
    <path d="M422 1066 C426 1058 474 1058 482 1066 C484 1074 476 1078 452 1078 C428 1078 420 1074 422 1066 Z" fill="url(#woodSoleGrad)" stroke="#744210" stroke-width="1.8"/>
    <!-- Vân gỗ -->
    <path d="M432 1068 Q452 1071 472 1068" stroke="#744210" stroke-width="1" opacity="0.4" fill="none"/>
    <!-- Quai nhung đen cong mềm -->
    <path d="M430 1068 Q452 1050 474 1068" stroke="url(#velvetStrap)" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M432 1067 Q452 1052 472 1067" stroke="#718096" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>
</g>'''


# 7. AVATAR NỮ CHUẨN (Thanh tú, duyên dáng, tỷ lệ mỹ nhân cổ phong)
AVATAR_NU_SVG = '''<svg viewBox="0 0 800 1200" width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="skinGradNuHigh" cx="50%" cy="35%" r="60%">
      <stop offset="0%" stop-color="#FFF8F4"/>
      <stop offset="60%" stop-color="#FDE8DD"/>
      <stop offset="100%" stop-color="#F6D3C2"/>
    </radialGradient>
    <linearGradient id="hairGradNuHigh" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2D221E"/>
      <stop offset="50%" stop-color="#1A1310"/>
      <stop offset="100%" stop-color="#0E0A08"/>
    </linearGradient>
    <radialGradient id="eyeIrisNuGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#6B3A26"/>
      <stop offset="70%" stop-color="#301A11"/>
      <stop offset="100%" stop-color="#120A06"/>
    </radialGradient>
    <linearGradient id="lipsNuGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E87A74"/>
      <stop offset="100%" stop-color="#C54E48"/>
    </linearGradient>
    <radialGradient id="bgCourtNuGlow" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#FFFDF9" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#FBF4EA" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#EADED0" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Nền & bóng đổ mặt sàn -->
  <circle cx="400" cy="560" r="330" fill="url(#bgCourtNuGlow)"/>
  <circle cx="400" cy="560" r="325" fill="none" stroke="#D69E2E" stroke-width="1.2" stroke-dasharray="8,6" opacity="0.45"/>
  <ellipse cx="400" cy="1080" rx="180" ry="22" fill="#2D3748" opacity="0.13"/>

  <!-- Thân & chân thon thả -->
  <g id="avatar-legs-nu">
    <path d="M362 740 L350 1060 L378 1060 L395 740 Z" fill="#FADAC8"/>
    <path d="M438 740 L450 1060 L422 1060 L405 740 Z" fill="#F4CFBA"/>
    <path d="M395 740 L400 860 L405 740 Z" fill="#E8B59B"/>
  </g>

  <!-- Tay trái buông thon dài -->
  <g id="avatar-arm-left-nu">
    <path d="M315 410 Q292 505 280 590 L304 595 Q318 510 334 430 Z" fill="url(#skinGradNuHigh)"/>
    <!-- Bàn tay búp măng -->
    <path d="M280 590 Q274 615 278 635 Q286 642 295 638 Q302 630 304 595 Z" fill="#FDE8DD"/>
    <path d="M278 635 Q281 646 286 645 Q289 642 288 635" stroke="#E2A992" stroke-width="1.2" fill="#FDE8DD"/>
    <path d="M284 637 Q288 648 292 647 Q295 643 293 636" stroke="#E2A992" stroke-width="1.2" fill="#FDE8DD"/>
  </g>

  <!-- Cổ & Khuôn ngực thiếu nữ -->
  <g id="avatar-neck-nu">
    <path d="M325 410 Q365 388 400 388 Q435 388 475 410 L455 480 Q400 495 345 480 Z" fill="url(#skinGradNuHigh)"/>
    <path d="M378 318 L376 390 Q400 400 424 390 L422 318 Z" fill="url(#skinGradNuHigh)"/>
    <path d="M378 318 Q400 338 422 318 L423 335 Q400 355 377 335 Z" fill="#E8B59B" opacity="0.5"/>
    <path d="M390 390 Q400 396 410 390" stroke="#DDA892" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>

  <!-- Khuôn mặt trái xoan thanh tú -->
  <g id="avatar-head-nu">
    <path d="M338 230 C335 275 342 305 368 328 C386 344 414 344 432 328 C458 305 465 275 462 230 C458 180 342 180 338 230 Z" fill="url(#skinGradNuHigh)"/>

    <!-- Tóc mượt búi cao sau gáy & tóc mai duyên dáng -->
    <path d="M336 240 C332 205 360 170 400 168 C440 170 468 205 464 240 C458 215 440 200 400 200 C360 200 342 215 336 240 Z" fill="url(#hairGradNuHigh)"/>
    <ellipse cx="400" cy="165" rx="46" ry="36" fill="url(#hairGradNuHigh)"/>
    <!-- Tóc mai uốn nhẹ ôm gò má -->
    <path d="M338 235 Q344 265 342 278 Q346 265 348 240 Z" fill="url(#hairGradNuHigh)"/>
    <path d="M462 235 Q456 265 458 278 Q454 265 452 240 Z" fill="url(#hairGradNuHigh)"/>

    <!-- Lông mày lá liễu thanh mảnh -->
    <path d="M356 250 C368 245 382 246 392 251" stroke="#36221A" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M444 250 C432 245 418 246 408 251" stroke="#36221A" stroke-width="2.2" stroke-linecap="round" fill="none"/>

    <!-- Đôi mắt phượng long lanh dịu dàng -->
    <!-- Mắt trái -->
    <g id="left-eye-nu">
      <path d="M362 268 C370 262 384 262 392 269 C384 276 370 276 362 268 Z" fill="#FFFFFF"/>
      <path d="M360 268 C370 261 385 261 394 269" stroke="#1F140F" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <!-- Đuôi mắt cong nhẹ cánh phượng -->
      <path d="M394 269 Q398 266 400 264" stroke="#1F140F" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M365 261 C373 257 382 258 388 263" stroke="#DDA892" stroke-width="1" fill="none"/>
      <ellipse cx="377" cy="269" rx="6" ry="6" fill="url(#eyeIrisNuGrad)"/>
      <circle cx="375.5" cy="267" r="1.6" fill="#FFFFFF"/>
      <circle cx="379" cy="270" r="0.9" fill="#FFFFFF" opacity="0.85"/>
      <path d="M365 270 C372 274 382 274 389 271" stroke="#B87D68" stroke-width="1" fill="none"/>
    </g>

    <!-- Mắt phải -->
    <g id="right-eye-nu">
      <path d="M438 268 C430 262 416 262 408 269 C416 276 430 276 438 268 Z" fill="#FFFFFF"/>
      <path d="M440 268 C430 261 415 261 406 269" stroke="#1F140F" stroke-width="2.4" stroke-linecap="round" fill="none"/>
      <path d="M406 269 Q402 266 400 264" stroke="#1F140F" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M435 261 C427 257 418 258 412 263" stroke="#DDA892" stroke-width="1" fill="none"/>
      <ellipse cx="423" cy="269" rx="6" ry="6" fill="url(#eyeIrisNuGrad)"/>
      <circle cx="421.5" cy="267" r="1.6" fill="#FFFFFF"/>
      <circle cx="425" cy="270" r="0.9" fill="#FFFFFF" opacity="0.85"/>
      <path d="M435 270 C428 274 418 274 411 271" stroke="#B87D68" stroke-width="1" fill="none"/>
    </g>

    <!-- Má ửng đào phớt hồng duyên dáng -->
    <ellipse cx="360" cy="284" rx="15" ry="8" fill="#F687B3" opacity="0.32"/>
    <ellipse cx="440" cy="284" rx="15" ry="8" fill="#F687B3" opacity="0.32"/>

    <!-- Sống mũi thon thanh -->
    <path d="M398 258 L397 289 Q397 298 400 299 Q403 298 403 289 L402 258" stroke="#EBBCA8" stroke-width="1" fill="none"/>
    <path d="M395 297 Q400 302 405 297" stroke="#CE8972" stroke-width="1.5" stroke-linecap="round" fill="none"/>

    <!-- Đôi môi trái tim ngọt ngào -->
    <path d="M389 323 C394 319 398 320 400 321 C402 320 406 319 411 323 C407 326 403 327 400 326 C397 327 393 326 389 323 Z" fill="url(#lipsNuGrad)"/>
    <path d="M391 324 Q400 332 409 324" stroke="#A8423C" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <circle cx="400" cy="323" r="1.2" fill="#FFFFFF" opacity="0.6"/>
  </g>

  <!-- Tay phải co nhẹ cầm quạt -->
  <g id="avatar-arm-right-nu">
    <path d="M475 410 Q498 485 482 535 L456 528 Q470 480 455 430 Z" fill="url(#skinGradNuHigh)"/>
    <path d="M482 535 Q442 560 376 585 L370 565 Q432 540 456 528 Z" fill="url(#skinGradNuHigh)"/>
    <!-- Bàn tay búp măng cầm cán quạt -->
    <path d="M376 585 C362 590 350 585 344 572 C348 562 360 560 370 565 Z" fill="#FDE8DD"/>
    <path d="M358 564 Q348 568 346 578 Q354 582 360 574 Z" fill="#F6D3C2" stroke="#E2A992" stroke-width="1"/>
    <path d="M346 576 Q340 584 347 590 Q354 588 352 580" stroke="#DDA892" stroke-width="1.3" fill="#FDE8DD"/>
  </g>
</svg>'''


# 8. LỚP ÁO TẤC ĐỎ CHU SA (Lễ phục tay thụng uy nghiêm cung đình)
LAYER_AO_TAC_DO_SVG = '''<g id="layer-ao-tac-do">
  <defs>
    <linearGradient id="silkImperialRed" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7B1D1D"/>
      <stop offset="35%" stop-color="#C53030"/>
      <stop offset="70%" stop-color="#9B2C2C"/>
      <stop offset="100%" stop-color="#5A1515"/>
    </linearGradient>
    <radialGradient id="goldButton3DRed" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFF3C4"/>
      <stop offset="45%" stop-color="#ECC94B"/>
      <stop offset="85%" stop-color="#B7791F"/>
      <stop offset="100%" stop-color="#744210"/>
    </radialGradient>
    <pattern id="damaskLotusPattern" width="90" height="90" patternUnits="userSpaceOnUse">
      <circle cx="45" cy="45" r="18" fill="none" stroke="#E53E3E" stroke-width="1.2" opacity="0.35"/>
      <path d="M45 27 Q55 35 45 45 Q35 35 45 27 Z" fill="none" stroke="#F6AD55" stroke-width="0.8" opacity="0.3"/>
      <path d="M45 63 Q55 55 45 45 Q35 55 45 63 Z" fill="none" stroke="#F6AD55" stroke-width="0.8" opacity="0.3"/>
    </pattern>
  </defs>

  <!-- ================= TAY THỤNG ĐẶC TRƯNG RỘNG DÀI ================= -->
  <!-- Tay thụng bên trái buông dài quá hông rộng thênh thang -->
  <path d="M312 398 L165 670 Q210 690 280 675 L335 460 Z" fill="url(#silkImperialRed)" stroke="#4A0E0E" stroke-width="2"/>
  <path d="M165 670 Q210 690 280 675" stroke="#ECC94B" stroke-width="2" opacity="0.7"/>
  <!-- Nếp vải sâu của tay thụng -->
  <path d="M210 520 Q240 600 230 678" stroke="#4A0E0E" stroke-width="3" fill="none" opacity="0.6"/>
  <path d="M250 490 Q275 580 268 676" stroke="#4A0E0E" stroke-width="2.5" fill="none" opacity="0.5"/>

  <!-- Tay thụng bên phải -->
  <path d="M488 398 L635 670 Q590 690 520 675 L465 460 Z" fill="url(#silkImperialRed)" stroke="#4A0E0E" stroke-width="2"/>
  <path d="M635 670 Q590 690 520 675" stroke="#ECC94B" stroke-width="2" opacity="0.7"/>
  <!-- Nếp vải tay thụng phải -->
  <path d="M590 520 Q560 600 570 678" stroke="#4A0E0E" stroke-width="3" fill="none" opacity="0.6"/>
  <path d="M550 490 Q525 580 532 676" stroke="#4A0E0E" stroke-width="2.5" fill="none" opacity="0.5"/>

  <!-- ================= THÂN ÁO TẤC DÁNG RỘNG TÔN NGHIÊM ================= -->
  <path d="M312 398 Q400 375 488 398 L532 875 Q400 895 268 875 L312 398 Z" fill="url(#silkImperialRed)" stroke="#4A0E0E" stroke-width="2.5"/>
  <path d="M312 398 Q400 375 488 398 L532 875 Q400 895 268 875 L312 398 Z" fill="url(#damaskLotusPattern)"/>

  <!-- Nếp lượn sóng vải áo tấc khi đứng uy nghi -->
  <path d="M335 450 Q350 670 340 880" stroke="#4A0E0E" stroke-width="3.5" fill="none" opacity="0.5"/>
  <path d="M400 450 Q405 670 402 885" stroke="#F56565" stroke-width="2" fill="none" opacity="0.3"/>
  <path d="M445 470 Q455 670 450 880" stroke="#4A0E0E" stroke-width="4" fill="none" opacity="0.55"/>

  <!-- Vạt áo hữu nhậm cài sang phải -->
  <path d="M428 388 Q455 440 466 480 L468 880" stroke="#3D0B0B" stroke-width="3" fill="none"/>
  <path d="M427 388 Q454 440 465 480 L467 880" stroke="#ECC94B" stroke-width="1.2" fill="none" opacity="0.6"/>

  <!-- ================= CỔ ĐỨNG LẬP LĨNH VIỀN BẠCH Y ================= -->
  <path d="M370 342 Q400 348 430 342 L433 365 Q400 371 367 365 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2"/>
  <path d="M371 345 Q400 351 429 345 L432 390 Q400 400 368 390 Z" fill="url(#silkImperialRed)" stroke="#4A0E0E" stroke-width="2"/>
  <path d="M368 390 Q400 400 432 390" stroke="#3D0B0B" stroke-width="2" fill="none"/>

  <!-- 5 Khuy đồng hoàng gia -->
  <circle cx="423" cy="363" r="5" fill="url(#goldButton3DRed)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
  <circle cx="431" cy="395" r="5" fill="url(#goldButton3DRed)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
  <circle cx="448" cy="434" r="5" fill="url(#goldButton3DRed)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
  <circle cx="460" cy="476" r="5" fill="url(#goldButton3DRed)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>
  <circle cx="463" cy="528" r="5" fill="url(#goldButton3DRed)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))"/>

  <!-- Gấu áo tấc thêu chỉ vàng -->
  <path d="M268 875 Q400 895 532 875" stroke="#ECC94B" stroke-width="2.5" fill="none"/>
</g>'''


# 9. LỚP ÁO NHẬT BÌNH NỮ ĐỎ (Cổ chữ nhật ngũ sắc, phượng hoàng cung đình)
LAYER_NHAT_BINH_SVG = '''<g id="layer-nhat-binh-nu-do">
  <defs>
    <linearGradient id="silkNhatBinhRed" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#822727"/>
      <stop offset="50%" stop-color="#C53030"/>
      <stop offset="100%" stop-color="#63171B"/>
    </linearGradient>
  </defs>

  <!-- Thân áo xẻ trước chính diện (đối khâm) -->
  <path d="M312 398 L240 595 L275 605 L332 450 Z" fill="url(#silkNhatBinhRed)" stroke="#4A0E0E" stroke-width="1.8"/>
  <path d="M488 398 L560 595 L525 605 L468 450 Z" fill="url(#silkNhatBinhRed)" stroke="#4A0E0E" stroke-width="1.8"/>
  <path d="M312 398 Q400 375 488 398 L522 865 Q400 885 278 865 L312 398 Z" fill="url(#silkNhatBinhRed)" stroke="#4A0E0E" stroke-width="2.2"/>

  <!-- ================= BẢN CỔ NHẬT BÌNH CHỮ NHẬT TO BẢN ================= -->
  <!-- Dải viền ngoài cùng mạ vàng -->
  <path d="M348 350 L452 350 L452 540 L348 540 Z" fill="#D69E2E" stroke="#744210" stroke-width="2"/>
  <!-- Dải ngũ sắc cung đình (Xanh lam, Vàng, Đỏ, Trắng, Đen) -->
  <rect x="354" y="356" width="92" height="178" fill="#1A365D"/>
  <rect x="360" y="362" width="80" height="166" fill="#D69E2E"/>
  <rect x="366" y="368" width="68" height="154" fill="#C53030"/>
  <rect x="372" y="374" width="56" height="142" fill="#FFFFFF"/>
  <rect x="378" y="380" width="44" height="130" fill="#1A202C"/>

  <!-- Tâm ngực khoét áo trong và khuy cài ngọc bích -->
  <path d="M386 388 L414 388 L414 502 L386 502 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1"/>
  <circle cx="400" cy="415" r="7" fill="#319795" stroke="#234E52" stroke-width="1.8"/>
  <circle cx="400" cy="460" r="7" fill="#319795" stroke="#234E52" stroke-width="1.8"/>

  <!-- Dải dóng ngũ sắc ở cổ tay áo -->
  <g stroke-width="4">
    <line x1="242" y1="588" x2="273" y2="598" stroke="#1A365D"/>
    <line x1="240" y1="583" x2="271" y2="593" stroke="#D69E2E"/>
    <line x1="238" y1="578" x2="269" y2="588" stroke="#319795"/>
    <line x1="527" y1="598" x2="558" y2="588" stroke="#1A365D"/>
    <line x1="529" y1="593" x2="560" y2="583" stroke="#D69E2E"/>
    <line x1="531" y1="588" x2="562" y2="578" stroke="#319795"/>
  </g>
</g>'''


# 10. LỚP ÁO NGŨ THÂN NỮ HỒNG ĐÀO
LAYER_NGU_THAN_NU_SVG = '''<g id="layer-ngu-than-nu-hong">
  <defs>
    <linearGradient id="silkPeachPink" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#97266D"/>
      <stop offset="40%" stop-color="#ED64A6"/>
      <stop offset="80%" stop-color="#D53F8C"/>
      <stop offset="100%" stop-color="#702459"/>
    </linearGradient>
    <radialGradient id="pearlButton3D" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#FED7E2"/>
      <stop offset="85%" stop-color="#F687B3"/>
      <stop offset="100%" stop-color="#97266D"/>
    </radialGradient>
  </defs>

  <!-- Tay áo ôm nhẹ nhàng duyên dáng -->
  <path d="M315 405 L252 585 L284 595 L332 450 Z" fill="url(#silkPeachPink)" stroke="#702459" stroke-width="1.6"/>
  <path d="M485 405 Q520 480 495 535 L445 565 L430 530 Q470 490 465 430 Z" fill="url(#silkPeachPink)" stroke="#702459" stroke-width="1.6"/>

  <!-- Thân áo chiết eo thanh tao tôn dáng -->
  <path d="M315 405 Q400 388 485 405 L512 850 Q400 870 288 850 L315 405 Z" fill="url(#silkPeachPink)" stroke="#702459" stroke-width="2"/>

  <!-- Vạt áo hữu nhậm lượn cong mềm mại -->
  <path d="M426 388 Q450 435 458 475 L460 850" stroke="#521B41" stroke-width="2.5" fill="none"/>
  <path d="M425 388 Q449 435 457 475 L459 850" stroke="#FFF5F7" stroke-width="1" fill="none" opacity="0.6"/>

  <!-- Cổ đứng thanh mảnh có viền áo lót trắng hé lộ -->
  <path d="M372 342 Q400 348 428 342 L430 365 Q400 371 370 365 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.2"/>
  <path d="M373 345 Q400 351 427 345 L430 390 Q400 400 370 390 Z" fill="url(#silkPeachPink)" stroke="#702459" stroke-width="1.8"/>

  <!-- 5 Khuy ngọc trai hồng phấn -->
  <circle cx="422" cy="363" r="4.5" fill="url(#pearlButton3D)"/>
  <circle cx="429" cy="395" r="4.5" fill="url(#pearlButton3D)"/>
  <circle cx="444" cy="434" r="4.5" fill="url(#pearlButton3D)"/>
  <circle cx="455" cy="476" r="4.5" fill="url(#pearlButton3D)"/>
  <circle cx="457" cy="528" r="4.5" fill="url(#pearlButton3D)"/>
</g>'''


def run_upgrade():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Cập nhật Avatar Nam Chuẩn
    cursor.execute("UPDATE avatars SET svg_body = ? WHERE id = 'avatar_nam_chuan'", (AVATAR_NAM_SVG,))
    print(f"Updated Avatar Nam: {cursor.rowcount} row.")

    # 2. Cập nhật Avatar Nữ Chuẩn
    cursor.execute("UPDATE avatars SET svg_body = ? WHERE id = 'avatar_nu_chuan'", (AVATAR_NU_SVG,))
    print(f"Updated Avatar Nu: {cursor.rowcount} row.")

    # 3. Cập nhật Lớp Áo Ngũ Thân Nam Xanh Chàm
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_ngu_than_nam_xanh'", (LAYER_NGU_THAN_NAM_SVG,))
    print(f"Updated Ngu Than Nam Xanh: {cursor.rowcount} row.")

    # 4. Cập nhật Lớp Áo Ngũ Thân Nữ Hồng Đào
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_ngu_than_nu_hong'", (LAYER_NGU_THAN_NU_SVG,))
    print(f"Updated Ngu Than Nu Hong: {cursor.rowcount} row.")

    # 5. Cập nhật Lớp Áo Tấc Đỏ Chu Sa
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_ao_tac_do'", (LAYER_AO_TAC_DO_SVG,))
    print(f"Updated Ao Tac Do: {cursor.rowcount} row.")

    # 6. Cập nhật Lớp Áo Nhật Bình Nữ Đỏ
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_nhat_binh_do'", (LAYER_NHAT_BINH_SVG,))
    print(f"Updated Nhat Binh Nu Do: {cursor.rowcount} row.")

    # 7. Cập nhật Lớp Quần Lụa Trắng
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_quan_trang'", (LAYER_QUAN_TRANG_SVG,))
    print(f"Updated Quan Lua Trang: {cursor.rowcount} row.")

    # 8. Cập nhật Lớp Khăn Vấn Đen
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_khan_van_den'", (LAYER_KHAN_VAN_SVG,))
    print(f"Updated Khan Van Den: {cursor.rowcount} row.")

    # 9. Cập nhật Lớp Quạt Xếp Giấy Dó
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_quat_xep'", (LAYER_QUAT_XEP_SVG,))
    print(f"Updated Quat Xep Giay Do: {cursor.rowcount} row.")

    # 10. Cập nhật Lớp Guốc Mộc Quai Nhung
    cursor.execute("UPDATE asset_layers SET svg_content = ? WHERE id = 'layer_guoc_moc'", (LAYER_GUOC_MOC_SVG,))
    print(f"Updated Guoc Moc: {cursor.rowcount} row.")

    conn.commit()
    conn.close()
    print("SUCCESSFULLY UPGRADED ALL SVG ASSETS IN DATABASE!")


if __name__ == "__main__":
    run_upgrade()
