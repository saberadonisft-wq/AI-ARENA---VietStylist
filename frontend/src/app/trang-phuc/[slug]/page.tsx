"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CatalogItem, HeritageArticle } from "@/lib/types/api";
import { eraLabel, slotLabel, genderLabel } from "@/lib/catalog/display";
import { catalogImageUrl } from "@/lib/catalog/images";
import { api } from "@/lib/api/client";
import { BookOpen, Sparkles, ArrowLeft, Shield, Check, Compass } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function TrangPhucDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [item, setItem] = useState<CatalogItem | null>(null);
  const [article, setArticle] = useState<HeritageArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [libraryHref, setLibraryHref] = useState("/thu-vien");

  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    setLibraryHref(returnTo && /^\/thu-vien(?:\?|$)/.test(returnTo) ? returnTo : "/thu-vien");
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setNotFound(false);
    setItem(null);
    setArticle(null);
    setImageLoadFailed(false);

    api
      .getItemDetail(slug)
      .then((itemData) => {
        if (!active) return null;
        if (!itemData || typeof itemData !== "object" || Array.isArray(itemData) ||
            typeof itemData.id !== "string" || typeof itemData.name !== "string" || typeof itemData.slot !== "string") {
          throw new Error("Máy chủ trả dữ liệu trang phục không hợp lệ. Hãy thử tải lại.");
        }
        const safeItem: CatalogItem = {
          ...itemData,
          metadata: itemData.metadata && typeof itemData.metadata === "object" && !Array.isArray(itemData.metadata) ? itemData.metadata : {},
          variants: Array.isArray(itemData.variants) ? itemData.variants : [],
        };
        setItem(safeItem);
        // Tìm bài viết di sản liên quan (ví dụ: art_ngu_than hoặc art_ao_tac)
        const articleKey = safeItem.garment_type_id ? `art_${safeItem.garment_type_id}` : "art_ngu_than";
        return api.getHeritageArticle(articleKey).catch(() => null);
      })
      .then((artData) => {
        if (active && artData) setArticle(artData);
      })
      .catch((err) => {
        if (!active) return;
        if (err?.statusCode === 404) setNotFound(true);
        else setLoadError(err?.message || "Không tải được dữ liệu trang phục.");
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [slug, retry]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <Skeleton className="h-5 w-40 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-6 bg-white rounded-3xl p-6 border border-stone-200">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="md:col-span-6 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4 rounded-lg" />
              <div className="flex space-x-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-12 w-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-serif font-bold text-stone-900">{loadError ? "Không tải được thông tin trang phục" : notFound ? "Không tìm thấy thông tin trang phục" : "Thông tin trang phục chưa sẵn sàng"}</h2>
        {loadError && <p role="alert" className="text-sm text-rose-800">{loadError}</p>}
        {loadError && <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold">Thử tải lại</button>}
        <Link href={libraryHref} className="inline-flex min-h-11 items-center text-sm text-heritage-red font-semibold hover:underline">
          ← Quay lại Thư viện
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Nút quay lại */}
      <Link
        href={libraryHref}
        className="inline-flex min-h-11 items-center space-x-1.5 text-sm font-semibold text-stone-600 hover:text-heritage-red transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay lại Thư viện Cổ phục</span>
      </Link>

      {/* Phần 1: Tổng quan hiện vật & Canvas Vector */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm items-center">
        {/* Vector Preview hoặc Ảnh thật */}
        <div className="md:col-span-5 bg-[#FAF8F5] rounded-2xl p-6 flex flex-col items-center justify-center border border-stone-100 min-h-[360px] relative">
          {(item.metadata?.real_image_url || item.metadata?.catalog_media_id) && !imageLoadFailed ? (
            <img
              src={catalogImageUrl(item)}
              alt={item.name}
              onError={() => setImageLoadFailed(true)}
              className="w-full max-h-80 object-contain drop-shadow-md transition-transform hover:scale-105 duration-300"
            />
          ) : item.default_layer?.svg_content ? (
            <svg
              viewBox="0 0 800 1200"
              className="w-full h-72 object-contain"
              dangerouslySetInnerHTML={{ __html: item.default_layer.svg_content }}
            />
          ) : (
            <div className="text-stone-400 text-xs font-serif">Ảnh tư liệu cổ phục</div>
          )}
          {imageLoadFailed && <span role="alert" className="mt-2 text-xs text-amber-800">Không tải được ảnh trang phục. Thông tin bên dưới vẫn dùng được.</span>}
          {catalogImageUrl(item) && !imageLoadFailed && (
            <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-heritage-red text-white shadow-sm">
              Ảnh trang phục
            </span>
          )}
        </div>

        {/* Thông số & Nút hành động */}
        <div className="md:col-span-7 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span className="uppercase font-bold tracking-wider text-heritage-red">
                {eraLabel(item.era)}
              </span>
              <span>•</span>
              <span className="capitalize">{slotLabel(item.slot)}</span>
              <span>•</span>
              <span className="capitalize">{genderLabel(item.gender)}</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              {item.name}
            </h1>
            <p className="text-stone-600 text-xs leading-relaxed">{item.description}</p>
          </div>

          {/* Các biến thể màu sắc có sẵn */}
          {item.variants.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-stone-100">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider block">
                Biến thể màu sắc & Chất liệu dệt ({item.variants.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {item.variants.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center space-x-2 pl-1 pr-3 py-1 rounded-full border border-stone-200 bg-stone-50 text-xs"
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: v.hex_color }}
                    />
                    <span className="font-medium text-stone-800 text-[11px]">{v.color_name}</span>
                    {v.material?.trim() && <span className="text-[9px] text-stone-500">({v.material.trim()})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nút phối đồ ngay */}
          <div className="pt-3">
            <Link
              href={`/studio?itemId=${encodeURIComponent(item.id)}`}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-heritage-red hover:bg-heritage-red-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-heritage-gold-light" />
              <span>Đưa vào Studio Phối đồ ngay</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Phần 2: Kiến thức Di sản & Khảo cứu Thư tịch cổ (F04) */}
      {article && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 text-heritage-indigo text-xs font-bold uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Kiến thức di sản & tư liệu tham khảo</span>
          </div>

          {/* Tóm tắt ngắn dưới 80 từ theo đúng tiêu chuẩn đề bài */}
          <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-stone-800 text-xs leading-relaxed font-medium">
            <span className="font-bold text-amber-900 block mb-1">Tóm lược cốt lõi:</span>
            {article.short_summary}
          </div>

          {/* Cấu trúc may mặc & Bối cảnh lịch sử */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-700 leading-relaxed">
            {article.structural_description && (
              <div className="space-y-1.5 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                <h4 className="font-serif font-bold text-stone-900 text-sm">Cấu Trúc Y Phục Chuẩn Mực</h4>
                <p>{article.structural_description}</p>
              </div>
            )}

            {article.historical_context && (
              <div className="space-y-1.5 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                <h4 className="font-serif font-bold text-stone-900 text-sm">Bối Cảnh Thời Đại & Điển Chế</h4>
                <p>{article.historical_context}</p>
              </div>
            )}
          </div>

          {/* Cảm hứng đương đại */}
          {article.modern_interpretation && (
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 leading-relaxed space-y-1.5">
              <h4 className="font-serif font-bold text-stone-900 text-sm">Hơi Thở Đương Đại (Remix)</h4>
              <p>{article.modern_interpretation}</p>
            </div>
          )}

          {/* Trích dẫn thư tịch nguồn */}
          {article.sources && article.sources.length > 0 && (
            <div className="pt-4 border-t border-stone-200 space-y-2">
              <span className="font-bold text-stone-900 text-xs block">Thư mục tham chiếu:</span>
              <div className="space-y-2">
                {article.sources.map((cite, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-600 space-y-1"
                  >
                    <div className="font-semibold text-stone-800">
                      {cite.source.title} — {cite.source.author} ({cite.source.publication_year})
                    </div>
                    {cite.page_reference && (
                      <div className="text-[11px] text-stone-500 font-mono">{cite.page_reference}</div>
                    )}
                    {cite.quote && (
                      <blockquote className="italic text-stone-600 border-l-2 border-heritage-red pl-2 mt-1">
                        "{cite.quote}"
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
