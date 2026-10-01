"use client";

/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Great_Vibes } from "next/font/google";
import { HeritageHeroBackdrop } from "@/components/HeritageHeroBackdrop";
import { HeritageGarmentBackdrop } from "@/components/HeritageGarmentBackdrop";

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
} from "lucide-react";

const heritageTitleFont = Great_Vibes({
  subsets: ["vietnamese", "latin"],
  weight: "400",
  display: "swap",
});

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
  details: { label: string; text: string }[];
  colors: { name: string; hex: string }[];
  citation: string;
  sourceBook: string;
  imageUrl: string;
  backgroundUrl: string;
  mobileBackgroundUrl: string;
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
      "Áo cổ chéo, vạt trái phủ sang phải và thắt đai lụa ở eo. Dáng áo buông rộng, điểm hoa văn cúc và sen thanh nhã.",
    structure: {
      collar: "Cổ giao lĩnh (Trực lĩnh) vạt chéo, cổ lót trắng ôm khít bên trong",
      sleeves: "Ống tay rộng vừa hoặc tay thụng dài buông rủ uyển chuyển",
      lapelAndButtons: "Hữu nhậm: Vạt bên trái đè sang vạt bên phải, buộc dải lụa ngang eo",
      pattern: "Gấm dệt chìm hoa cúc đại đóa, hoa sen tây và hoa mây thời Lý — Trần",
    },
    details: [
      { label: "Kiểu dáng", text: "Cổ áo giao chéo theo lối hữu nhậm: vạt trái phủ vạt phải, giữ bằng đai lụa ở eo. Tay áo rộng, thân áo buông mềm." },
      { label: "Hoa văn", text: "Mẫu minh họa dùng gấm lục rêu, điểm hoa cúc và sen, phối đai nâu đỏ cùng quần trắng ngà." },
      { label: "Cách mặc", text: "Dùng làm lễ phục hoặc thường phục trong bối cảnh lịch sử; phù hợp tái hiện trang phục thời Lý, Trần, Lê." },
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
    backgroundUrl: "/images/heritage/vietnam-lotus-garden.webp",
    mobileBackgroundUrl: "/images/heritage/vietnam-lotus-garden-mobile.webp",
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
      "Áo cổ tròn dùng trong nghi lễ cung đình, với tay rộng và khuy cài bên vai phải. Hoa văn trước ngực tạo điểm nhấn trang trọng.",
    structure: {
      collar: "Cổ tròn (Viên lĩnh) may nẹp kín, cài khuy kim loại bên vai phải",
      sleeves: "Tay áo thụng dài uy nghi, mép viền may lót lụa tương phản sắc sảo",
      lapelAndButtons: "Bổ tử / Bổ đoàn dệt thêu rồng cuộn kim tuyến rực rỡ trước ngực và sau lưng",
      pattern: "Đồ án Đoàn Long (rồng cuộn mây) và sóng nước Thủy Ba Tam Sơn ngũ sắc",
    },
    details: [
      { label: "Kiểu dáng", text: "Cổ tròn khép kín, cài khuy bên vai phải. Tay thụng rộng và thân áo dài tạo dáng trang nghiêm." },
      { label: "Hoa văn", text: "Mẫu minh họa có họa tiết rồng cuộn trước ngực, sóng nước ở chân áo và chỉ thêu vàng trên nền tím thẫm." },
      { label: "Cách mặc", text: "Gắn với triều phục và phẩm phục cung đình. Mẫu phối cùng mũ cánh chuồn và quần lụa trắng." },
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
    backgroundUrl: "/images/heritage/vien-linh-court.webp",
    mobileBackgroundUrl: "/images/heritage/vien-linh-court-mobile.webp",
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
      "Trang phục nữ cung đình Huế, nổi bật với nẹp cổ hình chữ nhật, tay áo viền ngũ sắc và hoa văn chim phượng.",
    structure: {
      collar: "Cổ đối khâm hình chữ nhật to bản (Nhật Bình), kết nẹp khuy cúc ngọc bội",
      sleeves: "Ống tay thụng viền dải Ngũ Sắc tương sinh (xanh, vàng, trắng, đỏ, lục)",
      lapelAndButtons: "Vạt áo xẻ trước cài khuy nẹp ngọc, buông dài ngang gối phủ ngoài xiêm lụa",
      pattern: "Chim phượng hoàng ngậm hoa sen, hoa cúc đại đóa dệt kim tuyến, sóng ngũ sắc",
    },
    details: [
      { label: "Kiểu dáng", text: "Nẹp cổ to bản tạo hình chữ nhật trước ngực. Áo mở phía trước, tay thụng rộng và có dải viền ngũ sắc." },
      { label: "Hoa văn", text: "Mẫu minh họa nổi bật với chim phượng, hoa sen và hoa cúc trên nền đỏ son, điểm chỉ kim tuyến vàng." },
      { label: "Cách mặc", text: "Gắn với nữ giới cung đình triều Nguyễn. Mẫu phối cùng xiêm lụa và khăn vành xanh; cũng được dùng trong lễ cưới, chụp ảnh cổ phục." },
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
    backgroundUrl: "/images/heritage/vietnam-palace-garden.webp",
    mobileBackgroundUrl: "/images/heritage/vietnam-palace-garden-mobile.webp",
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
      "Lễ phục thời Nguyễn với cổ đứng, năm thân áo và tay thụng rộng. Thường xuất hiện trong lễ cưới, cúng tế và các dịp trọng thể.",
    structure: {
      collar: "Cổ đứng lập lĩnh cao 3–4 cm ôm khít, dựng thẳng đoan trang",
      sleeves: "Tay may thụng cực rộng, phẳng phiu, buông dài quá ngón tay đúng 1 tấc",
      lapelAndButtons: "5 thân vải ghép lại, cài 5 khuy bên phải (hữu nhậm) nghiêm cẩn",
      pattern: "Gấm dệt đoàn long rồng cuộn, mây ngũ sắc và đồ án tam sơn thủy ba",
    },
    details: [
      { label: "Kiểu dáng", text: "Áo ngũ thân cổ đứng, cài năm khuy bên phải. Tay thụng rộng là nét dễ nhận biết so với áo ngũ thân tay chẽn." },
      { label: "Hoa văn", text: "Mẫu minh họa dùng gấm lam chàm thêu rồng, mây và sóng nước, kết hợp phần lót tay áo màu đỏ." },
      { label: "Cách mặc", text: "Phối cùng khăn đóng và quần dài trong lễ cưới, cúng tế, lễ hội hoặc những dịp trang trọng." },
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
    backgroundUrl: "/images/heritage/ao-tac-communal-courtyard.webp",
    mobileBackgroundUrl: "/images/heritage/ao-tac-communal-courtyard-mobile.webp",
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
      "Áo gồm năm thân vải, cổ đứng, năm khuy cài và tay chẽn gọn gàng. Đây là một tiền thân của áo dài Việt Nam hiện đại.",
    structure: {
      collar: "Cổ đứng lập lĩnh cao vuông vức, nẹp cổ cài khuy kín đáo mực thước",
      sleeves: "Tay chẽn thuôn gọn ôm vừa cánh tay, thuận tiện làm việc và sinh hoạt",
      lapelAndButtons: "5 thân áo khép kín thân thể, 5 khuy bên hữu tượng trưng ngũ thường",
      pattern: "Gấm đoạn dệt chìm hoa văn chữ Thọ chữ Phúc, mây cát tường tao nhã",
    },
    details: [
      { label: "Kiểu dáng", text: "Năm thân vải ghép thành áo, cổ đứng và năm khuy cài bên phải. Tay chẽn ôm vừa cánh tay, thuận tiện vận động." },
      { label: "Hoa văn", text: "Mẫu minh họa dùng gấm xanh chàm dệt chìm chữ Thọ, chữ Phúc và mây, phối quần trắng cùng khăn đóng đen." },
      { label: "Cách mặc", text: "Dáng áo gọn gàng dành cho cả nam và nữ, phù hợp sinh hoạt thường ngày và các hoạt động văn hóa." },
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
    backgroundUrl: "/images/heritage/ngu-than-garden-house.webp",
    mobileBackgroundUrl: "/images/heritage/ngu-than-garden-house-mobile.webp",
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
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0,
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
      tabIndex={-1}
      aria-labelledby={`garment-heading-${garment.id}`}
      className={`scroll-mt-20 sm:scroll-mt-28 relative isolate py-10 sm:py-20 transition-opacity duration-300 sm:duration-1000 motion-reduce:transition-none motion-reduce:opacity-100 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <HeritageGarmentBackdrop src={garment.backgroundUrl} mobileSrc={garment.mobileBackgroundUrl} isEven={isEven} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 items-center relative z-10">
        {/* Cột 1: Ảnh Ma-nơ-canh Tham Chiếu Cổ Phục */}
        <div
          className={`lg:col-span-5 flex flex-col items-center justify-center ${
            isEven ? "lg:order-1" : "lg:order-2"
          }`}
        >
          {/* Khung ảnh trang phục với viền vàng đồng cung đình */}
          <div className="relative w-full max-w-[280px] sm:max-w-[420px] aspect-[4/5] flex items-center justify-center">
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
                className="object-cover transform sm:group-hover:scale-105 transition-transform duration-700 motion-reduce:transition-none"
              />


            </div>
          </div>

        </div>

        {/* Giới thiệu ngắn và liên kết khám phá */}
        <div
          className={`min-w-0 lg:col-span-7 space-y-5 text-left bg-heritage-parchment/95 rounded-2xl p-4 sm:p-6 lg:bg-transparent lg:rounded-none lg:p-0 ${
            isEven ? "lg:order-2 lg:pl-6" : "lg:order-1 lg:pr-6"
          }`}
        >
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              <span className="font-medium text-heritage-red">{garment.dynasties}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              {garment.eraTime}
            </p>
            <h3 id={`garment-heading-${garment.id}`} className="min-w-0 break-words font-serif text-2xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-snug tracking-tight">
              <span className="text-amber-700/60 font-mono text-xl sm:text-2xl mr-2 font-bold">
                {chapterNum}.
              </span>
              {garment.name}
            </h3>
          </div>

          <p className="max-w-prose text-stone-600 text-base sm:text-lg leading-relaxed">
            {garment.significance}
          </p>

          <dl className="space-y-4 sm:space-y-3 border-t border-stone-200 pt-5 text-base sm:text-sm leading-relaxed">
            {garment.details.map((detail) => (
              <div key={detail.label} className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-4">
                <dt className="font-semibold text-stone-800">{detail.label}</dt>
                <dd className="min-w-0 text-stone-600">{detail.text}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-stone-500 leading-relaxed">
            Tham khảo: {garment.sourceBook}
          </p>

          <div className="pt-2">
            <Link
              href="/thu-vien"
              prefetch={true}
              className="inline-flex min-h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-heritage-red px-5 py-3 text-base sm:text-sm font-semibold text-white transition-colors hover:bg-heritage-red-dark active:bg-heritage-red-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-heritage-red"
            >
              Xem trong thư viện
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 selection:bg-heritage-gold/30 selection:text-heritage-red overflow-x-clip">
      {/* Hero with a quiet paper ground and heritage linework. */}
      <section aria-label="Giới thiệu VietStylist" className="relative isolate overflow-hidden pt-8 pb-28 sm:pt-20 sm:pb-32 lg:pb-28">
        <HeritageHeroBackdrop />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="space-y-5 sm:space-y-8">
            <h1 className="font-serif text-[clamp(1.625rem,7.5vw,2.25rem)] sm:text-5xl lg:text-6xl font-bold tracking-tight text-stone-900 leading-[1.18]">
              Ngàn Năm Áo Mũ
              <span className={`${heritageTitleFont.className} mt-[0.05em] block text-[clamp(1.875rem,8vw,3rem)] sm:text-[clamp(1.5rem,6.5vw,4.25rem)] !font-bold pb-[0.15em] leading-[1.65] tracking-[0.06em] [word-spacing:0.15em] text-transparent bg-clip-text bg-gradient-to-r from-heritage-red via-amber-600 via-rose-700 to-heritage-red sm:animate-gradient-flow`}>
                Nét Việt Ngàn Xưa
              </span>
            </h1>

            <p className="text-base sm:text-lg text-stone-600 sm:font-light leading-relaxed max-w-2xl mx-auto">
              &quot;Áo xưa qua mấy mùa dâu,
              <br />
              Đường kim còn giữ sắc màu quê hương.
              <br />
              Dẫu đi muôn nẻo đường trường,
              <br />
              Mang theo nếp áo, vấn vương quê nhà.&quot;
            </p>

            {/* Action Buttons with High-Impact Motion */}
            <div className="mx-auto max-w-sm sm:max-w-none pt-1 sm:pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/studio"
                prefetch={true}
                className="relative group min-h-14 w-full sm:w-auto px-4 sm:px-8 py-3 sm:py-4 rounded-2xl bg-heritage-red hover:bg-heritage-red-dark text-white font-bold text-base shadow-lg shadow-heritage-red/20 transition-all duration-200 sm:hover:scale-105 active:bg-heritage-red-dark flex items-center justify-center gap-2.5 border border-amber-400/40 overflow-hidden sm:ring-4 sm:ring-heritage-red/20 hover:ring-heritage-red/40"
              >
                {/* Moving Light Beam Sweep Effect */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  <div className="hidden sm:block w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent animate-beam-sweep" />
                </div>
                <Sparkles className="w-5 h-5 shrink-0 text-amber-300 sm:animate-spin" style={{ animationDuration: "8s" }} />
                <span>Thử phối một bộ đồ</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform duration-300" />
              </Link>

              <a
                href="#canonical-garments"
                className="min-h-14 w-full sm:w-auto px-4 sm:px-7 py-3 sm:py-4 rounded-2xl bg-white hover:bg-stone-50 text-stone-800 font-semibold text-base border border-stone-300 shadow-xs transition-all duration-200 flex items-center justify-center gap-2 hover:border-heritage-red/50 hover:shadow-md sm:hover:-translate-y-0.5"
              >
                <BookOpen className="w-4 h-4 shrink-0 text-heritage-indigo" />
                <span>Tìm hiểu 5 dáng áo</span>
                <ArrowDown className="w-4 h-4 shrink-0 text-stone-400 sm:animate-bounce" style={{ animationDuration: "2.5s" }} />
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* 2. CANONICAL 5 REFERENCE GARMENTS VERTICAL STORYTELLING EXHIBITION */}
      <section id="canonical-garments" aria-labelledby="canonical-heading" className="relative scroll-mt-20 bg-heritage-parchment">
        <h2 id="canonical-heading" className="sr-only">Khám phá 5 dáng áo</h2>
        <nav aria-label="Chọn dáng áo" className="mx-auto max-w-xl px-4 pt-3 pb-2 lg:hidden">
          <p className="mb-3 text-center text-sm font-semibold text-stone-600">Chọn dáng áo để khám phá</p>
          <div className="flex flex-wrap justify-center gap-2">
            {REFERENCE_GARMENTS.map((garment) => (
              <a key={garment.id} href={`#garment-${garment.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 bg-white/90 px-4 py-2 text-sm font-semibold text-stone-800 transition-colors active:bg-heritage-red/10 hover:border-heritage-red hover:text-heritage-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-heritage-red">
                {garment.shortName}
              </a>
            ))}
          </div>
        </nav>
        <div className="relative" id="heritage-timeline-container">
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
      <section aria-labelledby="comparison-heading" className="py-10 sm:py-24 bg-[#F5EFEB] border-t border-stone-300/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-8 sm:mb-14">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-indigo/10 text-heritage-indigo border border-heritage-indigo/20 text-xs font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-heritage-indigo" />
              <span>Toàn Cảnh Bảng Tham Chiếu</span>
            </div>

            <h2 id="comparison-heading" className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
              Bảo Tàng Thu Nhỏ 5 Hình Thái Cổ Phục
            </h2>

            <p className="text-base text-stone-600 sm:font-light leading-relaxed">
              Đặt cạnh nhau để so sánh trực quan sự biến đổi từ vạt giao chéo (Giao lĩnh), cổ tròn (Viên lĩnh), cổ đối khâm chữ nhật (Nhật bình) đến cổ đứng cài khuy hữu nhậm (Áo tấc, Áo ngũ thân).
            </p>
          </div>

          {/* 5-Column Responsive Gallery Grid with 3D Hover & Motion */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-5">
            {REFERENCE_GARMENTS.map((g) => {
              return (
                <a
                  key={g.id}
                  href={`#garment-${g.id}`}
                  aria-label={`Khám phá ${g.name}`}
                  className="group min-w-0 bg-white rounded-2xl sm:rounded-3xl border border-stone-200/90 transition-all duration-200 overflow-hidden flex flex-col hover:shadow-xl sm:hover:-translate-y-2 hover:border-amber-400/60 active:bg-amber-50"
                >
                  <div className="bg-gradient-to-b from-[#FBF9F6] via-stone-50 to-stone-100 flex items-center justify-center relative aspect-[4/5] sm:aspect-auto sm:h-72 overflow-hidden">
                    {/* Hover radial shimmer overlay */}
                    <div className="absolute inset-0 bg-radial-at-center from-white/60 via-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <Image
                      src={g.imageUrl}
                      alt={g.name}
                      fill
                      unoptimized
                      loading="lazy"
                      className="object-contain p-1 sm:p-2 transform sm:group-hover:scale-112 transition-transform duration-700"
                    />
                    <div className="absolute top-2 left-2 right-2 sm:right-auto px-2 py-1 rounded-lg bg-stone-900/85 text-xs font-mono text-amber-200 font-bold border border-amber-400/30 shadow-xs">
                      {g.shortName}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4 text-left">
                    <h3 className="font-serif font-bold text-sm leading-relaxed text-stone-900 group-hover:text-heritage-red transition-colors">
                      {g.name}
                    </h3>
                    <p className="text-xs leading-relaxed text-stone-600">{g.dynasties}</p>
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                      <span className="text-heritage-red font-semibold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                      <div className="hidden sm:flex space-x-1">
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
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. CORE FEATURES GRID SECTION */}
      <section className="py-10 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-8 sm:mb-16">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-indigo/10 text-heritage-indigo border border-heritage-indigo/20 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-heritage-indigo" />
            <span>Công Nghệ & Chuẩn Mực Văn Hóa</span>
          </div>

          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            Trải Nghiệm Studio Phối Đồ 2D Đỉnh Cao
          </h2>

          <p className="text-base text-stone-600 sm:font-light leading-relaxed">
            VietStylist kết hợp sức mạnh xử lý canvas đa lớp trực quan với hệ thống thẩm định tri thức di sản nghiêm cẩn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Feature 1 */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-amber-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-red/10 text-heritage-red flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-heritage-red transition-colors">
              Canvas Đa Lớp Trực Quan
            </h3>
            <p className="text-base sm:text-sm text-stone-600 leading-relaxed sm:font-light">
              Kéo thả, tự do đảo thứ tự lớp áo (áo lót trong, áo ngũ thân ngoài, quần lụa), thay đổi màu sắc tức thì và khóa các vị trí cố định.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-emerald-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-jade/10 text-heritage-jade flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-heritage-jade transition-colors">
              Thẩm Định Chuẩn Hữu Nhậm
            </h3>
            <p className="text-base sm:text-sm text-stone-600 leading-relaxed sm:font-light">
              Hệ thống thời gian thực kiểm tra hướng cài vạt áo (Hữu nhậm - cài sang phải) chuẩn quy thức cổ truyền, cảnh báo các lỗi cấm kỵ văn hóa.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-amber-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-gold/15 text-heritage-gold flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <Palette className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
              Hòa Sắc Ngũ Hành 1 Chạm
            </h3>
            <p className="text-base sm:text-sm text-stone-600 leading-relaxed sm:font-light">
              Gợi ý bảng phối màu tương sinh Kim - Mộc - Thủy - Hỏa - Thổ cùng gợi ý phụ kiện che mưa, che nắng theo thời tiết 63 tỉnh thành.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/90 shadow-sm hover:shadow-xl hover:-translate-y-2 hover:border-indigo-400/50 transition-all duration-300 space-y-4 text-left group">
            <div className="w-12 h-12 rounded-2xl bg-heritage-indigo/10 text-heritage-indigo flex items-center justify-center font-bold text-xl transform group-hover:scale-115 group-hover:rotate-6 transition-transform duration-300 shadow-2xs">
              <Share2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-heritage-indigo transition-colors">
              Xuất Ảnh Sắc Nét & Chia Sẻ
            </h3>
            <p className="text-base sm:text-sm text-stone-600 leading-relaxed sm:font-light">
              Xuất ảnh định dạng chuẩn bài đăng Instagram, Story, Facebook với độ phân giải cao, đính kèm thẻ khảo cứu học thuật chuẩn xác.
            </p>
          </div>
        </div>
      </section>

      {/* 5. OCCASION SHOWCASE SECTION */}
      <section className="py-10 sm:py-24 bg-[#F5EFEB] border-t border-stone-300/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-8 sm:mb-14">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-heritage-red/10 text-heritage-red border border-heritage-red/20 text-xs font-semibold uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-heritage-red" />
              <span>Bối Cảnh Ứng Dụng Đa Dạng</span>
            </div>

            <h2 className="font-serif text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
              Cổ Phục Trong Nhịp Sống Hiện Đại
            </h2>

            <p className="text-base text-stone-600 sm:font-light leading-relaxed">
              Dành riêng cho học sinh, sinh viên và những người yêu mến văn hóa Việt trong các dịp quan trọng.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Occasion 1 */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">🎓</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Chụp Ảnh Kỷ Yếu</h4>
              <p className="text-base sm:text-sm text-stone-600 leading-relaxed">
                Áo ngũ thân tay chẽn hoặc áo tấc thanh lịch, tôn vẻ trang nhã trong ngày tốt nghiệp trường xưa.
              </p>
            </div>

            {/* Occasion 2 */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">🌸</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Du Xuân Đón Tết</h4>
              <p className="text-base sm:text-sm text-stone-600 leading-relaxed">
                Sắc đỏ, vàng rực rỡ mang lại may mắn, ấm cúng khi sum vầy bên gia đình và du ngoạn phố phường.
              </p>
            </div>

            {/* Occasion 3 */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">🏮</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Lễ Hội Văn Hóa</h4>
              <p className="text-base sm:text-sm text-stone-600 leading-relaxed">
                Tự do sáng tạo phong cách Việt phục Remix đương đại cho các ngày hội festival truyền thống.
              </p>
            </div>

            {/* Occasion 4 */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 text-left hover:border-heritage-red/40 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group">
              <div className="text-3xl transform group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 inline-block">💍</div>
              <h4 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">Lễ Cưới Hỏi & Đính Hôn</h4>
              <p className="text-base sm:text-sm text-stone-600 leading-relaxed">
                Áo Nhật bình và áo tấc trang nghiêm, kết nối sợi dây văn hóa ngàn năm trong ngày trọng đại lứa đôi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CLOSING CTA BANNER SECTION WITH CINEMATIC MOTION */}
      <section className="py-10 sm:py-24 bg-gradient-to-r from-heritage-red-dark via-stone-950 to-heritage-red-dark text-white text-center relative overflow-hidden">
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

          <p className="text-stone-300 text-base sm:font-light max-w-2xl mx-auto leading-relaxed">
            Chỉ với vài thao tác kéo thả trên Studio 2D Canvas, bạn đã có thể kiến tạo một bản phối trang phục truyền thống chuẩn mực, tinh tế và đậm dấu ấn cá nhân.
          </p>

          <div className="pt-3">
            <Link
              href="/studio"
              prefetch={true}
              className="relative group inline-flex min-h-14 w-full sm:w-auto items-center justify-center gap-2.5 px-4 sm:px-9 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-base shadow-2xl shadow-amber-400/40 transition-all duration-300 transform hover:scale-105 active:scale-95 overflow-hidden ring-4 ring-amber-400/25"
            >
              {/* Light beam sweep on button */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-beam-sweep" />
              </div>
              <Sparkles className="w-5 h-5 text-stone-950 group-hover:rotate-12 transition-transform duration-300" />
              <span className="sm:hidden">Mở Studio phối đồ</span>
              <span className="hidden sm:inline">Mở Studio 2D Canvas Ngay</span>
              <ArrowRight className="w-4 h-4 text-stone-950 transform group-hover:translate-x-1.5 transition-transform duration-300" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
