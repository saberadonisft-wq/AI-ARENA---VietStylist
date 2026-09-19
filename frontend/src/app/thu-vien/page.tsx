"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useCatalog } from "@/lib/catalog/CatalogProvider";
import { BookOpen, Sparkles, Filter, Search, ArrowUpRight } from "lucide-react";
import { LibraryCardSkeleton } from "@/components/ui/Skeleton";

export default function ThuVienPage() {
  const { catalogItems: items, garmentTypes, occasions, isLoading } = useCatalog();
  const [selectedType, setSelectedType] = useState("all");
  const [selectedOccasion, setSelectedOccasion] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = items.filter((item) => {
    if (selectedType !== "all" && item.garment_type_id !== selectedType) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Tiêu đề trang Thư viện */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-heritage-red text-xs font-bold uppercase tracking-widest">
          <BookOpen className="w-4 h-4" />
          <span>Kho Tàng Y Phục Cổ Truyền</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
          Thư Viện Cổ Phục & Di Sản Văn Hóa
        </h1>
        <p className="text-stone-600 max-w-2xl text-sm leading-relaxed">
          Khám phá cấu trúc, lịch sử hình thành và vẻ đẹp tinh tế của các dòng Việt phục truyền thống từ thời Nguyễn đến hơi thở đương đại.
        </p>
      </div>

      {/* Thanh tìm kiếm và bộ lọc */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên áo, quần hoặc phụ kiện..."
              className="w-full text-xs pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-heritage-red"
            />
          </div>

          {/* Lọc nhóm áo */}
          <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedType("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                selectedType === "all"
                  ? "bg-stone-900 text-white shadow-sm"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Tất cả nhóm áo
            </button>
            {garmentTypes.map((gt) => (
              <button
                key={gt.id}
                onClick={() => setSelectedType(gt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  selectedType === gt.id
                    ? "bg-heritage-red text-white shadow-sm"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                {gt.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid danh sách hiện vật */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <LibraryCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const defaultVar = item.variants[0];
            return (
              <div
                key={item.id}
                className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
              >
                {/* Ảnh trang phục thật (R2/Public) hoặc lớp SVG */}
                <div className="h-56 bg-[#FAF8F5] relative flex items-center justify-center border-b border-stone-100 overflow-hidden p-3">
                  {item.metadata?.real_image_url ? (
                    <img
                      src={item.metadata.real_image_url}
                      alt={item.name}
                      className="h-full w-auto object-contain transition-transform group-hover:scale-105 duration-300 drop-shadow-sm"
                    />
                  ) : item.default_layer?.svg_content ? (
                    <svg
                      viewBox="0 0 800 1200"
                      className="h-full w-auto object-contain transition-transform group-hover:scale-105 duration-300"
                      dangerouslySetInnerHTML={{ __html: item.default_layer.svg_content }}
                    />
                  ) : (
                    <div className="text-stone-400 text-xs font-serif">Ảnh tư liệu di sản</div>
                  )}

                  <div className="absolute top-3 right-3 flex items-center space-x-1.5">
                    {item.metadata?.real_image_url && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-heritage-red text-white shadow-sm">
                        Ảnh hiện vật
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-900/80 text-white backdrop-blur">
                      {item.era || "Thời Nguyễn"}
                    </span>
                  </div>
                </div>

                {/* Thông tin */}
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-1 text-[11px] text-stone-500 capitalize">
                      <span>Vị trí: {item.slot}</span>
                      <span>•</span>
                      <span>Dành cho: {item.gender}</span>
                    </div>
                    <h3 className="font-serif font-bold text-base text-stone-900 group-hover:text-heritage-red transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Swatches màu của item */}
                  {item.variants.length > 0 && (
                    <div className="pt-2 flex items-center space-x-1.5">
                      <span className="text-[10px] text-stone-400 font-medium">Màu sắc:</span>
                      <div className="flex -space-x-1">
                        {item.variants.map((v) => (
                          <div
                            key={v.id}
                            className="w-4 h-4 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: v.hex_color }}
                            title={v.color_name}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Link xem chi tiết và thử phối */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                    <Link
                      href={`/trang-phuc/${item.id}`}
                      className="text-xs font-semibold text-stone-700 hover:text-heritage-red flex items-center space-x-1 transition-colors"
                    >
                      <span>Xem tích truyện di sản</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link
                      href="/"
                      className="px-3 py-1 bg-stone-100 hover:bg-heritage-red hover:text-white rounded-lg text-xs font-medium text-stone-800 transition-colors"
                    >
                      Phối đồ ngay
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
