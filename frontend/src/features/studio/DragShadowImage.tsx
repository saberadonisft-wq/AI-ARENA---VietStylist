"use client";

import { useEffect, useState } from "react";

// Cache blobs, not shared object URLs: each mount can release its own URL safely.
const cache = new Map<string, Promise<Blob | null>>();
let queue = Promise.resolve();
let activeExports = 0;

export function pauseDragPreviewPreparation() {
  activeExports++;
  let released = false;
  return () => { if (!released) { released = true; activeExports--; } };
}

async function waitForExport() {
  while (activeExports) await new Promise<void>(resolve => setTimeout(resolve, 50));
}

function shadowBlob(url: string, width: number, height: number): Promise<Blob | null> {
  const key = JSON.stringify([url, width, height]);
  const existing = cache.get(key);
  if (existing) return existing;
  const pending = queue.then(async () => {
    await waitForExport();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let svgUrl: string | undefined;
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) return null;
      const data = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(data);
      });
      // Match the original SVG filter, including its bounding-box region.
      const paddedWidth = width * 1.6, paddedHeight = height * 1.6;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${paddedWidth * 2}" height="${paddedHeight * 2}" viewBox="${-width * .3} ${-height * .3} ${paddedWidth} ${paddedHeight}"><defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#1A202C" floodOpacity="0.10"/><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#1A202C" floodOpacity="0.06"/></filter></defs><image href="${dataUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" filter="url(#shadow)"/></svg>`;
      svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve(); image.onerror = () => reject(new Error("Shadow preview failed"));
        image.src = svgUrl!;
      });
      await waitForExport();
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(paddedWidth * 2); canvas.height = Math.ceil(paddedHeight * 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    } catch { return null; }
    finally { clearTimeout(timer); if (svgUrl) URL.revokeObjectURL(svgUrl); }
  });
  queue = pending.then(() => undefined);
  cache.set(key, pending);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  void pending.then(blob => { if (!blob && cache.get(key) === pending) cache.delete(key); });
  return pending;
}

export default function DragShadowImage({ url, x, y, width, height }: {
  url: string; x: number; y: number; width: number; height: number;
}) {
  const [imageUrl, setImageUrl] = useState<string>();
  useEffect(() => {
    let active = true, objectUrl: string | undefined;
    setImageUrl(undefined);
    // Private session images must never enter the module-level blob cache.
    // The original SVG image already renders its shadow and supports dragging.
    if (url.startsWith("blob:")) return;
    const timer = setTimeout(() => {
      void shadowBlob(url, width, height).then(blob => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      });
    }, 500);
    return () => { active = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, width, height]);
  return imageUrl ? <image className="studio-drag-preview" href={imageUrl}
    x={x - width * .3} y={y - height * .3} width={width * 1.6} height={height * 1.6}
    preserveAspectRatio="none" pointerEvents="none" /> : null;
}
