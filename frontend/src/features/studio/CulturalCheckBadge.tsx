"use client";

import React, { useState } from "react";
import { CulturalCheckResponse } from "@/lib/types/api";
import { ShieldCheck, AlertTriangle, AlertCircle, ChevronDown, ChevronUp, BookOpen, Wrench } from "lucide-react";

interface CulturalCheckBadgeProps {
  checkData: CulturalCheckResponse | null;
  onApplyFix?: (suggestedFix: any) => void;
}

export default function CulturalCheckBadge({ checkData, onApplyFix }: CulturalCheckBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!checkData) return null;

  const isSound = checkData.is_culturally_sound && checkData.warning_count === 0 && checkData.info_count === 0;
  const hasStrict = checkData.strict_count > 0;
  const hasWarning = checkData.warning_count > 0;

  return (
    <div className="rounded-xl border transition-all overflow-hidden shadow-sm">
      {/* Thanh tiêu đề Banner */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between px-3.5 py-2 cursor-pointer transition-colors ${
          hasStrict
            ? "bg-red-50 border-red-200 text-red-900 hover:bg-red-100/80"
            : hasWarning
            ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/80"
            : "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/80"
        }`}
      >
        <div className="flex items-center space-x-2">
          {hasStrict ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : hasWarning ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          )}

          <div className="text-xs font-semibold">
            {hasStrict
              ? `Phát hiện ${checkData.strict_count} vi phạm quy thức cổ truyền (F10)`
              : hasWarning
              ? `Có ${checkData.warning_count} lưu ý về quy chuẩn lễ nghi cổ phục`
              : checkData.info_count > 0
              ? `Có ${checkData.info_count} gợi ý về quy thức trang phục`
              : "Chưa phát hiện vi phạm trong các quy tắc đang kiểm tra"}
          </div>
        </div>

        <div className="flex items-center space-x-1 text-xs text-stone-500">
          <span>{isExpanded ? "Thu gọn" : "Xem chi tiết"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Nội dung chi tiết các cảnh báo & Trích dẫn nguồn */}
      {isExpanded && (
        <div className="p-3.5 bg-white space-y-3 text-xs divide-y divide-stone-100">
          {checkData.warnings.length === 0 ? (
            <p className="text-stone-600 leading-relaxed">
              Trang phục của bạn tuân thủ đúng nguyên tắc <strong>Hữu nhậm</strong> (cài khuy nách phải), giữ lớp viền cổ áo thanh nhã và đầy đủ lễ nghi theo thư tịch cổ triều Nguyễn.
            </p>
          ) : (
            checkData.warnings.map((w) => (
              <div key={w.rule_id} className="pt-2 first:pt-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{w.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      w.severity === "strict"
                        ? "bg-red-100 text-red-700"
                        : w.severity === "warning"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {w.severity}
                  </span>
                </div>

                <p className="text-stone-600 leading-relaxed">{w.explanation}</p>

                {/* Nguồn trích dẫn học thuật */}
                {w.source_title && (
                  <div className="flex items-start space-x-1.5 text-[11px] text-stone-500 bg-stone-50 p-2 rounded border border-stone-200">
                    <BookOpen className="w-3.5 h-3.5 text-heritage-indigo shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-stone-700">{w.source_title}:</span>{" "}
                      <span>{w.source_citation}</span>
                    </div>
                  </div>
                )}

                {/* Nút 1-click sửa nhanh */}
                {w.suggested_fix && onApplyFix && (
                  <button
                    onClick={() => onApplyFix(w.suggested_fix)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded bg-heritage-red/10 text-heritage-red hover:bg-heritage-red hover:text-white font-medium text-[11px] transition-all"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>{w.suggested_fix.label || "Áp dụng sửa nhanh"}</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
