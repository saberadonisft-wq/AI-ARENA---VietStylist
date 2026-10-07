"use client";

import { useNearViewport } from "@/lib/hooks/useNearViewport";

export default function StoryCover({ src, title }: { src: string; title: string }) {
  const { ref, isNearViewport } = useNearViewport<HTMLDivElement>("50px 0px");
  return (
    <div ref={ref} className="h-full w-full">
      {isNearViewport && (
        // The wrapper reserves the card's existing aspect ratio before this request starts.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={title} decoding="async"
          className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-100" />
      )}
    </div>
  );
}
