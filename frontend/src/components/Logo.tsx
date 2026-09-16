import React from "react";

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
    sm: { box: "w-8 h-8 rounded-lg", icon: 20, text: "text-lg", sub: "text-[10px]" },
    md: { box: "w-10 h-10 rounded-xl", icon: 24, text: "text-xl", sub: "text-[11px]" },
    lg: { box: "w-12 h-12 rounded-2xl", icon: 28, text: "text-2xl", sub: "text-xs" },
    xl: { box: "w-16 h-16 rounded-2xl", icon: 36, text: "text-3xl", sub: "text-sm" },
  };

  const current = dimensions[size];

  return (
    <div className={`flex items-center space-x-3 select-none ${className}`}>
      {/* Brand Icon: Heritage Red (#9B2C2C) background with pure White (#FFFFFF) Vietnamese collar + VS monogram */}
      <div
        className={`${current.box} bg-gradient-to-br from-[#A82B2B] via-[#9B2C2C] to-[#801F1F] flex items-center justify-center text-white shadow-md border border-white/20 flex-shrink-0 transition-transform group-hover:scale-105`}
        title="VietStylist Logo"
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Stylized Traditional Vietnamese Tunic Collar (Áo Giao Lĩnh / Ngũ Thân - Hữu Nhậm) forming 'V' */}
          <path
            d="M8 10L20 32L32 10"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Overlapping inner collar fold (right lapel over left - Hữu Nhậm standard) */}
          <path
            d="M13 10L23.5 27.5"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
          />
          {/* Stylist Accent: Modern Stylist S-Curve & Sparkle Diamond */}
          <path
            d="M27 15C27 13.5 25.5 12 23 12C20.5 12 19 13.5 19 15C19 17.5 25 18 25 21C25 22.8 23.2 24 21 24C19 24 17.5 22.8 17.5 21.5"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="31" cy="9" r="2.2" fill="white" />
        </svg>
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="leading-tight">
          <div
            className={`font-serif ${current.text} font-bold tracking-tight ${
              textColor === "light" ? "text-white" : "text-stone-900"
            }`}
          >
            Viet<span className="text-[#9B2C2C]">Stylist</span>
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

