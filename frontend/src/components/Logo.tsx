import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textColor?: "dark" | "light";
  className?: string;
}

export default function Logo({
  size = "md",
  showText = true,
  textColor = "dark",
  className = "",
}: LogoProps) {
  // Dimension definitions
  const dimensions = {
    sm: { box: "w-8 h-8", text: "text-lg", sub: "text-[10px]" },
    md: { box: "w-10 h-10", text: "text-xl", sub: "text-[11px]" },
    lg: { box: "w-12 h-12", text: "text-2xl", sub: "text-xs" },
    xl: { box: "w-16 h-16", text: "text-3xl", sub: "text-sm" },
  };

  const current = dimensions[size];

  return (
    <div className={`flex items-center space-x-3 select-none outline-none border-none ${className}`}>
      {/* Approved Nếp vải monogram, shared with the browser tab icon. */}
      <div
        className={`${current.box} flex items-center justify-center flex-shrink-0`}
      >
        <Image
          src="/brand/vietstylist-mark.svg?v=2"
          alt={showText ? "" : "VietStylist"}
          width={192}
          height={192}
          unoptimized
          className={`w-full h-full${textColor === "light" ? " brightness-0 invert" : ""}`}
        />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="leading-tight">
          <div
            className={`font-serif ${current.text} font-bold tracking-tight ${
              textColor === "light" ? "text-white" : "text-stone-900"
            }`}
          >
            Viet<span className="text-heritage-red">Stylist</span>
          </div>
          <span
            className={`${current.sub} ${
              textColor === "light" ? "text-stone-300" : "text-stone-500"
            } font-medium tracking-tight block`}
          >
            Nền tảng Phối đồ & Di sản Thời trang Việt
          </span>
        </div>
      )}
    </div>
  );
}

