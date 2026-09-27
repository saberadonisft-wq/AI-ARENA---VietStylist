"use client";

import React from "react";
import { ItemVariant } from "@/lib/types/api";
import { Check } from "lucide-react";

interface SwatchPickerProps {
  variants: ItemVariant[];
  selectedVariantId?: string;
  selectedColorHex?: string;
  disabled?: boolean;
  onSelectVariant: (variant: ItemVariant) => void;
}

export default function SwatchPicker({
  variants,
  selectedVariantId,
  selectedColorHex,
  disabled = false,
  onSelectVariant,
}: SwatchPickerProps) {
  if (!variants || variants.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">
        Biến thể Màu sắc & Chất liệu ({variants.length})
      </label>
      <div className="flex flex-wrap gap-2.5">
        {variants.map((v) => {
          const isSelected = (selectedVariantId === v.id || (!selectedVariantId && v.is_default)) &&
            (!selectedColorHex || selectedColorHex.toLowerCase() === v.hex_color.toLowerCase());

          return (
            <button
              key={v.id}
              disabled={disabled}
              onClick={() => onSelectVariant(v)}
              className={`group relative flex min-h-11 min-w-11 items-center space-x-2 pl-2 pr-3 py-1 rounded-full border text-left transition-all ${
                isSelected
                  ? "border-stone-900 bg-stone-900 text-white shadow-sm"
                  : "border-stone-300 bg-white text-stone-800 hover:border-stone-500"
              }`}
            >
              {/* Vòng tròn màu với màu phụ nếu có */}
              <div
                className="w-5 h-5 rounded-full border border-black/10 flex items-center justify-center shrink-0 shadow-inner"
                style={{ backgroundColor: v.hex_color }}
              >
                {v.secondary_hex && (
                  <div
                    className="w-2 h-2 rounded-full border border-white/40"
                    style={{ backgroundColor: v.secondary_hex }}
                  />
                )}
                {isSelected && (
                  <Check
                    className={`w-3 h-3 ${
                      v.hex_color.toLowerCase() === "#ffffff" || v.hex_color.toLowerCase() === "#f7fafc"
                        ? "text-stone-900"
                        : "text-white"
                    }`}
                  />
                )}
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-medium leading-tight">{v.color_name}</span>
                {v.material && (
                  <span
                    className={`text-[9px] leading-tight ${
                      isSelected ? "text-stone-300" : "text-stone-500"
                    }`}
                  >
                    {v.material}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
