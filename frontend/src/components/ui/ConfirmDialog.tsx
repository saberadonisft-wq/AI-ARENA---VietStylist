"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

export type ConfirmDialogOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    if (resolveRef.current) resolveRef.current(false);
    resolveRef.current = resolve;
    setOptions(next);
  }), []);

  const close = useCallback((accepted: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOptions(null);
    resolve?.(accepted);
  }, []);
  const cancel = useCallback(() => close(false), [close]);
  const accept = useCallback(() => close(true), [close]);

  return {
    confirm,
    dialog: <ConfirmDialog options={options} onClose={cancel} onConfirm={accept} />,
  };
}

function ConfirmDialog({
  options,
  onClose,
  onConfirm,
}: {
  options: ConfirmDialogOptions | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!options) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [options, onClose]);

  if (!options) return null;
  const destructive = options.tone === "danger";

  return <div
    className="fixed inset-0 z-[160] flex items-center justify-center overflow-y-auto bg-stone-950/60 p-4 backdrop-blur-sm"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
  >
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="my-auto w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${destructive ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
          <AlertTriangle size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="font-serif text-lg font-bold text-stone-900">{options.title}</h2>
          <p id={descriptionId} className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">{options.description}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-heritage-red"
        >
          {options.cancelLabel || "Hủy"}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-heritage-red ${destructive ? "bg-red-700 hover:bg-red-800" : "bg-heritage-red hover:bg-heritage-red-dark"}`}
        >
          {options.confirmLabel || "Xác nhận"}
        </button>
      </div>
    </section>
  </div>;
}
