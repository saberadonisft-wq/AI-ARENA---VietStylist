"use client";

import React from "react";
import type { EducationProjection, ComposerBundle } from "@/lib/types/v3";

interface CulturalKnowledgeBadgeProps {
  bundle?: ComposerBundle | null;
  education?: EducationProjection | null;
  validationStatus?: 'clear' | 'warning' | 'error' | 'not_evaluated' | null;
}

export const CulturalKnowledgeBadge: React.FC<CulturalKnowledgeBadgeProps> = ({
  bundle,
  education,
  validationStatus,
}) => {
  const title = education?.title || (bundle?.entity?.identity?.name_vi as string) || "Thông tin trang phục";
  const aliases = education?.aliases || [];
  const attributes = education?.attributes || bundle?.attributes || [];
  const relations = education?.relations || bundle?.relations || [];

  return (
    <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 shadow-sm text-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-base">{title}</h3>
        </div>
        {validationStatus && (
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              validationStatus === 'clear'
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {validationStatus === 'clear' ? "Không phát hiện vi phạm trong các quy tắc đã kiểm tra" : validationStatus === 'error' ? "Có vi phạm nghiêm trọng theo quy tắc đã kiểm tra" : validationStatus === 'warning' ? "Có cảnh báo hoặc dữ liệu chưa đủ" : "Chưa thể kết luận với dữ liệu hiện có"}
          </span>
        )}
      </div>

      {/* Aliases */}
      {aliases.length > 0 && (
        <p className="text-xs text-amber-800/80 dark:text-amber-300/80 italic">
          Tên gọi khác: {aliases.join(", ")}
        </p>
      )}

      {/* Cultural Invariant Attributes */}
      {attributes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900/70 dark:text-amber-400">
            Đặc điểm và trạng thái dữ liệu
          </h4>
          <div className="grid grid-cols-1 gap-1.5">
            {attributes.slice(0, 5).map((attr) => (
              <div
                key={attr.id}
                className="flex items-start justify-between text-xs bg-white/70 dark:bg-amber-900/10 p-2 rounded border border-amber-100 dark:border-amber-900/30"
              >
                <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  {attr.attribute_key.replace("construction.", "").replace("wearing.", "")}
                </span>
                <span className="font-medium text-amber-950 dark:text-amber-100">
                  {attr.state !== "known" ? ({ unknown: "Chưa rõ", not_collected: "Chưa thu thập", not_applicable: "Không áp dụng", disputed: "Có tranh luận", inferred: "Suy luận", withheld: "Không công bố" }[attr.state]) : typeof attr.value === "object" ? JSON.stringify(attr.value) : String(attr.value ?? "Chưa rõ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relations */}
      {relations.length > 0 && (
        <div className="pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900/70 dark:text-amber-400 mb-1">
            Mối liên hệ di sản
          </h4>
          <div className="flex flex-wrap gap-1">
            {relations.slice(0, 4).map((rel) => (
              <span
                key={rel.id}
                className="inline-flex items-center text-[11px] bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded"
              >
                {rel.relation_type.replace(/_/g, " ")}: <strong className="ml-1">{rel.object_id.replace("garment_", "").replace("accessory_", "")}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

