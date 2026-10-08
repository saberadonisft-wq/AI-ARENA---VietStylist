"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { BookOpen, Shirt, LayoutGrid, Palette, Image as ImageIcon, Sparkles, X } from "lucide-react";

export type StudioPanelId = "catalog" | "starters" | "colors" | "context" | "culture" | "assistant";
const tools = [
  { id: "catalog", label: "Trang phục", accessible: "Chọn trang phục", icon: Shirt },
  { id: "starters", label: "Mẫu phối", accessible: "Mẫu phối", icon: LayoutGrid },
  { id: "colors", label: "Màu sắc", accessible: "Màu sắc", icon: Palette },
  { id: "context", label: "Bối cảnh", accessible: "Bối cảnh", icon: ImageIcon },
  { id: "culture", label: "Văn hóa", accessible: "Văn hóa", icon: BookOpen },
  { id: "assistant", label: "Trợ lý AI", accessible: "Trợ lý AI", icon: Sparkles },
] as const;

export default function StudioWorkbench({ canvasTools, notices, children, panel, onPanelChange, panels }: {
  canvasTools: ReactNode;
  notices: ReactNode;
  children: ReactNode;
  panel: StudioPanelId | null;
  onPanelChange: (panel: StudioPanelId | null) => void;
  panels: Record<StudioPanelId, ReactNode>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => {
    const id = panel;
    onPanelChange(null);
    root.current?.querySelector<HTMLButtonElement>(`[data-panel-trigger="${id}"]`)?.focus({ preventScroll: true });
  }, [panel, onPanelChange]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      const menu = root.current?.querySelector<HTMLDetailsElement>(".studio-document-menu[open]");
      if (menu) {
        menu.open = false;
        menu.querySelector<HTMLElement>("summary")?.focus();
        event.preventDefault();
        return;
      }
      if (panel) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, closePanel]);
  useEffect(() => {
    const mobile = matchMedia("(max-width: 1023px)");
    const resize = () => {
      if (mobile.matches) onPanelChange(null);
    };
    mobile.addEventListener("change", resize);
    return () => mobile.removeEventListener("change", resize);
  }, [onPanelChange]);
  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      root.current?.querySelectorAll<HTMLDetailsElement>(".studio-document-menu[open]").forEach(menu => {
        if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      });
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);
  const togglePanel = (id: StudioPanelId) => {
    onPanelChange(panel === id ? null : id);
  };
  return <div ref={root} className="studio-workbench" data-panel-open={!!panel}>
    <nav className="studio-tool-rail" aria-label="Công cụ Studio">
      <div role="tablist" aria-label="Bảng công cụ Studio" className="studio-tool-tabs">
        {tools.map(({ id, label, accessible, icon: Icon }, index) => <button key={id} type="button" role="tab" aria-label={accessible}
          aria-selected={panel === id} aria-controls={`studio-panel-${id}`} data-panel-trigger={id} title={label}
          tabIndex={panel === id || (!panel && index === 0) ? 0 : -1}
          onKeyDown={event => {
            const next = event.key === "Home" ? 0 : event.key === "End" ? tools.length - 1
              : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % tools.length
              : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + tools.length - 1) % tools.length : -1;
            if (next < 0) return;
            event.preventDefault();
            onPanelChange(tools[next].id);
            root.current?.querySelector<HTMLButtonElement>(`[data-panel-trigger="${tools[next].id}"]`)?.focus();
          }}
          onClick={() => togglePanel(id)}><span className="studio-tool-icon"><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span><span>{label}</span></button>)}
      </div>
    </nav>
    <div className="studio-workspace-alerts" role="region" aria-label="Thông tin bộ phối">{notices}</div>
    <div className="studio-editor">
      {panel && <button type="button" tabIndex={-1} className="studio-sheet-backdrop" aria-label="Đóng bảng công cụ"
        onClick={closePanel} />}
      {tools.map(({ id, label }) => <section key={id} id={`studio-panel-${id}`} role="tabpanel" aria-label={`Bảng ${label}`}
        hidden={panel !== id} className="studio-panel studio-tool-panel">
        <div className="studio-panel-heading"><div className="studio-panel-title"><h2>{label}</h2></div><button type="button" aria-label={`Đóng bảng ${label}`} onClick={closePanel}><X size={20} /></button></div>
        <div className="studio-panel-body">{panels[id]}</div>
      </section>)}
      <section id="studio-board" className="studio-center" aria-label="Bảng phối Studio">
        <div className="studio-canvas-heading">{canvasTools}</div>
        {children}
      </section>
    </div>
  </div>;
}
