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


// Từng trang phục trong bộ sưu tập tham chiếu
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

  return (
    <div
      id={`garment-${garment.id}`}
      ref={cardRef}
      className={`scroll-mt-28 relative py-12 sm:py-20 transition-all duration-1000 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center relative z-10">
        {/* Cột 1: Ảnh Ma-nơ-canh Tham Chiếu Cổ Phục */}
        <div
          className={`lg:col-span-5 flex flex-col items-center justify-center ${
            isEven ? "lg:order-1" : "lg:order-2"
          }`}
        >
          {/* Khung ảnh trang phục với viền vàng đồng cung đình */}
          <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-[4/5] flex items-center justify-center">
            {/* Khung Đế Đứng Cổ Phong với 4 Góc Đồng Dát Vàng Cung Đình */}
            <div
              className="relative w-full h-full rounded-3xl overflow-hidden bg-[#FAF8F5] border border-amber-800/30 shadow-2xl flex items-center justify-center group z-10"
            >
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
                  <path d="M 2 12 L 2 2 L 12 2 M 5 5 L 10 5 M 5 5 L 10 5" />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </svg>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-6 h-6 pointer-events-none text-amber-600/80 rotate-180 z-20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-full h-full">
                  <path d="M 2 12 L 2 2 L 12 2 M 5 5 L 10 5 M 5 5 L 10 5" />
                  <circle cx="5" cy="5" r="1.5" fill="currentColor" />
                </svg>
              </div>

              <Image
                src={garment.imageUrl}
                alt={garment.name}
                fill
                unoptimized
                loading="lazy"
                className="object-cover transform group-hover:scale-105 transition-transform duration-700"
              />


            </div>
          </div>

          {/* Dải Mã Màu Hòa Sắc Đầy Đủ Nằm Ngay Dưới Ảnh */}
          <div className="relative z-10 mt-7 px-4 py-2 rounded-2xl bg-white/90 backdrop-blur-xs border border-stone-200/90 shadow-xs flex items-center space-x-3">
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
              href="/thu-vien"
              prefetch={true}
              className="relative group inline-flex items-center space-x-2.5 px-7 py-3.5 rounded-xl bg-heritage-red hover:bg-heritage-red-dark text-white font-bold text-sm shadow-md shadow-heritage-red/25 hover:shadow-heritage-red/40 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden ring-2 ring-amber-400/30"
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-beam-sweep" />
              </div>
              <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform duration-300" />
              <span>Chọn trang phục trong thư viện</span>
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
  const [activeScrollGarmentId, setActiveScrollGarmentId] = useState<string>("giao-linh");

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

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="space-y-6 sm:space-y-8">
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

            <p className="text-base sm:text-lg text-stone-600 font-light leading-relaxed max-w-2xl mx-auto">
              Chiêm ngưỡng và trải nghiệm <strong>5 kiểu thức cổ phục tham chiếu chuẩn thư tịch</strong>: Giao Lĩnh, Viên Lĩnh, Nhật Bình, Áo Tấc và Áo Ngũ Thân. Phối đồ trực quan trên Studio 2D Canvas đa lớp, thẩm định quy tắc Hữu nhậm và phân tích hòa sắc Ngũ Hành.
            </p>

            {/* Action Buttons with High-Impact Motion */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
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
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-stone-500 font-medium">
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
        </div>
      </section>

      {/* 2. CANONICAL 5 REFERENCE GARMENTS VERTICAL STORYTELLING EXHIBITION */}
      <section id="canonical-garments" className="pt-16 sm:pt-24 pb-20 sm:pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="relative" id="heritage-timeline-container">
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
      <section className="py-16 sm:py-24 bg-gradient-to-r from-heritage-red-dark via-stone-950 to-heritage-red-dark text-white text-center relative overflow-hidden">
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
