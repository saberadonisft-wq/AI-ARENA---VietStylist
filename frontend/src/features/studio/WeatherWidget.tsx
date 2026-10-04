"use client";

import { useEffect, useState } from "react";
import type { WeatherResponse } from "@/lib/types/api";
import { api } from "@/lib/api/client";
import { CloudSun, CloudRain, Sparkles, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

const CITIES = [
  { key: "hanoi", name: "Hà Nội" }, { key: "hue", name: "Cố đô Huế" },
  { key: "danang", name: "Đà Nẵng" }, { key: "hoian", name: "Hội An" },
  { key: "hcm", name: "TP. Hồ Chí Minh" }, { key: "sapa", name: "Sa Pa" },
  { key: "dalat", name: "Đà Lạt" }, { key: "cantho", name: "Cần Thơ" },
];

export default function WeatherWidget({ onApplyWeatherSuggestion }: {
  onApplyWeatherSuggestion?: (accessories: string[]) => void;
}) {
  const [selectedCity, setSelectedCity] = useState("hanoi");
  const [result, setResult] = useState<{ city: string; data: WeatherResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null); setError(null); setIsLoading(true);
    api.getWeather(selectedCity)
      .then(data => { if (active) setResult({ city: selectedCity, data }); })
      .catch(() => { if (active) setError("Chưa tải được thời tiết cho thành phố này. Hãy thử lại."); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [selectedCity, retry]);
  const data = result?.city === selectedCity ? result.data : null;
  return <section aria-label="Thời tiết và bối cảnh" aria-busy={isLoading} className="p-3.5 bg-white rounded-xl border border-stone-200 shadow-sm space-y-2.5 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-stone-700 font-semibold"><MapPin aria-hidden="true" className="w-3.5 h-3.5 text-heritage-red" />Thời tiết &amp; Bối cảnh</h3>
      <select aria-label="Thành phố xem thời tiết" value={selectedCity}
        onChange={event => { setSelectedCity(event.target.value); setError(null); setIsLoading(true); }}
        className="min-w-0 max-w-full text-xs bg-stone-50 border border-stone-300 rounded-md px-2 py-1 font-medium">
        {CITIES.map(city => <option key={city.key} value={city.key}>{city.name}</option>)}
      </select>
    </div>
    {isLoading && <div role="status" className="space-y-2"><span>Đang tải thời tiết…</span><Skeleton className="h-16 w-full rounded-lg" /></div>}
    {error && <div className="space-y-2"><p role="alert" className="text-sm text-amber-900">{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 rounded-lg border border-stone-300 px-3 font-semibold">Thử lại thời tiết</button></div>}
    {data && !isLoading && <>
      {data.source === "sample" && <p role="status" className="text-amber-800">Chưa lấy được thời tiết thực tế. Số liệu bên dưới là dữ liệu minh họa.</p>}
      <div className="flex items-center justify-between gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200/80">
        <div className="flex items-center gap-2">
          {data.weather.is_rainy ? <CloudRain className="w-5 h-5 text-blue-500" /> : <CloudSun className="w-5 h-5 text-amber-500" />}
          <div><div className="font-bold text-stone-900 text-sm">{data.weather.temperature_c}°C</div><div className="text-[11px] text-stone-500">{data.weather.weather_condition}</div></div>
        </div>
        <div className="text-right text-[11px] text-stone-500 space-y-0.5"><div>Độ ẩm: {data.weather.humidity_percent}%</div><div>Gió: {data.weather.wind_speed_kmh} km/h</div></div>
      </div>
      <div className="space-y-1 text-stone-700 leading-relaxed text-[11px]"><p><strong>Khuyên dùng:</strong> {data.recommendation.layer_advice}</p><p><strong>Vải may:</strong> {data.recommendation.fabric_advice}</p></div>
      {data.recommendation.suggested_accessories.length > 0 && onApplyWeatherSuggestion && <>
        <p className="break-words text-stone-600">Phụ kiện gợi ý: {data.recommendation.suggested_accessories.join(", ")}</p>
        <button type="button" onClick={() => onApplyWeatherSuggestion(data.recommendation.suggested_accessories)} className="min-h-11 w-full flex items-center justify-center gap-1.5 rounded-lg bg-heritage-indigo/10 px-3 text-heritage-indigo hover:bg-heritage-indigo hover:text-white font-medium"><Sparkles aria-hidden="true" className="w-3.5 h-3.5" />Thêm phụ kiện phù hợp</button>
      </>}
    </>}
  </section>;
}
