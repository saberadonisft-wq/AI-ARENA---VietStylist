"use client";

import React, { useState, useEffect } from "react";
import { ColorAnalysisResponse, ColorVariantSuggestion } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { Palette, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface ColorAnalysisPanelProps {
  equippedColors: Array<{ slot: string; hex_color: string; color_name?: string; item_id?: string; variant_id?: string }>;
  onApplyColorVariant?: (suggestion: ColorVariantSuggestion) => void;
}

export default function ColorAnalysisPanel({
  equippedColors,
  onApplyColorVariant,
}: ColorAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<ColorAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setAnalysis(null);
    setError(null);
    if (!equippedColors || equippedColors.length === 0) { setIsLoading(false); return; }

    let isMounted = true;
    setIsLoading(true);

    api
      .analyzeColors({ colors: equippedColors })
      .then((data) => {
        if (isMounted) setAnalysis(data);
      })
      .catch(() => { if (isMounted) setError("Chưa phân tích được màu sắc. Bạn có thể thử lại."); })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [JSON.stringify(equippedColors), retry]);

  if (isLoading && !analysis) {
    return (
      <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-7 w-full rounded-lg" />
      </div>
    );
  }

  if (error) return <section aria-label="Hài hòa Màu sắc" className="p-3.5 bg-white rounded-xl border border-stone-200 space-y-3">
    <h3 className="text-xs font-semibold">Hài hòa Màu sắc</h3>
    <p role="alert" className="text-sm text-amber-900">{error}</p>
    <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-lg border border-stone-300 px-3 text-xs font-semibold">Thử lại phân tích màu</button>
  </section>;
  if (!analysis) return null;

  return (
    <div className="studio-color-analysis studio-panel-section p-3.5 bg-white rounded-xl border border-stone-200 shadow-sm space-y-3 text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 text-stone-900 font-semibold">
          <Palette className="w-3.5 h-3.5 text-heritage-gold" />
          <span>Hài hòa Màu sắc</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            analysis.contrast_rating === "good"
              ? "bg-emerald-100 text-emerald-800"
              : analysis.contrast_rating === "moderate"
              ? "bg-amber-100 text-amber-800"
              : "bg-stone-100 text-stone-700"
          }`}
        >
          {analysis.contrast_rating === "good" ? "Rõ nét" : "Tương phản nhẹ"} ({analysis.contrast_ratio}:1)
        </span>
      </div>

      {/* Màu chủ đạo & Điểm nhấn */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200/80">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] text-stone-500 font-medium">Chủ đạo:</span>
          <div
            className="w-[18px] h-[18px] shrink-0 rounded-full border border-black/15 shadow-sm"
            style={{ backgroundColor: analysis.dominant_color }}
            title={analysis.dominant_color}
          />
        </div>

        {analysis.accent_colors.length > 0 && (
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-stone-500 font-medium">Điểm xuyết:</span>
            <div className="flex -space-x-1">
              {analysis.accent_colors.map((hex, idx) => (
                <div
                  key={idx}
                  className="w-[18px] h-[18px] shrink-0 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gợi ý biến thể màu sắc thay thế (Gọn gàng, loại bỏ câu chữ lặp lại) */}
      {analysis.suggested_variants.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-stone-100">
          <span className="text-xs font-semibold text-stone-700 block">
            Gợi ý đổi màu:
          </span>
          <div className="space-y-1.5">
            {analysis.suggested_variants.map((sug) => (
              <div
                key={sug.variant_id}
                className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-stone-50 border border-stone-200/80 hover:bg-stone-100/60 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: sug.hex_color }}
                  />
                  <div className="font-semibold text-stone-900 text-xs">{sug.color_name}</div>
                </div>

                {onApplyColorVariant && (
                  <button
                    onClick={() => onApplyColorVariant(sug)}
                    className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded bg-stone-200/80 hover:bg-heritage-red hover:text-white text-xs font-semibold transition-colors"
                  >
                    Thử màu
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
