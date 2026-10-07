"use client";

import { lockBodyScroll } from "@/lib/ui/bodyScrollLock";
import { useEffect, useRef, type ReactNode } from "react";

/** Native top-layer dialogs keep the surrounding workspace inert. */
export default function Modal({ isOpen, onClose, label, children, closeDisabled = false }: {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  closeDisabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    const releaseScrollLock = lockBodyScroll();
    return () => {
      dialog?.close();
      releaseScrollLock();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return <dialog ref={dialogRef} aria-label={label} aria-modal="true" data-workspace-modal
    onCancel={event => { event.preventDefault(); if (!closeDisabled) onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape") event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
      )).filter(element => element.getClientRects().length > 0);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    className="fixed inset-0 m-auto h-dvh max-h-none w-full max-w-none bg-transparent p-3 text-stone-900 backdrop:bg-stone-900/60 backdrop:backdrop-blur-sm sm:p-4">
    <div className="flex h-full min-h-0 items-center justify-center">{children}</div>
  </dialog>;
}
