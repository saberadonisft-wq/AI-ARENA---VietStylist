import React from "react";
import { Sparkles } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 px-4 py-16">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-amber-200 border-t-heritage-red animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="font-serif text-sm font-medium text-stone-700 tracking-wide">
          Đang nạp không gian cổ phong...
        </p>
        <p className="text-[11px] text-stone-400 font-light">
          VietStylist • Di sản Y phục Việt
        </p>
      </div>
    </div>
  );
}

