"use client";

import { useEffect, useRef, useState } from "react";

export default function BackgroundFadeControl({ value, onPreview, onCommit }: {
  value: number; onPreview: (value: number | null) => void; onCommit: (value: number) => void;
}) {
  const [preview, setPreview] = useState(value);
  const pending = useRef<number | null>(null);
  const gesturing = useRef(false);
  const callbacks = useRef({ onPreview, onCommit });
  callbacks.current = { onPreview, onCommit };
  const finish = () => {
    const next = pending.current;
    pending.current = null;
    gesturing.current = false;
    if (next !== null) callbacks.current.onCommit(next);
    callbacks.current.onPreview(null);
  };
  useEffect(() => { if (pending.current === null) setPreview(value); }, [value]);
  useEffect(() => {
    const flush = () => {
      const next = pending.current;
      pending.current = null;
      if (next !== null) callbacks.current.onCommit(next);
      callbacks.current.onPreview(null);
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, []);
  return <label className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700">
    <span>Độ mờ ảnh nền</span>
    <input type="range" min={0} max={100} step={1} value={preview}
      onPointerDown={event => { gesturing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
      onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) gesturing.current = true; }}
      onChange={event => {
        const next = Number(event.target.value);
        pending.current = next;
        setPreview(next);
        callbacks.current.onPreview(next);
        if (!gesturing.current) finish();
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish}
      onKeyUp={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) finish(); }}
      aria-valuetext={`${preview}%`} className="h-11 min-w-24 flex-1 accent-heritage-red" />
    <span className="w-10 text-right tabular-nums" aria-hidden="true">{preview}%</span>
  </label>;
}
