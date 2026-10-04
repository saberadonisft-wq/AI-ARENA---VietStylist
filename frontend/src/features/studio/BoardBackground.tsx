"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { loadBackground, normalizeBackgroundFade, paintBackground, type BoardRatio, type NeutralBackground } from "./backgrounds";

function BackgroundLayer({ image, neutral, ratio, backgroundFade, fade = false }: {
  image: HTMLImageElement | null; neutral: NeutralBackground; ratio: BoardRatio; backgroundFade: number; fade?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) paintBackground(ctx, canvas.width, canvas.height, neutral, image, 0);
  }, [image, neutral, ratio]);
  return <div className={`absolute inset-0 ${fade ? "studio-background-fade" : ""}`}>
    <canvas ref={ref} width={900} height={ratio === "1:1" ? 900 : 1600} className="absolute inset-0 h-full w-full" />
    {image && <div className="absolute inset-0 bg-[#FAF8F5]"
      style={{ opacity: `var(--studio-background-fade, ${normalizeBackgroundFade(backgroundFade) / 100})` }} />}
  </div>;
}

export default function BoardBackground({ url, neutral, ratio, backgroundFade = 0 }: {
  url?: string; neutral: NeutralBackground; ratio: BoardRatio; backgroundFade?: number;
}) {
  const [frames, setFrames] = useState<Array<{ url: string; image: HTMLImageElement }>>([]);
  const [status, setStatus] = useState<{ url?: string; value: string }>({ value: "neutral" });
  useEffect(() => {
    let active = true;
    let cleanup: ReturnType<typeof setTimeout> | undefined;
    if (!url) { setFrames([]); setStatus({ value: "neutral" }); return; }
    setStatus({ url, value: "loading" });
    void loadBackground(url).then(image => {
      if (!active) return;
      setStatus({ url, value: image ? "ready" : "fallback" });
      if (!image) { setFrames([]); return; }
      setFrames(previous => [...previous.filter(frame => frame.url !== url).slice(-1), { url, image }]);
      cleanup = setTimeout(() => { if (active) setFrames([{ url, image }]); }, 260);
    });
    return () => { active = false; clearTimeout(cleanup); };
  }, [url]);
  return <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
    data-testid="board-background" data-background-url={url || ""}
    data-background-status={!url ? "neutral" : status.url === url ? status.value : "loading"}>
    <BackgroundLayer image={null} neutral={neutral} ratio={ratio} backgroundFade={backgroundFade} />
    {url && frames.map(frame => <BackgroundLayer key={frame.url} image={frame.image}
      neutral={neutral} ratio={ratio} backgroundFade={backgroundFade} fade />)}
  </div>;
}
