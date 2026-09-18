"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ArrowRight,
  ArrowDown,
  BookOpen,
  ShieldCheck,
  Palette,
  Layers,
  CheckCircle2,
  ChevronRight,
  Calendar,
  Share2,
  Compass,
  Wand2,
  Play,
  Pause,
} from "lucide-react";

// Dữ liệu 5 Trang Phục Tham Chiếu Chuẩn Thư Tịch
interface ReferenceGarment {
  id: string;
  name: string;
  shortName: string;
  dynasties: string;
  eraTime: string;
  role: string;
  significance: string;
  structure: {
    collar: string;
    sleeves: string;
    lapelAndButtons: string;
    pattern: string;
  };
  features: string[];
  colors: { name: string; hex: string }[];
  citation: string;
  sourceBook: string;
  imageUrl: string;
  thumbUrl: string;
  badge: string;
}

const REFERENCE_GARMENTS: ReferenceGarment[] = [
  {
    id: "giao-linh",
    name: "Áo Giao Lĩnh (Trực Lĩnh)",
    shortName: "Giao Lĩnh",
    dynasties: "Triều Lý — Trần — Lê",
    eraTime: "TK XI — TK XVIII",
    role: "Lễ phục & Thường phục Quý tộc, Trí thức",
    significance:
      "Dáng áo cổ xưa bậc nhất trong lịch sử trang phục dân tộc Đại Việt. Phục trang mang phong thái thoát tục, thanh tao với vạt giao chéo hữu nhậm, dây đai thắt lưng lụa buông dài và hoa văn cúc dây, hoa sen thanh nhã.",
    structure: {
      collar: "Cổ giao lĩnh (Trực lĩnh) vạt chéo, cổ lót trắng ôm khít bên trong",
      sleeves: "Ống tay rộng vừa hoặc tay thụng dài buông rủ uyển chuyển",
      lapelAndButtons: "Hữu nhậm: Vạt bên trái đè sang vạt bên phải, buộc dải lụa ngang eo",
      pattern: "Gấm dệt chìm hoa cúc đại đóa, hoa sen tây và hoa mây thời Lý — Trần",
    },
    features: [
      "Quy thức Hữu nhậm chuẩn mực: vạt trái đè vạt phải tôn cốt cách đoan chính",
      "Sắc lục rêu cung đình kết hợp đai lụa nâu đỏ trầm ấm và quần trắng trang nhã",
      "Phù hợp tái hiện không gian lễ hội lịch sử thời Lý, Trần, Lê Sơ",
    ],
    colors: [
      { name: "Lục Rêu Gấm", hex: "#4A5D43" },
      { name: "Lụa Nâu Đỏ", hex: "#7D4E41" },
      { name: "Trắng Ngà Tơ", hex: "#F5F2EB" },
    ],
    citation:
      "Lý — Trần y phục phần lớn theo lối giao lĩnh, vạt áo buông dài phủ gối, lấy nét thanh tao nhã nhặn làm quy thức tôn nghiêm của bậc vương triều.",
    sourceBook: "Ngàn năm áo mũ (Trần Quang Đức)",
    imageUrl: "/images/heritage/ly_tran_le_giao_linh.webp",
    thumbUrl: "/images/heritage/thumb_ly_tran_le_giao_linh.webp",
    badge: "Thanh Thoát & Cổ Kính",
  },
  {
    id: "vien-linh",
    name: "Áo Viên Lĩnh (Đoàn Lĩnh)",
    shortName: "Viên Lĩnh",
    dynasties: "Triều Lý — Trần — Lê — Nguyễn",
    eraTime: "TK XI — TK XX",
    role: "Triều phục, Phẩm phục Quan lại & Bổ phục Hoàng gia",
    significance:
      "Kiểu thức áo cổ tròn trang trọng xuyên suốt cả ngàn năm vương triều. Mang biểu trưng quyền uy tối thượng với đồ án Bổ Đoàn rồng mây kim tuyến trước ngực và dải sóng nước Thủy Ba Tam Sơn uy nghiêm nơi chân vạt.",
    structure: {
      collar: "Cổ tròn (Viên lĩnh) may nẹp kín, cài khuy kim loại bên vai phải",
      sleeves: "Tay áo thụng dài uy nghi, mép viền may lót lụa tương phản sắc sảo",
      lapelAndButtons: "Bổ tử / Bổ đoàn dệt thêu rồng cuộn kim tuyến rực rỡ trước ngực và sau lưng",
      pattern: "Đồ án Đoàn Long (rồng cuộn mây) và sóng nước Thủy Ba Tam Sơn ngũ sắc",
    },
    features: [
      "Cổ tròn nẹp khuy vai phải kín đáo, nghiêm cẩn chốn thiết triều đại lễ",
      "Bổ đoàn rồng cuộn kim tuyến chỉ vàng dệt gấm sắc tím hoàng triều (Tử sắc)",
      "Kết hợp hoàn mỹ cùng Mũ cánh chuồn Ô Sa và quần lụa trắng hoàng gia",
    ],
    colors: [
      { name: "Tử Thẫm Hoàng Triều", hex: "#4A3258" },
      { name: "Vàng Kim Thêu Rồng", hex: "#C89A38" },
      { name: "Lam Sóng Thủy Ba", hex: "#2B4A6F" },
    ],
    citation:
      "Quan viên thiết triều đại lễ đều mặc áo cổ tròn viên lĩnh, thêu bổ tử rồng mây sóng nước thủy ba để phân định điển lệ phẩm hàm.",
    sourceBook: "Đại Việt sử ký toàn thư",
    imageUrl: "/images/heritage/ly_tran_le_nguyen_vien_linh.webp",
    thumbUrl: "/images/heritage/thumb_ly_tran_le_nguyen_vien_linh.webp",
    badge: "Uy Nghi & Vương Triều",
  },
  {
    id: "nhat-binh",
    name: "Áo Nhật Bình",
    shortName: "Nhật Bình",
    dynasties: "Triều Nguyễn",
    eraTime: "1802 — 1945",
    role: "Thường phục Hoàng hậu, Công chúa & Triều phục Mệnh phụ",
    significance:
      "Kiệt tác phục trang nữ giới đỉnh cao của cung đình Huế. Tên gọi xuất phát từ nẹp cổ áo hình chữ nhật to bản trước ngực. Nổi bật với dải viền ngũ hành ngũ sắc ở ống tay áo và đồ án chim phượng thêu kim tuyến lộng lẫy.",
    structure: {
      collar: "Cổ đối khâm hình chữ nhật to bản (Nhật Bình), kết nẹp khuy cúc ngọc bội",
      sleeves: "Ống tay thụng viền dải Ngũ Sắc tương sinh (xanh, vàng, trắng, đỏ, lục)",
      lapelAndButtons: "Vạt áo xẻ trước cài khuy nẹp ngọc, buông dài ngang gối phủ ngoài xiêm lụa",
      pattern: "Chim phượng hoàng ngậm hoa sen, hoa cúc đại đóa dệt kim tuyến, sóng ngũ sắc",
    },
    features: [
      "Nẹp cổ chữ nhật ngũ sắc độc bản kết hợp dải tay ngũ hành tương sinh",
      "Sắc đỏ son chu sa rực rỡ biểu trưng cho tôn quý, phúc thọ và quyền quý cung đình",
      "Trang phục được ưa chuộng bậc nhất hiện nay trong lễ cưới truyền thống và chụp kỷ yếu",
    ],
    colors: [
      { name: "Đỏ Son Chu Sa", hex: "#9E2A2B" },
      { name: "Vàng Kim Tuyến", hex: "#D4AF37" },
      { name: "Xanh Khăn Vành", hex: "#1E3A8A" },
    ],
    citation:
      "Áo Nhật bình là thường phục của Hoàng thái hậu, Hoàng hậu, Công chúa; lại là triều phục của các bậc Cung tần và Mệnh phụ chốn kinh kỳ.",
    sourceBook: "Khâm định Đại Nam hội điển sự lệ",
    imageUrl: "/images/heritage/nguyen_nhat_binh.webp",
    thumbUrl: "/images/heritage/thumb_nguyen_nhat_binh.webp",
    badge: "Tuyệt Mỹ Cung Đình",
  },
  {
    id: "ao-tac",
    name: "Áo Tấc (Áo Thụng)",
    shortName: "Áo Tấc",
    dynasties: "Triều Nguyễn",
    eraTime: "1802 — 1945",
    role: "Lễ phục Quốc gia cho các dịp Tế tự, Hỷ sự & Đại lễ",
    significance:
      "Lễ phục trang nghiêm của bậc quan lại và dân gian thời Nguyễn. Áo may theo thể thức ngũ thân lập lĩnh nhưng có ống tay rộng thụng xòe dài qua đầu ngón tay đúng 1 tấc (khoảng 4cm), thể hiện thái độ cung kính, mực thước.",
    structure: {
      collar: "Cổ đứng lập lĩnh cao 3–4 cm ôm khít, dựng thẳng đoan trang",
      sleeves: "Tay may thụng cực rộng, phẳng phiu, buông dài quá ngón tay đúng 1 tấc",
      lapelAndButtons: "5 thân vải ghép lại, cài 5 khuy bên phải (hữu nhậm) nghiêm cẩn",
      pattern: "Gấm dệt đoàn long rồng cuộn, mây ngũ sắc và đồ án tam sơn thủy ba",
    },
    features: [
      "Tay áo thụng dài xòe rộng lót lụa đỏ bên trong, phong thái ung dung đĩnh đạc",
      "Màu lam chàm thêu kim tuyến lộng lẫy, phối cùng khăn đóng đen truyền thống",
      "Lựa chọn hoàn hảo cho lễ đính hôn, rước dâu, cúng đình và lễ hội văn hóa",
    ],
    colors: [
      { name: "Lam Chàm Gấm", hex: "#1D3557" },
      { name: "Đỏ Lót Tay Áo", hex: "#8B1E1E" },
      { name: "Vàng Kim Rồng Cuộn", hex: "#C59B27" },
    ],
    citation:
      "Áo tấc được mặc vào các dịp lễ tiết trọng thể như cúng tế trời đất, bái yết tổ tiên, đình đám làng xã và ngày thành hôn lứa đôi.",
    sourceBook: "Khâm định Đại Nam hội điển sự lệ",
    imageUrl: "/images/heritage/nguyen_ao_tac.webp",
    thumbUrl: "/images/heritage/thumb_nguyen_ao_tac.webp",
    badge: "Đại Lễ & Trang Nghiêm",
  },
  {
    id: "ngu-than",
    name: "Áo Ngũ Thân Tay Chẽn",
    shortName: "Ngũ Thân Tay Chẽn",
    dynasties: "Triều Nguyễn (Cải cách Minh Mạng)",
    eraTime: "1827 — Đến nay",
    role: "Quốc phục Toàn dân & Tiền thân Trực tiếp của Áo Dài Hiện Đại",
    significance:
      "Đỉnh cao thống nhất y phục Đại Nam dưới triều vua Minh Mạng. Áo cấu thành từ 5 thân vải tượng trưng phụ mẫu đôi bên và chính mình (tứ thân phụ mẫu & kỷ thân), 5 hạt khuy giữ gìn Ngũ thường (Nhân, Lễ, Nghĩa, Trí, Tín).",
    structure: {
      collar: "Cổ đứng lập lĩnh cao vuông vức, nẹp cổ cài khuy kín đáo mực thước",
      sleeves: "Tay chẽn thuôn gọn ôm vừa cánh tay, thuận tiện làm việc và sinh hoạt",
      lapelAndButtons: "5 thân áo khép kín thân thể, 5 khuy bên hữu tượng trưng ngũ thường",
      pattern: "Gấm đoạn dệt chìm hoa văn chữ Thọ chữ Phúc, mây cát tường tao nhã",
    },
    features: [
      "5 thân áo tượng trưng cho tứ thân phụ mẫu và bản thân, 5 khuy giữ gìn nhân lễ",
      "Ống tay chẽn gọn gàng, tôn phom dáng thanh thoát, cội nguồn của tà áo dài Việt",
      "Thường phục chuẩn mực cho cả nam và nữ trong công sở, trường học, dạo phố",
    ],
    colors: [
      { name: "Xanh Chàm Chữ Thọ", hex: "#2B4C6F" },
      { name: "Trắng Lụa Quần", hex: "#F8F7F4" },
      { name: "Đen Khăn Đóng", hex: "#1A1A1A" },
    ],
    citation:
      "Đạo trị quốc chuộng sự mực thước; áo ngũ thân che kín thân mình, năm khuy giữ lễ, răn dạy con người giữ trọn đạo cương thường.",
    sourceBook: "Đại Nam thực lục chính biên",
    imageUrl: "/images/heritage/nguyen_ngu_than_tay_chen.webp",
    thumbUrl: "/images/heritage/thumb_nguyen_ngu_than_tay_chen.webp",
    badge: "Quốc Phục & Cội Nguồn Áo Dài",
  },
];


// Hàm sinh viền ánh vàng hoàng gia và bóng đổ mềm mại đa sắc, tùy biến theo từng trang phục
function getAuraBoxShadow(garment: ReferenceGarment): string {
  const primaryHex = garment.colors[0]?.hex || "#9E2A2B";
  const secondaryHex = garment.colors[1]?.hex || "#D4AF37";
  return `0 25px 50px -12px rgba(0, 0, 0, 0.22), 0 0 0 1.5px rgba(212, 175, 55, 0.55), 0 14px 38px -4px ${primaryHex}35, 0 0 28px -2px ${secondaryHex}25`;
}

// Nhánh Dây Leo Cung Đình Nối Liền Liền Mạch (Scroll-Driven Vine: Lướt đến đâu mọc đến đấy)
function ContinuousHeritageVine() {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [pathLength, setPathLength] = useState<number>(6500);
  const [tipCoord, setTipCoord] = useState<{ x: number; y: number } | null>(null);
  const stemPathRef = React.useRef<SVGPathElement>(null);

  // Tính toán độ dài chính xác của đường cong dây leo khi nạp trang
  useEffect(() => {
    if (stemPathRef.current) {
      try {
        const len = stemPathRef.current.getTotalLength();
        if (len > 0) {
          setPathLength(len);
        }
      } catch {
        // Fallback safe
      }
    }
  }, []);

  // Lắng nghe sự kiện cuộn trang để cập nhật tiến độ vươn dài của ngọn dây leo
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const container = document.getElementById("heritage-timeline-container");
          if (container) {
            const rect = container.getBoundingClientRect();
            const viewportH = window.innerHeight;
            // Trọng tâm thị giác: khoảng 60% chiều cao màn hình
            const focalLine = viewportH * 0.6;
            const currentDistance = focalLine - rect.top;
            const rawProgress = currentDistance / rect.height;
            const progress = Math.max(0, Math.min(1, rawProgress));

            setScrollProgress(progress);

            // Cập nhật vị trí nụ hoa hoàng kim dẫn đường ở đầu ngọn dây leo
            if (stemPathRef.current && pathLength > 0) {
              const currentDist = pathLength * progress;
              if (currentDist > 8 && progress < 0.995) {
                try {
                  const pt = stemPathRef.current.getPointAtLength(currentDist);
                  setTipCoord({ x: pt.x, y: pt.y });
                } catch {
                  // Fallback safe
                }
              } else {
                setTipCoord(null);
              }
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [pathLength]);

  const strokeDashoffset = Math.max(0, pathLength * (1 - scrollProgress));

  // Hàm sinh hiệu ứng đâm chồi nở hoa khi ngọn dây leo chạm tới từng nhánh
  const getBranchStyle = (threshold: number) => ({
    opacity: scrollProgress >= threshold ? 1 : 0,
    transform: scrollProgress >= threshold ? "translateY(0)" : "translateY(20px)",
    transition: "opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
    pointerEvents: (scrollProgress >= threshold ? "auto" : "none") as React.CSSProperties["pointerEvents"],
  });

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible hidden lg:block z-0 select-none opacity-95"
      viewBox="0 0 1200 4400"
      preserveAspectRatio="none"
      fill="none"
    >
      <defs>
        <linearGradient id="continuousVineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C59B27" stopOpacity="0.9" />
          <stop offset="10%" stopColor="#4A5D43" stopOpacity="0.95" />
          <stop offset="22%" stopColor="#8B4513" stopOpacity="0.85" />
          <stop offset="35%" stopColor="#C59B27" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#4A5D43" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#8B4513" stopOpacity="0.85" />
          <stop offset="72%" stopColor="#C59B27" stopOpacity="0.9" />
          <stop offset="85%" stopColor="#4A5D43" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#C59B27" stopOpacity="0.9" />
        </linearGradient>

        <filter id="vineGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 0. NÚT KẾT HOA SEN CỘI NGUỒN TIẾP NỐI TỪ TIÊU ĐỀ HOA LEO (y = 350) */}
      <g id="timeline-origin-flourish">
        <circle cx="600" cy="350" r="7.5" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="600" cy="350" r="3.5" fill="#FFF8DC" />
        <path d="M 590 338 Q 565 328, 575 350 Q 600 345, 590 338 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="0.8" />
        <path d="M 610 362 Q 635 372, 625 350 Q 600 355, 610 362 Z" fill="#6B8560" stroke="#D4AF37" strokeWidth="0.8" />
      </g>

      {/* 1. THÂN DÂY LEO CHÍNH: TIẾP NỐI TỪ NÚT KẾT TIÊU ĐỀ XUYÊN SUỐT 5 TRANG PHỤC */}
      <path
        ref={stemPathRef}
        d="M 600 350
           C 420 400, 100 500, 60 700
           C 20 880, 120 1040, 320 1080
           C 480 1110, 560 1110, 600 1150
           C 680 1200, 1080 1300, 1140 1500
           C 1180 1680, 1080 1840, 880 1880
           C 720 1910, 640 1910, 600 1950
           C 420 2000, 100 2100, 55 2300
           C 15 2480, 110 2640, 310 2680
           C 480 2710, 560 2710, 600 2750
           C 680 2800, 1080 2900, 1145 3100
           C 1185 3280, 1085 3440, 885 3480
           C 720 3510, 640 3510, 600 3550
           C 420 3600, 100 3700, 60 3900
           C 25 4060, 120 4200, 320 4240
           C 460 4270, 560 4280, 600 4350"
        stroke="url(#continuousVineGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={strokeDashoffset}
        style={{
          transition: "stroke-dashoffset 0.16s ease-out",
        }}
      />

      {/* Sợi chỉ vàng hoàng kim phát quang chạy dọc theo thân dây leo đang mọc */}
      <path
        d="M 600 350
           C 420 400, 100 500, 60 700
           C 20 880, 120 1040, 320 1080
           C 480 1110, 560 1110, 600 1150
           C 680 1200, 1080 1300, 1140 1500
           C 1180 1680, 1080 1840, 880 1880
           C 720 1910, 640 1910, 600 1950
           C 420 2000, 100 2100, 55 2300
           C 15 2480, 110 2640, 310 2680
           C 480 2710, 560 2710, 600 2750
           C 680 2800, 1080 2900, 1145 3100
           C 1185 3280, 1085 3440, 885 3480
           C 720 3510, 640 3510, 600 3550
           C 420 3600, 100 3700, 60 3900
           C 25 4060, 120 4200, 320 4240
           C 460 4270, 560 4280, 600 4350"
        stroke="#D4AF37"
        strokeWidth="1.5"
        strokeOpacity="0.8"
        strokeLinecap="round"
        strokeDasharray={pathLength}
        strokeDashoffset={strokeDashoffset}
        filter="url(#vineGlow)"
        style={{
          transition: "stroke-dashoffset 0.16s ease-out",
        }}
      />

      {/* Nụ hoa hoàng kim dẫn đường (Growing Tip Bud) - Bừng sáng tại đúng vị trí ngọn dây đang vươn tới */}
      {scrollProgress > 0.008 && scrollProgress < 0.992 && tipCoord && (
        <g id="vine-tip-glow">
          <circle cx={tipCoord.x} cy={tipCoord.y} r="7.5" fill="#D4AF37" filter="url(#vineGlow)" />
          <circle cx={tipCoord.x} cy={tipCoord.y} r="3.5" fill="#FFF8DC" />
          <circle
            cx={tipCoord.x}
            cy={tipCoord.y}
            r="16"
            stroke="#D4AF37"
            strokeWidth="1.2"
            strokeOpacity="0.5"
            className="animate-ping"
            style={{ transformOrigin: `${tipCoord.x}px ${tipCoord.y}px` }}
          />
        </g>
      )}

      {/* 2. CÁC ĐIỂM NỐI LIỀN MẠCH GIỮA CÁC TRANG PHỤC (CROSSOVER NODES) */}
      {/* Điểm giao thoa 1: Giữa Giao Lĩnh và Viên Lĩnh (y ≈ 1150) */}
      <g id="crossover-1" style={getBranchStyle(0.25)}>
        <circle cx="600" cy="1150" r="6.5" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="600" cy="1150" r="3" fill="#8B4513" />
        <path d="M 590 1135 Q 560 1130, 570 1150 Q 600 1145, 590 1135 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="0.8" />
        <path d="M 610 1165 Q 640 1170, 630 1150 Q 600 1155, 610 1165 Z" fill="#6B8560" stroke="#D4AF37" strokeWidth="0.8" />
      </g>

      {/* Điểm giao thoa 2: Giữa Viên Lĩnh và Nhật Bình (y ≈ 1950) */}
      <g id="crossover-2" style={getBranchStyle(0.43)}>
        <circle cx="600" cy="1950" r="6.5" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="600" cy="1950" r="3" fill="#9E2A2B" />
        <path d="M 610 1935 Q 640 1930, 630 1950 Q 600 1945, 610 1935 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="0.8" />
        <path d="M 590 1965 Q 560 1970, 570 1950 Q 600 1955, 590 1965 Z" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="0.8" />
      </g>

      {/* Điểm giao thoa 3: Giữa Nhật Bình và Áo Tấc (y ≈ 2750) */}
      <g id="crossover-3" style={getBranchStyle(0.61)}>
        <circle cx="600" cy="2750" r="6.5" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="600" cy="2750" r="3" fill="#1D3557" />
        <path d="M 590 2735 Q 560 2730, 570 2750 Q 600 2745, 590 2735 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="0.8" />
        <path d="M 610 2765 Q 640 2770, 630 2750 Q 600 2755, 610 2765 Z" fill="#2B4C6F" stroke="#D4AF37" strokeWidth="0.8" />
      </g>

      {/* Điểm giao thoa 4: Giữa Áo Tấc và Ngũ Thân (y ≈ 3550) */}
      <g id="crossover-4" style={getBranchStyle(0.79)}>
        <circle cx="600" cy="3550" r="6.5" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="600" cy="3550" r="3" fill="#8B4513" />
        <path d="M 610 3535 Q 640 3530, 630 3550 Q 600 3545, 610 3535 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="0.8" />
        <path d="M 590 3565 Q 560 3570, 570 3550 Q 600 3555, 590 3565 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="0.8" />
      </g>

      {/* 3. HỆ THỐNG 15 NHÁNH LEO ĐỘC BẢN - ĐÂM CHỒI NỞ HOA KHI DÂY LEO VƯƠN TỚI */}

      {/* [NHÁNH 1 - y ≈ 390]: Nhánh cúc ngọc vươn cao đón mây */}
      <g id="branch-1" style={getBranchStyle(0.08)}>
        <path d="M 520 390 C 460 355, 380 340, 330 365 Q 290 385, 320 415" stroke="#C59B27" strokeWidth="2.5" />
        <path d="M 450 365 Q 420 335, 390 355 Q 420 385, 450 365 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 370 350 Q 340 325, 320 345 Q 350 370, 370 350 Z" fill="#5E7854" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="320" cy="415" r="5" fill="#D4AF37" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 2 - y ≈ 540]: Nhánh chạc ba lá sen cổ ôm sườn Giao Lĩnh */}
      <g id="branch-2" style={getBranchStyle(0.11)}>
        <path d="M 160 530 C 100 490, 50 500, 20 460" stroke="#4A5D43" strokeWidth="2.5" />
        <path d="M 20 460 Q -5 435, 10 410 Q 35 400, 45 425" stroke="#C59B27" strokeWidth="2" />
        <path d="M 110 500 Q 75 465, 55 485 Q 90 520, 110 500 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 125 515 Q 155 480, 175 500 Q 145 535, 125 515 Z" fill="#6B8560" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="45" cy="425" r="4.5" fill="#E5C158" />
      </g>

      {/* [NHÁNH 3 - y ≈ 740]: Nhánh tua cuốn hoa đào buông rủ sườn trái */}
      <g id="branch-3" style={getBranchStyle(0.16)}>
        <path d="M 58 740 C 15 770, -10 830, 15 880 C 35 915, 5 955, -15 990" stroke="#7D4E41" strokeWidth="2.5" />
        <path d="M -15 990 Q -40 1020, -20 1045 Q 5 1040, 0 1010" stroke="#C59B27" strokeWidth="2" />
        <path d="M 18 830 Q -15 820, -25 850 Q 5 870, 18 830 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 22 895 Q 55 885, 60 915 Q 30 930, 22 895 Z" fill="#5E7854" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="0" cy="1010" r="5" fill="#D4AF37" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 4 - y ≈ 1060]: Nhánh hoa cúc dây đài vàng dưới chân Giao Lĩnh */}
      <g id="branch-4" style={getBranchStyle(0.23)}>
        <path d="M 330 1080 C 400 1055, 470 1010, 490 960" stroke="#4A5D43" strokeWidth="2.5" />
        <path d="M 490 960 Q 520 930, 545 950 Q 540 980, 510 975" stroke="#C59B27" strokeWidth="2" />
        <path d="M 400 1050 Q 430 1080, 450 1060 Q 420 1030, 400 1050 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 455 1000 Q 485 1030, 505 1010 Q 475 980, 455 1000 Z" fill="#5E7854" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="510" cy="975" r="7" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="510" cy="975" r="3.5" fill="#8B4513" />
      </g>

      {/* [NHÁNH 5 - y ≈ 1210]: Nhánh lá tre ngọc vươn chéo chuyển làn */}
      <g id="branch-5" style={getBranchStyle(0.26)}>
        <path d="M 700 1210 C 780 1170, 860 1180, 910 1150" stroke="#C59B27" strokeWidth="2.5" />
        <path d="M 910 1150 Q 940 1130, 930 1100 Q 900 1090, 905 1120" stroke="#4A5D43" strokeWidth="2" />
        <path d="M 760 1190 Q 770 1150, 805 1165 Q 795 1205, 760 1190 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 830 1175 Q 840 1135, 875 1150 Q 865 1190, 830 1175 Z" fill="#6B8560" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="905" cy="1120" r="4.5" fill="#E5C158" />
      </g>

      {/* [NHÁNH 6 - y ≈ 1360]: Nhánh hoàng triều thêu rồng đỉnh Viên Lĩnh */}
      <g id="branch-6" style={getBranchStyle(0.30)}>
        <path d="M 1040 1360 C 1110 1330, 1180 1345, 1225 1310" stroke="#4A3258" strokeWidth="2.5" />
        <path d="M 1225 1310 Q 1255 1285, 1245 1255 Q 1215 1250, 1220 1280" stroke="#C59B27" strokeWidth="2" />
        <path d="M 1100 1340 Q 1120 1305, 1150 1325 Q 1130 1360, 1100 1340 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 1160 1325 Q 1180 1290, 1210 1310 Q 1190 1345, 1160 1325 Z" fill="#4A3258" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="1220" cy="1280" r="5.5" fill="#C89A38" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 7 - y ≈ 1620]: Nhánh lượn sóng Thủy Ba sườn phải Viên Lĩnh */}
      <g id="branch-7" style={getBranchStyle(0.36)}>
        <path d="M 1155 1620 C 1210 1655, 1235 1720, 1190 1770 C 1160 1805, 1205 1845, 1230 1880" stroke="#2B4A6F" strokeWidth="2.5" />
        <path d="M 1230 1880 Q 1260 1910, 1240 1940 Q 1210 1930, 1215 1900" stroke="#C59B27" strokeWidth="2" />
        <path d="M 1200 1690 Q 1235 1700, 1225 1730 Q 1190 1720, 1200 1690 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 1185 1790 Q 1150 1800, 1160 1830 Q 1195 1820, 1185 1790 Z" fill="#2B4A6F" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="1215" cy="1900" r="5" fill="#D4AF37" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 8 - y ≈ 1860]: Nhánh hoa cúc cung đình dưới chân Viên Lĩnh */}
      <g id="branch-8" style={getBranchStyle(0.41)}>
        <path d="M 870 1880 C 790 1855, 720 1810, 680 1760" stroke="#C59B27" strokeWidth="2.5" />
        <path d="M 680 1760 Q 650 1730, 625 1750 Q 630 1780, 660 1775" stroke="#4A5D43" strokeWidth="2" />
        <path d="M 790 1850 Q 760 1880, 740 1860 Q 770 1830, 790 1850 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 730 1800 Q 700 1830, 680 1810 Q 710 1780, 730 1800 Z" fill="#4A3258" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="660" cy="1775" r="6" fill="#C89A38" filter="url(#vineGlow)" />
        <circle cx="660" cy="1775" r="3" fill="#4A3258" />
      </g>

      {/* [NHÁNH 9 - y ≈ 2030]: Nhánh ngũ hành ngũ sắc chuyển sang Nhật Bình */}
      <g id="branch-9" style={getBranchStyle(0.45)}>
        <path d="M 490 2030 C 420 2060, 350 2050, 295 2085" stroke="#9E2A2B" strokeWidth="2.5" />
        <path d="M 295 2085 Q 265 2105, 275 2135 Q 305 2140, 300 2110" stroke="#C59B27" strokeWidth="2" />
        <path d="M 410 2050 Q 395 2015, 430 2000 Q 445 2035, 410 2050 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 350 2065 Q 335 2030, 370 2015 Q 385 2050, 350 2065 Z" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="300" cy="2110" r="5" fill="#D4AF37" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 10 - y ≈ 2270]: Nhánh phượng hoàng uốn lượn sườn Nhật Bình */}
      <g id="branch-10" style={getBranchStyle(0.50)}>
        <path d="M 55 2270 C 10 2240, -20 2290, 5 2340 C 25 2375, -10 2420, -20 2465" stroke="#D4AF37" strokeWidth="2.5" />
        <path d="M -20 2465 Q -45 2495, -25 2520 Q 0 2515, -5 2485" stroke="#9E2A2B" strokeWidth="2" />
        <path d="M 15 2320 Q -20 2310, -30 2340 Q 5 2360, 15 2320 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 18 2390 Q 50 2380, 55 2410 Q 25 2425, 18 2390 Z" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="-5" cy="2485" r="5.5" fill="#9E2A2B" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 11 - y ≈ 2660]: Nhánh hoa đào chu sa chân Nhật Bình */}
      <g id="branch-11" style={getBranchStyle(0.59)}>
        <path d="M 320 2680 C 400 2655, 480 2620, 510 2570" stroke="#4A5D43" strokeWidth="2.5" />
        <path d="M 510 2570 Q 540 2540, 565 2560 Q 560 2590, 530 2585" stroke="#C59B27" strokeWidth="2" />
        <path d="M 390 2650 Q 420 2680, 440 2660 Q 410 2630, 390 2650 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 450 2605 Q 480 2635, 500 2615 Q 470 2585, 450 2605 Z" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="530" cy="2585" r="7.5" fill="#9E2A2B" filter="url(#vineGlow)" />
        <circle cx="530" cy="2585" r="3.5" fill="#D4AF37" />
      </g>

      {/* [NHÁNH 12 - y ≈ 2970]: Nhánh lễ nhạc gấm lụa đỉnh Áo Tấc */}
      <g id="branch-12" style={getBranchStyle(0.66)}>
        <path d="M 1060 2970 C 1130 2940, 1200 2955, 1235 2915" stroke="#1D3557" strokeWidth="2.5" />
        <path d="M 1235 2915 Q 1265 2890, 1255 2860 Q 1225 2855, 1230 2885" stroke="#C59B27" strokeWidth="2" />
        <path d="M 1120 2950 Q 1140 2915, 1170 2935 Q 1150 2970, 1120 2950 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 1180 2935 Q 1200 2900, 1230 2920 Q 1210 2955, 1180 2935 Z" fill="#1D3557" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="1230" cy="2885" r="5" fill="#C59B27" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 13 - y ≈ 3240]: Nhánh rồng cuộn tam sơn sườn phải Áo Tấc */}
      <g id="branch-13" style={getBranchStyle(0.72)}>
        <path d="M 1160 3240 C 1220 3275, 1245 3340, 1200 3390 C 1170 3425, 1215 3470, 1235 3510" stroke="#8B1E1E" strokeWidth="2.5" />
        <path d="M 1235 3510 Q 1265 3540, 1245 3570 Q 1215 3560, 1220 3530" stroke="#C59B27" strokeWidth="2" />
        <path d="M 1205 3310 Q 1240 3320, 1230 3350 Q 1195 3340, 1205 3310 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 1195 3410 Q 1160 3420, 1170 3450 Q 1205 3440, 1195 3410 Z" fill="#8B1E1E" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="1220" cy="3530" r="5.5" fill="#D4AF37" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 14 - y ≈ 3770]: Nhánh chữ Thọ cát tường sườn Ngũ Thân */}
      <g id="branch-14" style={getBranchStyle(0.84)}>
        <path d="M 110 3770 C 45 3740, 5 3790, 20 3840 C 35 3875, 5 3920, -15 3960" stroke="#2B4C6F" strokeWidth="2.5" />
        <path d="M -15 3960 Q -40 3990, -20 4015 Q 5 4010, 0 3980" stroke="#C59B27" strokeWidth="2" />
        <path d="M 30 3820 Q -5 3810, -15 3840 Q 20 3860, 30 3820 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 28 3890 Q 60 3880, 65 3910 Q 35 3925, 28 3890 Z" fill="#2B4C6F" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="0" cy="3980" r="5" fill="#D4AF37" filter="url(#vineGlow)" />
      </g>

      {/* [NHÁNH 15 - y ≈ 4260]: Nhánh hoa sen hoàng kim đại kết thúc */}
      <g id="branch-15" style={getBranchStyle(0.95)}>
        <path d="M 340 4240 C 420 4275, 510 4295, 570 4310" stroke="#C59B27" strokeWidth="3" />
        <path d="M 570 4310 Q 610 4325, 630 4300 Q 610 4270, 580 4285" stroke="#4A5D43" strokeWidth="2.5" />
        <path d="M 400 4255 Q 430 4285, 450 4265 Q 420 4235, 400 4255 Z" fill="#4A5D43" stroke="#D4AF37" strokeWidth="1" />
        <path d="M 470 4280 Q 500 4310, 520 4290 Q 490 4260, 470 4280 Z" fill="#6B8560" stroke="#D4AF37" strokeWidth="1" />
        <circle cx="580" cy="4285" r="9" fill="#D4AF37" filter="url(#vineGlow)" />
        <circle cx="580" cy="4285" r="4.5" fill="#8B4513" />
      </g>
    </svg>
  );
}

// --- HỆ THỐNG HÀO QUANG & HỌA TIẾT CUNG ĐÌNH CUSTOM ĐỘC BẢN RIÊNG CHO TỪNG TRANG PHỤC ---

// 1. GIAO LĨNH (Lý - Trần - Lê): Hào quang Bát Giác Hoa Sen & Họa tiết Lá Đề Ngọn Lửa
function GiaoLinhAuraAndMotif({ id }: { id: string }) {
  return (
    <>
      {/* Vầng Hào Quang Đa Sắc Riêng: Đỏ Chu Sa, Lục Bích & Hoàng Kim */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(139, 30, 30, 0.32) 0%, rgba(45, 106, 79, 0.22) 42%, rgba(212, 175, 55, 0.16) 65%, transparent 78%)`,
        }}
      />
      <div
        className="absolute inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 48%, rgba(212, 175, 55, 0.28) 0%, rgba(45, 106, 79, 0.15) 50%, transparent 70%)`,
        }}
      />

      {/* Vòng Hào Quang Xoay Riêng: Mandala Bát Giác Hoa Sen Thời Lý (8-Petal Sacred Lotus) */}
      <svg
        viewBox="0 0 540 660"
        fill="none"
        className="absolute inset-0 w-full h-full overflow-visible animate-spin-slow pointer-events-none opacity-90"
        style={{ animationDuration: "50s" }}
      >
        <g transform="translate(270, 310)">
          {/* Vành hoa sen bát giác */}
          <polygon
            points="0,-235 166,-166 235,0 166,166 0,235 -166,166 -235,0 -166,-166"
            stroke="#D4AF37"
            strokeWidth="1.5"
            strokeDasharray="4 6"
            strokeOpacity="0.55"
            fill="none"
          />
          <circle cx="0" cy="0" r="215" stroke="#2D6A4F" strokeWidth="1.2" strokeOpacity="0.45" />
          <circle cx="0" cy="0" r="195" stroke="#D4AF37" strokeWidth="0.8" strokeDasharray="2 4" strokeOpacity="0.6" />

          {/* 8 Cánh sen ngọc bích tỏa hào quang thái cực */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <g key={i} transform={`rotate(${angle})`}>
              <path
                d="M 0 -195 C -15 -215, -12 -238, 0 -252 C 12 -238, 15 -215, 0 -195 Z"
                fill="rgba(139, 30, 30, 0.25)"
                stroke="#D4AF37"
                strokeWidth="1.2"
              />
              <circle cx="0" cy="-252" r="3.5" fill="#D4AF37" />
              <circle cx="0" cy="-252" r="1.5" fill="#FFF8DC" />
            </g>
          ))}
        </g>
      </svg>

      {/* Bộ Họa Tiết Điển Tích Độc Bản: Hoa Sen & Lá Đề Triều Lý */}
      <svg viewBox="0 0 540 660" fill="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          <filter id={`auraGlow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Đỉnh Đầu: Đóa Sen Đại Việt & Vành Lá Đề Ngọn Lửa Thời Lý */}
        <g id="giao-linh-top-crest">
          <path
            d="M 270 8 C 235 32, 205 65, 215 108 C 225 138, 250 150, 270 152 C 290 150, 315 138, 325 108 C 335 65, 305 32, 270 8 Z"
            stroke="#D4AF37"
            strokeWidth="2.4"
            fill="rgba(139, 30, 30, 0.25)"
            filter={`url(#auraGlow-${id})`}
          />
          {/* Ngọn Lửa Lá Đề Cuộn */}
          <path d="M 270 8 Q 262 25, 270 38 Q 278 25, 270 8 Z" fill="#D4AF37" />
          <path d="M 235 32 Q 225 48, 240 52 Q 248 38, 235 32 Z" fill="#2D6A4F" stroke="#D4AF37" strokeWidth="0.8" />
          <path d="M 305 32 Q 315 48, 300 52 Q 292 38, 305 32 Z" fill="#2D6A4F" stroke="#D4AF37" strokeWidth="0.8" />
          <circle cx="270" cy="95" r="16" fill="rgba(212, 175, 55, 0.35)" stroke="#D4AF37" strokeWidth="1.6" />
          <circle cx="270" cy="95" r="7" fill="#D4AF37" />
          <circle cx="270" cy="95" r="3" fill="#FFF8DC" />
        </g>

        {/* Sườn Hai Bên: Vân Mây Cuộn Đại Việt & Dải Cúc Dây Triều Trần */}
        <g transform="translate(18, 240)">
          <path d="M 20 0 C -8 20, -12 55, 12 75 C 32 90, 25 125, 5 140" stroke="#D4AF37" strokeWidth="2.2" fill="none" />
          <path d="M 8 45 Q -12 40, -2 60 Q 18 55, 8 45 Z" fill="#2D6A4F" stroke="#D4AF37" strokeWidth="1" />
          <circle cx="5" cy="140" r="5" fill="#D4AF37" />
        </g>
        <g transform="translate(482, 240)">
          <path d="M 20 0 C 48 20, 52 55, 28 75 C 8 90, 15 125, 35 140" stroke="#D4AF37" strokeWidth="2.2" fill="none" />
          <path d="M 32 45 Q 52 40, 42 60 Q 22 55, 32 45 Z" fill="#2D6A4F" stroke="#D4AF37" strokeWidth="1" />
          <circle cx="35" cy="140" r="5" fill="#D4AF37" />
        </g>

        {/* Chân Đế: Bệ Sen Tam Cấp Thời Lý - Trần */}
        <g transform="translate(0, 585)">
          <path d="M 160 30 C 195 12, 235 12, 270 28 C 305 12, 345 12, 380 30" stroke="#D4AF37" strokeWidth="2.8" fill="none" />
          <path d="M 180 46 C 215 30, 245 30, 270 44 C 295 30, 325 30, 360 46" stroke="#8B1E1E" strokeWidth="2.2" fill="none" />
          <circle cx="270" cy="28" r="6" fill="#D4AF37" />
          <circle cx="215" cy="20" r="4.5" fill="#D4AF37" />
          <circle cx="325" cy="20" r="4.5" fill="#D4AF37" />
        </g>
      </svg>
    </>
  );
}

// 2. VIÊN LĨNH (Lý - Trần - Lê - Nguyễn): Hào quang Mây Lửa Tử Khí & Rồng Cuộn Sóng Nước Thủy Ba
function VienLinhAuraAndMotif({ id }: { id: string }) {
  return (
    <>
      {/* Vầng Hào Quang Đa Sắc Riêng: Tím Hoàng Gia Tử Khí, Lam Chàm Thủy Ba & Vàng Vương Triều */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(74, 50, 88, 0.38) 0%, rgba(29, 53, 87, 0.25) 45%, rgba(212, 175, 55, 0.18) 66%, transparent 78%)`,
        }}
      />
      <div
        className="absolute inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(212, 175, 55, 0.3) 0%, rgba(74, 50, 88, 0.18) 55%, transparent 72%)`,
        }}
      />

      {/* Vòng Hào Quang Xoay Riêng: Vòng Mây Lửa Hoàng Triều & Đĩa Nhật Nguyệt (Dragon Flame Wheel) */}
      <svg
        viewBox="0 0 540 660"
        fill="none"
        className="absolute inset-0 w-full h-full overflow-visible animate-spin-slow pointer-events-none opacity-90"
        style={{ animationDuration: "56s" }}
      >
        <g transform="translate(270, 310)">
          {/* Vành vảy rồng hoàng triều */}
          <circle cx="0" cy="0" r="238" stroke="#D4AF37" strokeWidth="1.8" strokeDasharray="6 6" strokeOpacity="0.6" />
          <circle cx="0" cy="0" r="218" stroke="#4A3258" strokeWidth="1.4" strokeOpacity="0.5" />
          <circle cx="0" cy="0" r="198" stroke="#1D3557" strokeWidth="1" strokeOpacity="0.45" />

          {/* 12 Tia mây lửa hoàng triều tỏa ra 12 phương vị vương quyền */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 360) / 12;
            return (
              <g key={i} transform={`rotate(${angle})`}>
                <path
                  d="M 0 -200 C -8 -215, -16 -230, -6 -245 C 4 -235, 12 -220, 0 -200 Z"
                  fill="#D4AF37"
                  stroke="#4A3258"
                  strokeWidth="0.8"
                />
                <circle cx="-6" cy="-245" r="3.5" fill="#D4AF37" />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Bộ Họa Tiết Điển Tích Độc Bản: Hạt Châu Lửa & Sóng Nước Tam Sơn */}
      <svg viewBox="0 0 540 660" fill="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          <filter id={`auraGlow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Đỉnh Đầu: Hạt Châu Lửa & Sừng Rồng Uy Nghiêm */}
        <g id="dragon-pearl-head">
          <circle cx="270" cy="36" r="12" fill="#D4AF37" filter={`url(#auraGlow-${id})`} />
          <circle cx="270" cy="36" r="6" fill="#FFF8DC" />
          {/* Tia lửa 4 hướng */}
          <path d="M 270 12 Q 278 22, 270 28 Q 262 22, 270 12 Z" fill="#D4AF37" />
          <path d="M 270 44 Q 278 50, 270 60 Q 262 50, 270 44 Z" fill="#D4AF37" />
          {/* Râu Rồng Uốn Lượn Sang 2 Bên */}
          <path d="M 255 40 C 228 32, 200 16, 170 26 C 150 34, 155 54, 180 48" stroke="#D4AF37" strokeWidth="2.8" fill="none" />
          <path d="M 285 40 C 312 32, 340 16, 370 26 C 390 34, 385 54, 360 48" stroke="#D4AF37" strokeWidth="2.8" fill="none" />
        </g>

        {/* Sườn Hai Bên: Móng Rồng Chầu & Mây Ngũ Sắc */}
        <g transform="translate(15, 230)">
          <path d="M 18 0 C -4 20, -8 50, 12 70 C 28 85, 36 110, 22 130" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 8 40 Q -12 35, -2 55 Q 18 50, 8 40 Z" fill="#4A3258" stroke="#D4AF37" strokeWidth="1" />
          <circle cx="22" cy="130" r="5" fill="#D4AF37" />
        </g>
        <g transform="translate(485, 230)">
          <path d="M 22 0 C 44 20, 48 50, 28 70 C 12 85, 4 110, 18 130" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 32 40 Q 52 35, 42 55 Q 22 50, 32 40 Z" fill="#4A3258" stroke="#D4AF37" strokeWidth="1" />
          <circle cx="18" cy="130" r="5" fill="#D4AF37" />
        </g>

        {/* Chân Đế: Đại Cảnh SÓNG NƯỚC THỦY BA & BA NGỌN NÚI THIÊNG (TAM SƠN) */}
        <g transform="translate(0, 565)" id="thuy-ba-tam-son">
          <polygon points="270,4 290,48 250,48" fill="#1D3557" stroke="#D4AF37" strokeWidth="2" />
          <polygon points="234,18 252,52 216,52" fill="#2B4A6F" stroke="#D4AF37" strokeWidth="1.6" />
          <polygon points="306,18 324,52 288,52" fill="#2B4A6F" stroke="#D4AF37" strokeWidth="1.6" />
          {/* 3 Tầng sóng cuộn */}
          <path d="M 100 48 C 145 28, 190 58, 230 38 C 250 28, 290 28, 310 38 C 350 58, 395 28, 440 48" stroke="#D4AF37" strokeWidth="3" fill="none" />
          <path d="M 120 62 C 165 42, 210 68, 250 50 C 270 44, 270 44, 290 50 C 330 68, 375 42, 420 62" stroke="#1D3557" strokeWidth="2.4" fill="none" />
          <circle cx="270" cy="48" r="5" fill="#D4AF37" />
        </g>
      </svg>
    </>
  );
}

// 3. NHẬT BÌNH (Triều Nguyễn): Hào quang Ngũ Sắc Cung Đình & Song Phụng Chầu Sen
function NhatBinhAuraAndMotif({ id }: { id: string }) {
  return (
    <>
      {/* Vầng Hào Quang Đa Sắc Riêng: 5 Sắc Màu Ngũ Hành (Đỏ Chu Sa, Vàng Kim, Lam Hoàng Tộc, Lục Thủy) */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(158, 42, 43, 0.4) 0%, rgba(212, 175, 55, 0.25) 32%, rgba(30, 58, 138, 0.2) 54%, rgba(21, 128, 61, 0.14) 70%, transparent 82%)`,
        }}
      />
      <div
        className="absolute inset-6 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 48%, rgba(212, 175, 55, 0.32) 0%, rgba(158, 42, 43, 0.2) 50%, transparent 72%)`,
        }}
      />

      {/* Vòng Hào Quang Xoay Riêng: Vành Hoa Mai & Dải Ngũ Sắc Lụa Cung Đình Huế (Hue Imperial Five-Color Wheel) */}
      <svg
        viewBox="0 0 540 660"
        fill="none"
        className="absolute inset-0 w-full h-full overflow-visible animate-spin-slow pointer-events-none opacity-95"
        style={{ animationDuration: "52s" }}
      >
        <g transform="translate(270, 310)">
          {/* 5 Vòng đồng tâm tương sinh đại diện cho 5 màu ống tay áo Nhật Bình */}
          <circle cx="0" cy="0" r="242" stroke="#9E2A2B" strokeWidth="2.2" strokeOpacity="0.65" />
          <circle cx="0" cy="0" r="230" stroke="#D4AF37" strokeWidth="2" strokeOpacity="0.75" />
          <circle cx="0" cy="0" r="218" stroke="#1E3A8A" strokeWidth="1.8" strokeOpacity="0.6" />
          <circle cx="0" cy="0" r="206" stroke="#15803D" strokeWidth="1.6" strokeOpacity="0.55" />
          <circle cx="0" cy="0" r="194" stroke="#FFF8DC" strokeWidth="1.4" strokeDasharray="4 6" strokeOpacity="0.7" />

          {/* 10 Cánh phượng hoàng xòe rộng tỏa hào quang */}
          {[...Array(10)].map((_, i) => {
            const angle = (i * 360) / 10;
            return (
              <g key={i} transform={`rotate(${angle})`}>
                <path
                  d="M 0 -194 C -12 -214, -8 -238, 0 -256 C 8 -238, 12 -214, 0 -194 Z"
                  fill="#9E2A2B"
                  stroke="#D4AF37"
                  strokeWidth="1.2"
                />
                <circle cx="0" cy="-256" r="3.8" fill="#D4AF37" />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Bộ Họa Tiết Điển Tích Độc Bản: Song Phụng Chầu Sen & Cổ Diềm Ngũ Sắc */}
      <svg viewBox="0 0 540 660" fill="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          <filter id={`auraGlow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Đỉnh Đầu: Đóa Sen Cung Nữ & ĐÔI CHIM LOAN PHỤNG */}
        <g id="nhat-binh-crest">
          <path d="M 270 14 C 252 34, 252 56, 270 62 C 288 56, 288 34, 270 14 Z" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="2" filter={`url(#auraGlow-${id})`} />
          <circle cx="270" cy="38" r="6" fill="#D4AF37" />
          {/* Chim Loan Bên Trái */}
          <g id="left-phoenix">
            <circle cx="210" cy="34" r="6" fill="#D4AF37" />
            <path d="M 210 38 C 194 46, 175 30, 152 36 C 138 40, 142 56, 165 54 C 185 52, 195 68, 182 80" stroke="#D4AF37" strokeWidth="2.5" fill="none" />
            <path d="M 182 80 C 158 98, 122 140, 105 190 C 88 235, 98 285, 80 330" stroke="#D4AF37" strokeWidth="2.2" fill="none" />
            <circle cx="105" cy="190" r="5" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="1.2" />
            <circle cx="80" cy="330" r="4.5" fill="#D4AF37" />
          </g>
          {/* Chim Phụng Bên Phải */}
          <g id="right-phoenix">
            <circle cx="330" cy="34" r="6" fill="#D4AF37" />
            <path d="M 330 38 C 346 46, 365 30, 388 36 C 402 40, 398 56, 375 54 C 355 52, 345 68, 358 80" stroke="#D4AF37" strokeWidth="2.5" fill="none" />
            <path d="M 358 80 C 382 98, 418 140, 435 190 C 452 235, 442 285, 460 330" stroke="#D4AF37" strokeWidth="2.2" fill="none" />
            <circle cx="435" cy="190" r="5" fill="#9E2A2B" stroke="#D4AF37" strokeWidth="1.2" />
            <circle cx="460" cy="330" r="4.5" fill="#D4AF37" />
          </g>
        </g>

        {/* Chân Đế: Cổ Diềm Ngũ Sắc & Hoa Mai Cung Đình Huế */}
        <g transform="translate(0, 580)">
          <path d="M 115 38 C 160 18, 212 46, 270 30 C 328 46, 380 18, 425 38" stroke="#9E2A2B" strokeWidth="3" fill="none" />
          <path d="M 130 50 C 175 30, 222 56, 270 42 C 318 56, 365 30, 410 50" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 145 62 C 190 44, 232 66, 270 54 C 308 66, 350 44, 395 62" stroke="#1E3A8A" strokeWidth="2" fill="none" />
          <circle cx="270" cy="30" r="7" fill="#D4AF37" />
          <circle cx="270" cy="30" r="3.5" fill="#9E2A2B" />
        </g>
      </svg>
    </>
  );
}

// 4. ÁO TẤC (Triều Nguyễn): Hào quang Kim Khánh & Tam Sơn Bát Bửu Đại Lễ
function AoTacAuraAndMotif({ id }: { id: string }) {
  return (
    <>
      {/* Vầng Hào Quang Đa Sắc Riêng: Lam Chàm Gấm Đoạn, Đỏ Lót Tay Áo & Vàng Kim Rồng Cuộn */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(29, 53, 87, 0.4) 0%, rgba(139, 30, 30, 0.25) 45%, rgba(197, 155, 39, 0.18) 66%, transparent 78%)`,
        }}
      />
      <div
        className="absolute inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(197, 155, 39, 0.3) 0%, rgba(29, 53, 87, 0.18) 55%, transparent 72%)`,
        }}
      />

      {/* Vòng Hào Quang Xoay Riêng: Ngôi Sao Bát Bửu Hoàng Triều (Octagram Royal Chime Wheel) */}
      <svg
        viewBox="0 0 540 660"
        fill="none"
        className="absolute inset-0 w-full h-full overflow-visible animate-spin-slow pointer-events-none opacity-90"
        style={{ animationDuration: "54s" }}
      >
        <g transform="translate(270, 310)">
          {/* Vành hồi văn chữ Vạn liên hoàn */}
          <circle cx="0" cy="0" r="240" stroke="#C59B27" strokeWidth="2" strokeDasharray="5 5" strokeOpacity="0.65" />
          <circle cx="0" cy="0" r="220" stroke="#1D3557" strokeWidth="1.6" strokeOpacity="0.55" />
          <circle cx="0" cy="0" r="200" stroke="#8B1E1E" strokeWidth="1.2" strokeOpacity="0.5" />

          {/* 8 Tia sáng khánh vàng bát bửu */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <g key={i} transform={`rotate(${angle})`}>
              <line x1="0" y1="-200" x2="0" y2="-252" stroke="#D4AF37" strokeWidth="2.2" />
              <polygon points="0,-258 5,-250 -5,-250" fill="#D4AF37" />
              <circle cx="0" cy="-226" r="3" fill="#8B1E1E" />
            </g>
          ))}
        </g>
      </svg>

      {/* Bộ Họa Tiết Điển Tích Độc Bản: Kim Khánh Triều Đình & Dải Gấm Tay Thụng */}
      <svg viewBox="0 0 540 660" fill="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          <filter id={`auraGlow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Đỉnh Đầu: KIM KHÁNH TRIỀU ĐÌNH với 3 Dải Lụa Đỏ Buông Rủ */}
        <g id="kim-khanh-crest">
          <path
            d="M 270 14 C 220 14, 186 30, 166 52 C 195 58, 242 42, 270 42 C 298 42, 345 58, 374 52 C 354 30, 320 14, 270 14 Z"
            fill="rgba(212, 175, 55, 0.32)"
            stroke="#D4AF37"
            strokeWidth="2.8"
            filter={`url(#auraGlow-${id})`}
          />
          <circle cx="270" cy="28" r="6" fill="#D4AF37" />
          {/* 3 Dải lụa đỏ buông rủ */}
          <path d="M 270 42 L 270 80" stroke="#8B1E1E" strokeWidth="3" />
          <circle cx="270" cy="80" r="5" fill="#D4AF37" />
          <path d="M 226 48 L 218 78" stroke="#D4AF37" strokeWidth="2" />
          <circle cx="218" cy="78" r="4" fill="#8B1E1E" />
          <path d="M 314 48 L 322 78" stroke="#D4AF37" strokeWidth="2" />
          <circle cx="322" cy="78" r="4" fill="#8B1E1E" />
        </g>

        {/* Sườn Hai Bên: Dải Lụa Tay Thụng & Mây Bát Bửu */}
        <g transform="translate(18, 230)">
          <path d="M 20 0 C -6 25, -4 60, 16 85 C 32 105, 26 135, 10 150" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 12 48 Q -8 42, 2 62 Q 22 56, 12 48 Z" fill="#1D3557" stroke="#D4AF37" strokeWidth="1.2" />
          <circle cx="10" cy="150" r="5" fill="#D4AF37" />
        </g>
        <g transform="translate(482, 230)">
          <path d="M 20 0 C 46 25, 44 60, 24 85 C 8 105, 14 135, 30 150" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 28 48 Q 48 42, 38 62 Q 18 56, 28 48 Z" fill="#1D3557" stroke="#D4AF37" strokeWidth="1.2" />
          <circle cx="30" cy="150" r="5" fill="#D4AF37" />
        </g>

        {/* Chân Đế: Họa Tiết Tam Sơn Đại Lễ & Bát Bửu */}
        <g transform="translate(0, 580)">
          <polygon points="270,10 292,52 248,52" fill="#1D3557" stroke="#D4AF37" strokeWidth="2.2" />
          <path d="M 125 52 C 172 32, 218 58, 270 46 C 322 58, 368 32, 415 52" stroke="#D4AF37" strokeWidth="2.8" fill="none" />
          <path d="M 145 68 C 188 48, 228 72, 270 60 C 312 72, 352 48, 395 68" stroke="#8B1E1E" strokeWidth="2.2" fill="none" />
          <circle cx="270" cy="46" r="5.5" fill="#D4AF37" />
        </g>
      </svg>
    </>
  );
}

// 5. NGŨ THÂN (Triều Nguyễn): Hào quang Ngũ Phúc Triện Thọ & Đóa Sen Cát Tường
function NguThanAuraAndMotif({ id }: { id: string }) {
  return (
    <>
      {/* Vầng Hào Quang Đa Sắc Riêng: Xanh Chàm Chữ Thọ, Vàng Kim Phúc Lộc & Trắng Lụa */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none animate-pulse-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(43, 76, 111, 0.38) 0%, rgba(212, 175, 55, 0.24) 44%, rgba(248, 247, 244, 0.14) 65%, transparent 78%)`,
        }}
      />
      <div
        className="absolute inset-8 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(212, 175, 55, 0.32) 0%, rgba(43, 76, 111, 0.2) 55%, transparent 72%)`,
        }}
      />

      {/* Vòng Hào Quang Xoay Riêng: Vòng 5 Dơi Phúc & Đĩa Ngọc Chữ Thọ (Five Bats of Longevity Mandala) */}
      <svg
        viewBox="0 0 540 660"
        fill="none"
        className="absolute inset-0 w-full h-full overflow-visible animate-spin-slow pointer-events-none opacity-90"
        style={{ animationDuration: "50s" }}
      >
        <g transform="translate(270, 310)">
          {/* Vành ngọc châu ngũ thường */}
          <circle cx="0" cy="0" r="238" stroke="#D4AF37" strokeWidth="1.8" strokeDasharray="4 8" strokeOpacity="0.65" />
          <circle cx="0" cy="0" r="218" stroke="#2B4C6F" strokeWidth="1.5" strokeOpacity="0.55" />
          <circle cx="0" cy="0" r="198" stroke="#D4AF37" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.5" />

          {/* 5 Cánh dơi phúc hoàng kim quay quanh trục tâm chữ Thọ */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <g key={i} transform={`rotate(${angle})`}>
              <path
                d="M 0 -228 Q -10 -240, -18 -234 Q -12 -224, 0 -220 Q 12 -224, 18 -234 Q 10 -240, 0 -228 Z"
                fill="#D4AF37"
                stroke="#2B4C6F"
                strokeWidth="0.8"
              />
              <circle cx="0" cy="-250" r="3.2" fill="#D4AF37" />
            </g>
          ))}
        </g>
      </svg>

      {/* Bộ Họa Tiết Điển Tích Độc Bản: Huy Hiệu Ngũ Phúc Triện Thọ & Hồi Văn Chữ Thọ */}
      <svg viewBox="0 0 540 660" fill="none" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        <defs>
          <filter id={`auraGlow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Đỉnh Đầu: ĐẠI HUY HIỆU NGŨ PHÚC LÂM MÔN (5 Dơi Phúc chầu Chữ Thọ Tròn) */}
        <g id="shou-five-bats-crest">
          <circle cx="270" cy="45" r="26" stroke="#D4AF37" strokeWidth="2.5" fill="rgba(43, 76, 111, 0.35)" filter={`url(#auraGlow-${id})`} />
          <circle cx="270" cy="45" r="20" stroke="#D4AF37" strokeWidth="1.2" strokeDasharray="3 3" fill="none" />
          {/* Nét Chữ Thọ Cung Đình */}
          <path d="M 256 36 L 284 36 M 270 30 L 270 42" stroke="#FFF2B2" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 258 46 L 282 46 M 270 46 L 270 58" stroke="#FFF2B2" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 256 58 L 284 58" stroke="#FFF2B2" strokeWidth="2.2" strokeLinecap="round" />

          {/* 5 Cánh Dơi Phúc Thọ */}
          <path d="M 270 12 Q 262 6, 254 10 Q 265 16, 270 18 Q 275 16, 286 10 Q 278 6, 270 12 Z" fill="#D4AF37" />
          <path d="M 238 26 Q 230 22, 226 30 Q 236 33, 242 32 Z" fill="#D4AF37" />
          <path d="M 302 26 Q 310 22, 314 30 Q 304 33, 298 32 Z" fill="#D4AF37" />
          <path d="M 242 60 Q 233 64, 230 72 Q 240 68, 246 64 Z" fill="#D4AF37" />
          <path d="M 298 60 Q 307 64, 310 72 Q 300 68, 294 64 Z" fill="#D4AF37" />
        </g>

        {/* Sườn Hai Bên: Dây Leo Cát Tường & Hồi Văn Chữ Thọ */}
        <g transform="translate(18, 230)">
          <path d="M 18 0 C -6 25, -6 60, 14 85 C 30 105, 22 135, 6 150" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 8 48 Q -10 42, 0 62 Q 20 56, 8 48 Z" fill="#2B4C6F" stroke="#D4AF37" strokeWidth="1.2" />
          <circle cx="6" cy="150" r="5" fill="#D4AF37" />
        </g>
        <g transform="translate(482, 230)">
          <path d="M 22 0 C 46 25, 46 60, 26 85 C 10 105, 18 135, 34 150" stroke="#D4AF37" strokeWidth="2.4" fill="none" />
          <path d="M 32 48 Q 50 42, 40 62 Q 20 56, 32 48 Z" fill="#2B4C6F" stroke="#D4AF37" strokeWidth="1.2" />
          <circle cx="34" cy="150" r="5" fill="#D4AF37" />
        </g>

        {/* Chân Đế: Đóa Sen Nở Rộ & Mây Cát Tường */}
        <g transform="translate(0, 580)">
          <path d="M 125 45 C 172 24, 218 52, 270 36 C 322 52, 368 24, 415 45" stroke="#D4AF37" strokeWidth="2.8" fill="none" />
          <path d="M 145 60 C 188 42, 228 64, 270 52 C 312 64, 352 42, 395 60" stroke="#2B4C6F" strokeWidth="2.2" fill="none" />
          <circle cx="270" cy="36" r="6" fill="#D4AF37" />
          <circle cx="220" cy="30" r="4" fill="#D4AF37" />
          <circle cx="320" cy="30" r="4" fill="#D4AF37" />
        </g>
      </svg>
    </>
  );
}

// Master Component Hào Quang & Họa Tiết Cung Đình Tùy Biến 100% Cho Từng Trang Phục
function GarmentHeritageMotifAura({
  garment,
  isVisible,
}: {
  garment: ReferenceGarment;
  isVisible: boolean;
}) {
  return (
    <div
      className={`absolute -inset-10 sm:-inset-16 pointer-events-none z-0 flex items-center justify-center select-none overflow-visible transition-all duration-1000 ${
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
    >
      {garment.id === "giao-linh" && <GiaoLinhAuraAndMotif id={garment.id} />}
      {garment.id === "vien-linh" && <VienLinhAuraAndMotif id={garment.id} />}
      {garment.id === "nhat-binh" && <NhatBinhAuraAndMotif id={garment.id} />}
      {garment.id === "ao-tac" && <AoTacAuraAndMotif id={garment.id} />}
      {garment.id === "ngu-than" && <NguThanAuraAndMotif id={garment.id} />}
    </div>
  );
}

// Dòng Chảy Triển Lãm Từng Kiểu Thức Cổ Phục Nối Liền (Continuous Timeline Sequence)
function GarmentStoryCard({
  garment,
  index,
  isEven,
}: {
  garment: ReferenceGarment;
  index: number;
  isEven: boolean;
}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const chapterNum = String(index + 1).padStart(2, "0");
  const auraShadow = getAuraBoxShadow(garment);

  return (
    <div
      id={`garment-${garment.id}`}
      ref={cardRef}
      className={`scroll-mt-28 relative py-12 sm:py-20 transition-all duration-1000 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center relative z-10">
        {/* Cột 1: Ảnh Ma-nơ-canh Tham Chiếu với VẦNG HÀO QUANG ĐA SẮC XOAY CHUYỂN */}
        <div
          className={`lg:col-span-5 flex flex-col items-center justify-center ${
            isEven ? "lg:order-1" : "lg:order-2"
          }`}
        >
          {/* Khung Trưng Bày với Hào Quang Họa Tiết Cung Đình Độc Bản (Không dùng mảng màu pha tạp) */}
          <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-[4/5] flex items-center justify-center">
            {/* HÀO QUANG HỌA TIẾT HÌNH VẼ CUNG ĐÌNH ĐẶC TRƯNG TỪNG TRANG PHỤC */}
            <GarmentHeritageMotifAura garment={garment} isVisible={isVisible} />

            {/* Khung Đế Đứng Cổ Phong với 4 Góc Đồng Dát Vàng Cung Đình */}
            <div
              className="relative w-full h-full rounded-3xl overflow-hidden bg-gradient-to-b from-[#FAF8F5]/98 via-[#F7F2EB]/95 to-[#EFE7DC]/98 border-2 border-amber-800/30 flex items-center justify-center p-3 shadow-2xl backdrop-blur-xs group transition-all duration-500 z-10"
              style={{
                boxShadow: auraShadow,
              }}
            >
              {/* Lớp phản quang ánh vàng nhẹ xuyên tâm */}
              <div className="absolute inset-0 bg-radial-at-center from-amber-200/25 via-transparent to-black/5 pointer-events-none" />

              {/* 4 Góc Đồng Dát Vàng Cung Đình (Imperial Corner Brackets) */}
              <div className="absolute top-2.5 left-2.5 w-6 h-6 pointer-events-none text-amber-600/80 z-20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-full h-full">
                  <path d="M 2 12 L 2 2 L 12 2 M 5 5 L 10 5 M 5 5 L 5 10" />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div className="absolute top-2.5 right-2.5 w-6 h-6 pointer-events-none text-amber-600/80 rotate-90 z-20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-full h-full">
                  <path d="M 2 12 L 2 2 L 12 2 M 5 5 L 10 5 M 5 5 L 5 10" />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div className="absolute bottom-2.5 left-2.5 w-6 h-6 pointer-events-none text-amber-600/80 -rotate-90 z-20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-full h-full">
                  <path d="M 2 12 L 2 2 L 12 2 M 5 5 L 10 5 M 5 5 L 5 10" />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-6 h-6 pointer-events-none text-amber-600/80 rotate-180 z-20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-full h-full">
                  <path d="M 2 12 L 2 2 L 12 2 M 5 5 L 10 5 M 5 5 L 5 10" />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </svg>
              </div>

              <Image
                src={garment.imageUrl}
                alt={garment.name}
                fill
                unoptimized
                loading="lazy"
                className="object-contain p-3 transform group-hover:scale-108 transition-transform duration-700"
              />

              {/* Con Dấu & Thẻ Bài Triều Đình */}
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-stone-900/85 backdrop-blur-xs text-[11px] font-serif text-amber-300 border border-amber-400/40 shadow-sm flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>{garment.badge}</span>
              </div>

              <div className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-white/90 backdrop-blur-xs text-[10px] font-mono text-stone-700 border border-stone-300 shadow-xs">
                Bản phục chế chuẩn
              </div>

              {/* Thẻ Chương Di Sản */}
              <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-stone-900/80 backdrop-blur-xs text-[10px] font-mono font-bold text-amber-200 border border-amber-400/20">
                Chương {chapterNum}
              </div>
            </div>
          </div>

          {/* Dải Mã Màu Hòa Sắc Đầy Đủ Nằm Ngay Dưới Ảnh */}
          <div className="mt-5 px-4 py-2 rounded-2xl bg-white/90 backdrop-blur-xs border border-stone-200/90 shadow-xs flex items-center space-x-3">
            <span className="text-xs font-semibold text-stone-600">
              Hòa sắc di sản:
            </span>
            <div className="flex items-center space-x-2.5">
              {garment.colors.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-1.5 transform hover:scale-115 transition-transform cursor-pointer"
                  title={c.name}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-xs font-medium text-stone-700 hidden sm:inline">
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cột 2: Toàn Bộ Thông Tin Khảo Cứu Nối Liền Thoáng Đãng (Không Đóng Hộp) */}
        <div
          className={`lg:col-span-7 space-y-6 text-left ${
            isEven ? "lg:order-2 lg:pl-6" : "lg:order-1 lg:pr-6"
          }`}
        >
          {/* Tiêu Đề, Triều Đại & Niên Biểu */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
              <span className="px-3 py-1 rounded-md bg-heritage-red/10 text-heritage-red text-xs font-mono font-bold uppercase tracking-wider border border-heritage-red/20 shadow-2xs">
                {garment.dynasties}
              </span>
              <span className="text-xs font-mono text-stone-500">
                Thời kỳ: {garment.eraTime}
              </span>
              <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                {garment.role}
              </span>
            </div>

            <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-snug tracking-tight">
              <span className="text-amber-700/60 font-mono text-xl sm:text-2xl mr-2 font-bold">
                {chapterNum}.
              </span>
              {garment.name}
            </h3>
          </div>

          <p className="text-stone-600 text-sm sm:text-base leading-relaxed font-light">
            {garment.significance}
          </p>

          {/* Lưới 4 Thẻ Quy Thức Kiến Trúc Cổ Phong */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xs border border-stone-200/90 space-y-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white hover:border-amber-400/50 group cursor-default shadow-xs">
              <div className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-heritage-red transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300" />
                <span className="group-hover:text-heritage-red transition-colors">
                  Quy thức Cổ Áo:
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                {garment.structure.collar}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xs border border-stone-200/90 space-y-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white hover:border-amber-400/50 group cursor-default shadow-xs">
              <div className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-heritage-indigo transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300" />
                <span className="group-hover:text-heritage-indigo transition-colors">
                  Quy thức Tay Áo:
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                {garment.structure.sleeves}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xs border border-stone-200/90 space-y-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white hover:border-amber-400/50 group cursor-default shadow-xs">
              <div className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-heritage-jade transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300" />
                <span className="group-hover:text-heritage-jade transition-colors">
                  Vạt Áo & Cài Khuy:
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                {garment.structure.lapelAndButtons}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/85 backdrop-blur-xs border border-stone-200/90 space-y-1.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:bg-white hover:border-amber-400/50 group cursor-default shadow-xs">
              <div className="text-xs font-bold text-stone-800 flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-heritage-gold transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300" />
                <span className="group-hover:text-heritage-gold transition-colors">
                  Hoa Văn & Đồ Án:
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed font-light">
                {garment.structure.pattern}
              </p>
            </div>
          </div>

          {/* Khung Trích Dẫn Điển Lệ Thư Tịch Cổ */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50/90 via-[#FAF8F5] to-amber-50/70 border border-amber-300/60 space-y-1.5 hover:border-amber-400 transition-colors shadow-2xs">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 font-serif uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-heritage-red" />
              <span>Khảo Cứu Thư Tịch Cổ</span>
            </div>
            <p className="text-xs sm:text-sm text-stone-700 italic leading-relaxed">
              “{garment.citation}”
            </p>
            <p className="text-[11px] text-amber-800 font-mono font-semibold">
              Trích từ: {garment.sourceBook}
            </p>
          </div>

          {/* Nút Bấm Khám Phá Trực Tiếp Trong Studio 2D */}
          <div className="pt-2 flex flex-wrap gap-4 items-center">
            <Link
              href="/studio"
              prefetch={true}
              className="relative group inline-flex items-center space-x-2.5 px-7 py-3.5 rounded-xl bg-heritage-red hover:bg-heritage-red-dark text-white font-bold text-sm shadow-md shadow-heritage-red/25 hover:shadow-heritage-red/40 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden ring-2 ring-amber-400/30"
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-beam-sweep" />
              </div>
              <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform duration-300" />
              <span>Phối Mẫu {garment.shortName} Tại Studio 2D</span>
              <ArrowRight className="w-4 h-4 text-white transform group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>

            <Link
              href="/thu-vien"
              prefetch={true}
              className="inline-flex items-center space-x-1.5 px-5 py-3.5 rounded-xl bg-white/90 hover:bg-white text-stone-800 font-medium text-sm transition-colors border border-stone-200 shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-stone-500" />
              <span>Xem Trong Thư Viện</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const [activeGarmentId, setActiveGarmentId] = useState<string>("nhat-binh");
  const [isAutoPlay, setIsAutoPlay] = useState<boolean>(true);
  const [activeScrollGarmentId, setActiveScrollGarmentId] = useState<string>("giao-linh");

  // Bản đồ hòa sắc hào quang tương ứng với từng kiểu thức cổ phục
  const auraGradients: Record<string, string> = {
    "giao-linh": "from-emerald-600/30 via-amber-500/20 to-transparent",
    "vien-linh": "from-purple-600/30 via-amber-500/20 to-transparent",
    "nhat-binh": "from-rose-600/35 via-amber-500/25 to-transparent",
    "ao-tac": "from-indigo-600/30 via-sky-400/20 to-transparent",
    "ngu-than": "from-blue-600/30 via-amber-400/20 to-transparent",
  };

  // Theo dõi vị trí cuộn trang để cập nhật kiểu thức đang hiển thị trên thanh ScrollSpy
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 320;
      for (let i = REFERENCE_GARMENTS.length - 1; i >= 0; i--) {
        const el = document.getElementById(`garment-${REFERENCE_GARMENTS[i].id}`);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveScrollGarmentId(REFERENCE_GARMENTS[i].id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const currentGarment =
    REFERENCE_GARMENTS.find((g) => g.id === activeGarmentId) || REFERENCE_GARMENTS[2];

  // Tự động xoay tua nhẹ nhàng giữa 5 cổ phục tham chiếu sau mỗi 5.5 giây (có thể bật/tắt bằng nút bấm)
  useEffect(() => {
    if (!isAutoPlay) return;
    const interval = setInterval(() => {
      setActiveGarmentId((prev) => {
        const idx = REFERENCE_GARMENTS.findIndex((g) => g.id === prev);
        const nextIdx = (idx + 1) % REFERENCE_GARMENTS.length;
        return REFERENCE_GARMENTS[nextIdx].id;
      });
    }, 5500);
    return () => clearInterval(interval);
  }, [isAutoPlay]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 selection:bg-heritage-gold/30 selection:text-heritage-red overflow-x-clip">
      {/* 1. HERO SECTION WITH RICH AMBIENT MOTION */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-stone-200/80 bg-gradient-to-b from-[#F7F2EB] via-[#FAF8F5] to-[#FAF8F5]">
        {/* Floating Traditional Vietnamese Clouds in Background */}
        <div className="absolute top-10 left-10 sm:left-1/4 w-72 h-36 opacity-35 pointer-events-none animate-float-slow select-none">
          <svg viewBox="0 0 240 120" fill="none" className="w-full h-full text-amber-500/40">
            <path
              d="M40 90 C 20 90 0 75 0 55 C 0 32 24 15 52 20 C 65 5 95 0 125 12 C 150 0 185 10 192 35 C 215 35 235 52 235 75 C 235 98 210 110 180 102 C 155 125 95 130 60 108 C 48 112 36 108 40 90 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="absolute top-1/3 -right-12 w-80 h-44 opacity-25 pointer-events-none animate-float-reverse select-none">
          <svg viewBox="0 0 240 120" fill="none" className="w-full h-full text-heritage-red/35">
            <path
              d="M45 80 C 25 80 10 65 10 48 C 10 26 32 14 60 18 C 72 4 100 0 128 10 C 152 0 184 10 190 32 C 212 32 230 48 230 70 C 230 92 206 104 176 96 C 152 118 96 122 62 102 C 50 106 40 96 45 80 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* Traditional Bronze Drum Radial Watermark - Slow Ambient Rotation */}
        <div
          className="absolute -top-40 -left-40 w-[640px] h-[640px] rounded-full border border-amber-600/10 opacity-40 pointer-events-none flex items-center justify-center animate-spin"
          style={{ animationDuration: "140s" }}
        >
          <div className="w-4/5 h-4/5 rounded-full border border-dashed border-amber-700/15 flex items-center justify-center">
            <div className="w-3/5 h-3/5 rounded-full border border-amber-800/10 flex items-center justify-center">
              <div className="w-2/5 h-2/5 rounded-full border border-dashed border-amber-900/15" />
            </div>
          </div>
        </div>

        {/* Floating Golden Sparks & Imperial Accents */}
        <div className="absolute top-20 left-16 sm:left-1/3 text-amber-500/40 text-lg select-none pointer-events-none animate-sparkle-float" style={{ animationDelay: "0s" }}>✦</div>
        <div className="absolute top-48 right-16 sm:right-1/4 text-amber-600/35 text-sm select-none pointer-events-none animate-sparkle-float" style={{ animationDelay: "1.5s" }}>✧</div>
        <div className="absolute bottom-24 left-12 text-amber-500/30 text-xs select-none pointer-events-none animate-sparkle-float" style={{ animationDelay: "2.8s" }}>✦</div>
        <div className="absolute top-1/2 right-10 text-rose-500/30 text-sm select-none pointer-events-none animate-sparkle-float" style={{ animationDelay: "3.5s" }}>✧</div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headlines & Call to Actions */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-red/10 border border-heritage-red/20 text-heritage-red text-xs font-semibold uppercase tracking-wider shadow-xs transform hover:scale-105 transition-transform">
                <Sparkles className="w-3.5 h-3.5 text-heritage-gold animate-pulse" />
                <span>Nền Tảng Phối Đồ Di Sản Thời Trang Việt Nam</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 leading-[1.18]">
                Chạm Vào Ngàn Năm Áo Mũ,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-heritage-red via-amber-600 via-rose-700 to-heritage-red animate-gradient-flow">
                  Phối Sắc Việt Theo Cách Của Riêng Bạn
                </span>
              </h1>

              <p className="text-base sm:text-lg text-stone-600 font-light leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Chiêm ngưỡng và trải nghiệm <strong>5 kiểu thức cổ phục tham chiếu chuẩn thư tịch</strong>: Giao Lĩnh, Viên Lĩnh, Nhật Bình, Áo Tấc và Áo Ngũ Thân. Phối đồ trực quan trên Studio 2D Canvas đa lớp, thẩm định quy tắc Hữu nhậm và phân tích hòa sắc Ngũ Hành.
              </p>

              {/* Action Buttons with High-Impact Motion */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  href="/studio"
                  prefetch={true}
                  className="relative group w-full sm:w-auto px-8 py-4 rounded-2xl bg-heritage-red hover:bg-heritage-red-dark text-white font-bold text-base shadow-xl shadow-heritage-red/30 transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center space-x-2.5 border border-amber-400/40 overflow-hidden ring-4 ring-heritage-red/20 hover:ring-heritage-red/40"
                >
                  {/* Moving Light Beam Sweep Effect */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-beam-sweep" />
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: "8s" }} />
                  <span>Bắt Đầu Phối Đồ Tại Studio</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-300" />
                </Link>

                <a
                  href="#canonical-garments"
                  className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white hover:bg-stone-50 text-stone-800 font-semibold text-base border border-stone-300 shadow-xs transition-all duration-200 flex items-center justify-center space-x-2 hover:border-heritage-red/50 hover:shadow-md transform hover:-translate-y-0.5"
                >
                  <BookOpen className="w-4 h-4 text-heritage-indigo" />
                  <span>5 Kiểu Thức Tham Chiếu</span>
                  <ArrowDown className="w-4 h-4 text-stone-400 animate-bounce" style={{ animationDuration: "2.5s" }} />
                </a>
              </div>

              {/* Trust & Heritage Badges */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-stone-500 font-medium">
                <div className="flex items-center space-x-1.5 hover:text-stone-800 transition-colors">
                  <ShieldCheck className="w-4 h-4 text-heritage-jade" />
                  <span>Chuẩn Quy thức Thư tịch</span>
                </div>
                <div className="flex items-center space-x-1.5 hover:text-stone-800 transition-colors">
                  <Palette className="w-4 h-4 text-heritage-gold" />
                  <span>Hòa sắc Ngũ Hành Tương sinh</span>
                </div>
                <div className="flex items-center space-x-1.5 hover:text-stone-800 transition-colors">
                  <Wand2 className="w-4 h-4 text-heritage-red" />
                  <span>Studio 2D Đa Lớp Thông Minh</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Showcase Card with Ambient Aura Glow & Motion Switcher */}
            <div className="lg:col-span-5 relative group">
              {/* Dynamic Aura Glow behind the Showcase Card */}
              <div
                className={`absolute -inset-4 sm:-inset-6 rounded-3xl bg-gradient-to-tr ${
                  auraGradients[currentGarment.id] || "from-rose-600/30 via-amber-400/20 to-transparent"
                } blur-3xl animate-pulse-glow -z-10 transition-all duration-1000 pointer-events-none`}
              />

              <div className="relative mx-auto max-w-md rounded-3xl bg-white p-6 shadow-2xl border-2 border-stone-200/90 space-y-5 transition-transform duration-500 hover:-translate-y-1">
                {/* Badge top card */}
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-heritage-red animate-ping" />
                    <span className="text-xs font-serif font-bold text-heritage-red uppercase tracking-wider">
                      Phục Trang Tham Chiếu
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-200 shadow-2xs">
                    ✓ Chuẩn Hữu Nhậm
                  </span>
                </div>

                {/* Garment Visual preview with white museum studio frame & enter animation */}
                <div className="relative h-[380px] sm:h-[440px] w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#FAF8F5] via-[#F4EFEA] to-[#ECE5DC] border border-stone-300/80 flex items-center justify-center p-2 shadow-inner group/photo">
                  {/* Subtle Background Radial Light on Garment */}
                  <div className="absolute inset-0 bg-radial-at-center from-white/70 via-transparent to-black/5 pointer-events-none" />

                  <Image
                    key={currentGarment.id}
                    src={currentGarment.imageUrl}
                    alt={currentGarment.name}
                    fill
                    unoptimized
                    className="object-contain p-2 transform group-hover/photo:scale-108 transition-transform duration-700 animate-garment-enter"
                    priority
                  />

                  {/* Badge top left */}
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-stone-900/85 backdrop-blur-xs border border-amber-400/40 text-[11px] font-serif text-amber-200 font-bold shadow-md">
                    {currentGarment.dynasties} • {currentGarment.shortName}
                  </div>
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-stone-200 text-[10px] font-semibold text-stone-700 shadow-xs">
                    {currentGarment.badge}
                  </div>
                </div>

                {/* Quick 5 Garments Thumbnail Switcher with Auto-Play toggle */}
                <div className="space-y-2 pt-1 border-t border-stone-200">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-stone-700">Xem nhanh 5 kiểu thức:</span>
                      {/* Auto-Play Toggle Pill */}
                      <button
                        type="button"
                        onClick={() => setIsAutoPlay(!isAutoPlay)}
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                          isAutoPlay
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-stone-100 text-stone-600 border border-stone-300 hover:bg-stone-200"
                        }`}
                        title={isAutoPlay ? "Đang tự động chuyển (5s). Nhấn để tạm dừng." : "Nhấn để tự động xoay tua"}
                      >
                        {isAutoPlay ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                            <span>Tự chạy</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5 text-stone-600" />
                            <span>Phát</span>
                          </>
                        )}
                      </button>
                    </div>
                    <span className="font-mono text-[11px] text-heritage-red font-bold animate-pulse">
                      {currentGarment.shortName}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {REFERENCE_GARMENTS.map((g) => {
                      const isSelected = g.id === activeGarmentId;
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            setActiveGarmentId(g.id);
                            setIsAutoPlay(false); // Khi người dùng tự chọn, dừng auto-play
                          }}
                          className={`relative h-16 w-full rounded-xl overflow-hidden border-2 transition-all duration-300 p-1 flex items-center justify-center transform active:scale-95 ${
                            isSelected
                              ? "border-heritage-red ring-3 ring-heritage-red/30 scale-108 bg-amber-50 shadow-md -translate-y-0.5"
                              : "border-stone-200 hover:border-stone-400 hover:scale-102 bg-stone-50/80 opacity-75 hover:opacity-100"
                          }`}
                          title={g.name}
                        >
                          <Image
                            src={g.thumbUrl}
                            alt={g.shortName}
                            fill
                            unoptimized
                            className="object-contain p-0.5"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Outfit Info Snippet */}
                <div className="space-y-2 text-left pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-base font-bold text-stone-900 transition-colors">
                        {currentGarment.name}
                      </h3>
                      <p className="text-xs text-stone-500">{currentGarment.role}</p>
                    </div>
                    <Link
                      href="/studio"
                      prefetch={true}
                      className="p-2.5 rounded-xl bg-heritage-red/10 text-heritage-red hover:bg-heritage-red hover:text-white transition-all transform hover:scale-110 shadow-xs"
                      title="Phối mẫu này trong Studio"
                    >
                      <Sparkles className="w-4 h-4" />
                    </Link>
                  </div>


                  {/* Attributes Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentGarment.colors.map((c, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-700 text-[11px] font-medium border border-stone-200 flex items-center space-x-1"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CANONICAL 5 REFERENCE GARMENTS VERTICAL STORYTELLING EXHIBITION */}
      <section id="canonical-garments" className="pt-16 sm:pt-24 pb-20 sm:pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="relative" id="heritage-timeline-container">
          {/* MASTER CONTINUOUS VINE: Nối liền suốt 5 trang phục */}
          <ContinuousHeritageVine />

          {/* Tiêu đề & Lời dẫn chuẩn mực di sản */}
          <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20 relative z-10 pt-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-gold/15 text-stone-800 border border-heritage-gold/30 text-xs font-serif font-bold uppercase tracking-wider shadow-2xs backdrop-blur-xs">
              <BookOpen className="w-3.5 h-3.5 text-heritage-gold" />
              <span>Khảo Cứu Điển Chương Thư Tịch</span>
            </div>

            <h2 className="font-serif text-3xl sm:text-5xl font-bold text-stone-900 tracking-tight leading-tight mt-3">
              5 Kiểu Thức Cổ Phục Chuẩn Thư Tịch
            </h2>

            <p className="text-sm sm:text-base text-stone-600 font-light leading-relaxed max-w-2xl mx-auto mt-3">
              Hành trình chiêm ngưỡng 5 kiểu thức trang phục chuẩn mực của các vương triều Đại Việt được phục dựng trung thực dựa trên thư tịch cổ và hiện vật bảo tàng. Cuộn xuống để khám phá từng chương di sản với cấu trúc vạt áo, nẹp cổ, tay áo và hoa văn.
            </p>
          </div>

          {/* Dòng chảy 5 trang phục di sản nối liền */}
          <div className="relative z-10">
            {REFERENCE_GARMENTS.map((garment, index) => (
              <GarmentStoryCard
                key={garment.id}
                garment={garment}
                index={index}
                isEven={index % 2 === 0}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 3. COMPARATIVE 5 REFERENCE GARMENTS GALLERY */}
      <section className="py-16 sm:py-24 bg-[#F5EFEB] border-t border-stone-300/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-indigo/10 text-heritage-indigo border border-heritage-indigo/20 text-xs font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-heritage-indigo" />
              <span>Toàn Cảnh Bảng Tham Chiếu</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
              Bảo Tàng Thu Nhỏ 5 Hình Thái Cổ Phục
            </h2>

            <p className="text-sm sm:text-base text-stone-600 font-light leading-relaxed">
              Đặt cạnh nhau để so sánh trực quan sự biến đổi từ vạt giao chéo (Giao lĩnh), cổ tròn (Viên lĩnh), cổ đối khâm chữ nhật (Nhật bình) đến cổ đứng cài khuy hữu nhậm (Áo tấc, Áo ngũ thân).
            </p>
          </div>

          {/* 5-Column Responsive Gallery Grid with 3D Hover & Motion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {REFERENCE_GARMENTS.map((g) => {
              const isSelected = g.id === activeScrollGarmentId;
              return (
                <div
                  key={g.id}
                  onClick={() => {
                    setActiveScrollGarmentId(g.id);
                    const el = document.getElementById(`garment-${g.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`group bg-white rounded-3xl border transition-all duration-500 overflow-hidden cursor-pointer flex flex-col justify-between hover:shadow-2xl hover:-translate-y-2 transform ${
                    isSelected
                      ? "border-heritage-red ring-4 ring-heritage-red/25 shadow-xl scale-[1.02] bg-amber-50/40"
                      : "border-stone-200/90 hover:border-amber-400/60"
                  }`}
                >
                  <div className="p-3 bg-gradient-to-b from-[#FBF9F6] via-stone-50 to-stone-100 flex items-center justify-center relative h-72 overflow-hidden">
                    {/* Hover radial shimmer overlay */}
                    <div className="absolute inset-0 bg-radial-at-center from-white/60 via-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <Image
                      src={g.imageUrl}
                      alt={g.name}
                      fill
                      unoptimized
                      loading="lazy"
                      className="object-contain p-2 transform group-hover:scale-112 transition-transform duration-700"
                    />
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-stone-900/85 backdrop-blur-xs text-[10px] font-mono text-amber-200 font-bold border border-amber-400/30 shadow-xs">
                      {g.shortName}
                    </div>
                  </div>

                  <div className="p-4 space-y-2 text-left bg-white">
                    <h4 className="font-serif font-bold text-sm text-stone-900 line-clamp-1 group-hover:text-heritage-red transition-colors">
                      {g.name}
                    </h4>
                    <p className="text-[11px] text-stone-500 line-clamp-1 font-mono">{g.dynasties}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px]">
                      <span className="text-heritage-red font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                      <div className="flex space-x-1">
                        {g.colors.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="w-2.5 h-2.5 rounded-full border border-black/10 transform hover:scale-125 transition-transform"
                            style={{ backgroundColor: c.hex }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. CORE FEATURES GRID SECTION */}
      <section className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-indigo/10 text-heritage-indigo border border-heritage-indigo/20 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-heritage-indigo" />
            <span>Công Nghệ & Chuẩn Mực Văn Hóa</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Trải Nghiệm Studio Phối Đồ 2D Đỉnh Cao
          </h2>

          <p className="text-sm sm:text-base text-stone-600 font-light leading-relaxed">
            VietStylist kết hợp sức mạnh xử lý canvas đa lớp trực quan với hệ thống thẩm định tri thức di sản nghiêm cẩn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="bg-white p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-amber-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-red/10 text-heritage-red flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-heritage-red transition-colors">
              Canvas Đa Lớp Trực Quan
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
              Kéo thả, tự do đảo thứ tự lớp áo (áo lót trong, áo ngũ thân ngoài, quần lụa), thay đổi màu sắc tức thì và khóa các vị trí cố định.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-emerald-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-jade/10 text-heritage-jade flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-heritage-jade transition-colors">
              Thẩm Định Chuẩn Hữu Nhậm
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
              Hệ thống thời gian thực kiểm tra hướng cài vạt áo (Hữu nhậm - cài sang phải) chuẩn quy thức cổ truyền, cảnh báo các lỗi cấm kỵ văn hóa.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-amber-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-gold/15 text-heritage-gold flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
              Hòa Sắc Ngũ Hành 1 Chạm
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
              Gợi ý bảng phối màu tương sinh Kim - Mộc - Thủy - Hỏa - Thổ cùng gợi ý phụ kiện che mưa, che nắng theo thời tiết 63 tỉnh thành.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-indigo-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-indigo/10 text-heritage-indigo flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-heritage-indigo transition-colors">
              Xuất Ảnh Sắc Nét & Chia Sẻ
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed font-light">
              Xuất ảnh định dạng chuẩn bài đăng Instagram, Story, Facebook với độ phân giải cao, đính kèm thẻ khảo cứu học thuật chuẩn xác.
            </p>
          </div>
        </div>
      </section>

      {/* 5. OCCASION SHOWCASE SECTION */}
      <section className="py-16 sm:py-24 bg-[#F5EFEB] border-t border-stone-300/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-red/10 text-heritage-red border border-heritage-red/20 text-xs font-semibold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-heritage-red" />
              <span>Bối Cảnh Ứng Dụng Đa Dạng</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
              Cổ Phục Trong Nhịp Sống Hiện Đại
            </h2>

            <p className="text-sm sm:text-base text-stone-600 font-light leading-relaxed">
              Dành riêng cho học sinh, sinh viên và những người yêu mến văn hóa Việt trong các dịp quan trọng.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Occasion 1 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">🎓</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Chụp Ảnh Kỷ Yếu</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Áo ngũ thân tay chẽn hoặc áo tấc thanh lịch, tôn vẻ trang nhã trong ngày tốt nghiệp trường xưa.
              </p>
            </div>

            {/* Occasion 2 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">🌸</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Du Xuân Đón Tết</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Sắc đỏ, vàng rực rỡ mang lại may mắn, ấm cúng khi sum vầy bên gia đình và du ngoạn phố phường.
              </p>
            </div>

            {/* Occasion 3 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">🏮</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Lễ Hội Văn Hóa</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Tự do sáng tạo phong cách Việt phục Remix đương đại cho các ngày hội festival truyền thống.
              </p>
            </div>

            {/* Occasion 4 */}
            <div className="p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">💍</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Lễ Cưới Hỏi & Đính Hôn</h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Áo Nhật bình và áo tấc trang nghiêm, kết nối sợi dây văn hóa ngàn năm trong ngày trọng đại lứa đôi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CLOSING CTA BANNER SECTION WITH CINEMATIC MOTION */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-[#801F1F] via-stone-950 to-[#801F1F] text-white text-center relative overflow-hidden">
        {/* Animated Radial Golden Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(214,158,46,0.22),transparent_70%)] animate-pulse-glow pointer-events-none" />

        {/* Ambient floating sparkles in background */}
        <div className="absolute top-8 left-1/5 text-amber-300/30 text-xl animate-float-slow pointer-events-none">✦</div>
        <div className="absolute bottom-12 right-1/4 text-amber-300/30 text-2xl animate-float-reverse pointer-events-none">✧</div>
        <div className="absolute top-1/2 right-12 text-amber-400/25 text-lg animate-pulse pointer-events-none">✦</div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/10 text-amber-300 border border-white/20 text-xs font-semibold uppercase tracking-wider shadow-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: "10s" }} />
            <span>Sáng Tạo Ngay Hôm Nay</span>
          </div>

          <h2 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-stone-100 leading-tight">
            Sẵn Sàng Tạo Bản Phối Cổ Phong Của Riêng Bạn?
          </h2>

          <p className="text-stone-300 text-sm sm:text-base font-light max-w-2xl mx-auto leading-relaxed">
            Chỉ với vài thao tác kéo thả trên Studio 2D Canvas, bạn đã có thể kiến tạo một bản phối trang phục truyền thống chuẩn mực, tinh tế và đậm dấu ấn cá nhân.
          </p>

          <div className="pt-3">
            <Link
              href="/studio"
              prefetch={true}
              className="relative group inline-flex items-center space-x-2.5 px-9 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-base shadow-2xl shadow-amber-400/40 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden ring-4 ring-amber-400/25"
            >
              {/* Light beam sweep on button */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-beam-sweep" />
              </div>
              <Sparkles className="w-5 h-5 text-stone-950 group-hover:rotate-12 transition-transform duration-300" />
              <span>Mở Studio 2D Canvas Ngay</span>
              <ArrowRight className="w-4 h-4 text-stone-950 transform group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
