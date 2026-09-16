"use client";

import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Thành phần Skeleton Shimmer cơ bản
 * Tạo hiệu ứng ánh sáng lướt mượt mà chuẩn giao diện cao cấp
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden bg-stone-200/75 rounded-lg before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent ${className}`}
      {...props}
    />
  );
}

/**
 * Skeleton cho từng dòng trang phục trong danh sách kho đồ cột trái Studio
 */
export function GarmentItemSkeleton() {
  return (
    <div className="flex items-center space-x-3 p-2.5 rounded-xl border border-stone-200/60 bg-white/70">
      <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded-md" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-3 w-16 rounded-md" />
          <Skeleton className="h-3 w-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton cho lưới Hoàn cảnh sử dụng (Occasions)
 */
export function OccasionGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-2.5 rounded-xl border border-stone-200/70 bg-stone-50/50 space-y-1.5">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-3 w-12 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton cho thẻ phân loại áo (Garment type tabs/chips)
 */
export function GarmentTypeTabsSkeleton() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-6 w-16 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Skeleton cho thẻ hiện vật trong trang Thư viện Cổ phục (/thu-vien)
 */
export function LibraryCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm flex flex-col justify-between">
      {/* Vùng ảnh lớn */}
      <div className="h-56 bg-stone-100/70 relative p-4 flex items-center justify-center">
        <Skeleton className="w-40 h-44 rounded-xl" />
        <div className="absolute top-3 right-3 flex items-center space-x-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>

      {/* Thông tin */}
      <div className="p-5 space-y-3">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-3/4 rounded-md" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-3.5 w-16 rounded-md" />
            <Skeleton className="h-3.5 w-24 rounded-md" />
          </div>
        </div>

        <Skeleton className="h-10 w-full rounded-md" />

        <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton cho thẻ bộ sưu tập Lookbook (/lookbook)
 */
export function LookbookCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm p-5 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <Skeleton className="h-5 w-2/3 rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>

      {/* Preview ảnh nhỏ */}
      <div className="grid grid-cols-3 gap-2 py-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>

      <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton cho modal Mẫu mở đầu Starter Outfit
 */
export function StarterOutfitCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5] flex flex-col justify-between space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
      <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-3 w-16 rounded-md" />
      </div>
    </div>
  );
}

