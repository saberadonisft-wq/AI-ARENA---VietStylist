"use client";

import { useEffect, useRef, useState } from "react";

type ObserverPool = { observer: IntersectionObserver; callbacks: Map<Element, () => void> };
const observers = new Map<string, ObserverPool>();

function observe(element: Element, onVisible: () => void, rootMargin: string) {
  if (typeof IntersectionObserver === "undefined") {
    onVisible();
    return () => {};
  }

  let pool = observers.get(rootMargin);
  if (!pool) {
    const callbacks = new Map<Element, () => void>();
    const observer = new IntersectionObserver((entries, activeObserver) => {
      // Ignore notifications queued by a disconnected observer (including Strict Mode cleanup).
      if (activeObserver !== observers.get(rootMargin)?.observer) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = callbacks.get(entry.target);
        callbacks.delete(entry.target);
        activeObserver.unobserve(entry.target);
        callback?.();
      }
      if (callbacks.size === 0) {
        activeObserver.disconnect();
        observers.delete(rootMargin);
      }
    }, { rootMargin, threshold: 0 });
    pool = { observer, callbacks };
    observers.set(rootMargin, pool);
  }

  const { observer: activeObserver, callbacks } = pool;
  callbacks.set(element, onVisible);
  activeObserver.observe(element);
  return () => {
    callbacks.delete(element);
    activeObserver.unobserve(element);
    if (callbacks.size === 0 && observers.get(rootMargin)?.observer === activeObserver) {
      activeObserver.disconnect();
      observers.delete(rootMargin);
    }
  };
}

/** Keep content mounted after its first visit to the viewport's preload margin. */
export function useNearViewport<T extends Element>(rootMargin = "250px 0px") {
  const ref = useRef<T>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport || !ref.current) return;
    return observe(ref.current, () => setIsNearViewport(true), rootMargin);
  }, [isNearViewport, rootMargin]);

  return { ref, isNearViewport };
}
