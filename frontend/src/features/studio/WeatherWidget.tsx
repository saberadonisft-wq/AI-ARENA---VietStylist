"use client";

import React, { useState, useEffect } from "react";
import { WeatherResponse } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { CloudSun, CloudRain, Thermometer, Wind, Sparkles, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

interface WeatherWidgetProps {
  onApplyWeatherSuggestion?: (accessories: string[]) => void;
}

const CITIES = [
  { key: "hanoi", name: "Hà Nội" },
  { key: "hue", name: "Cố đô Huế" },
  { key: "danang", name: "Đà Nẵng" },
  { key: "hoian", name: "Hội An" },
  { key: "hcm", name: "TP. Hồ Chí Minh" },
  { key: "sapa", name: "Sa Pa" },
  { key: "dalat", name: "Đà Lạt" },
  { key: "cantho", name: "Cần Thơ" },
];

export default function WeatherWidget({ onApplyWeatherSuggestion }: WeatherWidgetProps) {
  const [selectedCity, setSelectedCity] = useState("hanoi");
  const [weatherData, setWeatherData] = useState<WeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api
      .getWeather(selectedCity)
      .then((data) => {
        if (isMounted) setWeatherData(data);
      })
      .catch((err) => console.error("Lỗi lấy thời tiết:", err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCity]);

  if (!weatherData && isLoading) {
    return (
      <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <div className="flex items-center space-x-3 py-1">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-7 w-full rounded-md" />
      </div>
    );
  }

  if (!weatherData) return null;

  const { weather, recommendation } = weatherData;

  return (
    <div className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-sm space-y-2.5 text-xs">
      {weatherData.source === "sample" && <p role="status" className="text-amber-800">Chưa lấy được thời tiết thực tế. Số liệu bên dưới là dữ liệu minh họa.</p>}
      {/* Chọn thành phố */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-stone-700 font-semibold">
          <MapPin className="w-3.5 h-3.5 text-heritage-red" />
          <span>Thời tiết & Bối cảnh (F06)</span>
        </div>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="text-xs bg-stone-50 border border-stone-300 rounded-md px-2 py-1 focus:outline-none focus:border-heritage-red font-medium"
        >
          {CITIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Thông tin nhiệt độ & điều kiện */}
      <div className="flex items-center justify-between bg-stone-50 p-2 rounded-lg border border-stone-200/80">
        <div className="flex items-center space-x-2">
          {weather.is_rainy ? (
            <CloudRain className="w-5 h-5 text-blue-500" />
          ) : (
            <CloudSun className="w-5 h-5 text-amber-500" />
          )}
          <div>
            <div className="font-bold text-stone-900 text-sm">
              {weather.temperature_c}°C
            </div>
            <div className="text-[11px] text-stone-500">{weather.weather_condition}</div>
          </div>
        </div>

        <div className="text-right text-[11px] text-stone-500 space-y-0.5">
          <div>Độ ẩm: {weather.humidity_percent}%</div>
          <div>Gió: {weather.wind_speed_kmh} km/h</div>
        </div>
      </div>

      {/* Lời khuyên chất liệu & số lớp áo */}
      <div className="space-y-1 text-stone-700 leading-relaxed text-[11px]">
        <div>
          <span className="font-semibold text-stone-900">Khuyên dùng:</span> {recommendation.layer_advice}
        </div>
        <div>
          <span className="font-semibold text-stone-900">Vải may:</span> {recommendation.fabric_advice}
        </div>
      </div>

      {/* Nút áp dụng phụ kiện gợi ý */}
      {recommendation.suggested_accessories.length > 0 && onApplyWeatherSuggestion && (
        <button
          onClick={() => onApplyWeatherSuggestion(recommendation.suggested_accessories)}
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-heritage-indigo/10 text-heritage-indigo hover:bg-heritage-indigo hover:text-white font-medium transition-colors text-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gợi ý thêm phụ kiện: {recommendation.suggested_accessories.join(", ")}</span>
        </button>
      )}
    </div>
  );
}
