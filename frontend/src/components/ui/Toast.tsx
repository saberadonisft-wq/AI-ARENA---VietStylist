"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  actions?: React.ReactNode;
  dismissLabel?: string;
  type?: "success" | "info" | "warning" | "error";
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div
      role="region"
      aria-label="Thông báo"
      className="pointer-events-none fixed top-[max(4.5rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex max-h-[45dvh] w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 overflow-y-auto overscroll-contain p-1 lg:bottom-[max(1rem,env(safe-area-inset-bottom))] lg:top-auto lg:max-h-[55dvh]"
    >
      {toasts.map((toast) => {
        const type = toast.type || "info";

        let icon = <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-sky-700" />;

        if (type === "success") {
          icon = <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-700" />;
        } else if (type === "warning") {
          icon = <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-700" />;
        } else if (type === "error") {
          icon = <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-700" />;
        }

        return (
          <div
            key={toast.id}
            data-toast-id={toast.id}
            className="pointer-events-auto relative shrink-0 rounded-2xl border border-stone-200 bg-white p-4 text-stone-800 shadow-lg"
            role="status"
          >
            <div className="flex min-w-0 items-start gap-2.5 pr-9">
              {icon}
              <div className="min-w-0 space-y-1">
                {toast.title && <p className="break-words text-sm font-semibold text-stone-900">{toast.title}</p>}
                <p className="break-words text-sm leading-relaxed text-stone-600">{toast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              aria-label={toast.dismissLabel || "Đóng thông báo"}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            {toast.actions && <div className="mt-3 flex flex-wrap gap-2">{toast.actions}</div>}
          </div>
        );
      })}
    </div>, document.body
  );
};

export default ToastContainer;
