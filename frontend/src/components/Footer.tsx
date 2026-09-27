"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Shield, Heart } from "lucide-react";
import Logo from "@/components/Logo";

export default function Footer() {

  return (
    <footer className="bg-[#F5EFEB] border-t border-stone-300/80 text-stone-700 py-10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Cột 1: Thông tin dự án */}
          <div className="md:col-span-2 space-y-3">
            <Link href="/" className="inline-block group">
              <Logo size="sm" />
            </Link>
            <p className="text-sm text-stone-600 max-w-md leading-relaxed">
              Ứng dụng web phối đồ 2D trực quan kết hợp chuẩn mực di sản văn hóa truyền thống thời Nguyễn và phong cách phối đương đại cho học sinh, sinh viên.
            </p>
            <div className="flex items-center space-x-4 pt-2 text-xs text-stone-500">
              <span className="flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-heritage-red" />
                <span>Hỗ trợ kiểm tra quy tắc Hữu nhậm</span>
              </span>
              <span className="flex items-center space-x-1">
                <BookOpen className="w-3.5 h-3.5 text-heritage-indigo" />
                <span>Tư liệu có nguồn tham khảo</span>
              </span>
            </div>
          </div>

          {/* Cột 2: Di sản & Nguồn tư liệu */}
          <div>
            <h4 className="font-serif text-sm font-bold text-stone-900 mb-3 uppercase tracking-wider">
              Tài liệu Tham khảo
            </h4>
            <ul className="space-y-2 text-xs text-stone-600">
              <li>
                <span className="font-semibold block text-stone-800">Ngàn năm áo mũ</span>
                Trần Quang Đức (NXB Thế Giới, 2013)
              </li>
              <li>
                <span className="font-semibold block text-stone-800">Đại Nam hội điển sự lệ</span>
                Nội Các Triều Nguyễn (1851)
              </li>
              <li>
                <span className="font-semibold block text-stone-800">Trang phục triều Nguyễn</span>
                TT Bảo tồn Di tích Cố đô Huế
              </li>
            </ul>
          </div>

          {/* Cột 3: Liên kết nhanh */}
          <div>
            <h4 className="font-serif text-sm font-bold text-stone-900 mb-3 uppercase tracking-wider">
              Khám phá
            </h4>
            <ul className="space-y-2 text-xs text-stone-600">
              <li>
                <Link href="/studio" className="hover:text-heritage-red transition-colors">
                  Studio Phối đồ
                </Link>
              </li>
              <li>
                <Link href="/thu-vien" className="hover:text-heritage-red transition-colors">
                  Thư viện Áo ngũ thân & Áo tấc
                </Link>
              </li>
              <li>
                <Link href="/lookbook" className="hover:text-heritage-red transition-colors">
                  Bộ sưu tập Lookbook cá nhân
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-stone-300 text-center text-xs text-stone-500 flex flex-col sm:flex-row items-center justify-between">
          <p>© 2026 VietStylist. Nền tảng tôn vinh và sáng tạo trên nền di sản Việt Nam.</p>
          <p className="flex items-center space-x-1 mt-2 sm:mt-0">
            <span>Dành tặng tình yêu cổ phong Việt</span>
            <Heart className="w-3 h-3 text-heritage-red fill-heritage-red" />
          </p>
        </div>
      </div>
    </footer>
  );
}
