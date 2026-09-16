"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export interface ToastItem {
  id: string;
  message: string;
  type?: "success" | "info" | "warning" | "error";
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-[calc(100vw-2rem)] sm:w-auto"
    >
      {toasts.map((toast) => {
        const type = toast.type || "info";

        let bgStyle = "bg-stone-900 text-white border-stone-800";
        let icon = <Info className="w-4 h-4 text-blue-400 shrink-0" />;

        if (type === "success") {
          bgStyle = "bg-stone-900 text-white border-emerald-500/40";
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
        } else if (type === "warning") {
          bgStyle = "bg-stone-900 text-white border-amber-500/40";
          icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
        } else if (type === "error") {
          bgStyle = "bg-stone-900 text-white border-red-500/40";
          icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between space-x-3 px-3.5 py-2.5 rounded-xl border shadow-xl backdrop-blur-md transition-all transform animate-in fade-in slide-in-from-top-2 duration-200 ${bgStyle}`}
            role="status"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              {icon}
              <p className="text-xs font-medium leading-snug break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-stone-400 hover:text-white p-1 rounded-md transition-colors shrink-0"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;

