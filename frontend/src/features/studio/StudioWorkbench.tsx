"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { BookOpen, Shirt, LayoutGrid, Palette, Image as ImageIcon, Sparkles, X, Menu, UserRound, SlidersHorizontal } from "lucide-react";
import Logo from "@/components/Logo";

export type StudioPanelId = "catalog" | "starters" | "colors" | "context" | "culture" | "assistant";
const tools = [
  { id: "catalog", label: "Trang phục", accessible: "Chọn trang phục", icon: Shirt },
  { id: "starters", label: "Mẫu phối", accessible: "Mẫu phối", icon: LayoutGrid },
  { id: "colors", label: "Màu sắc", accessible: "Màu sắc", icon: Palette },
  { id: "context", label: "Bối cảnh", accessible: "Bối cảnh", icon: ImageIcon },
  { id: "culture", label: "Văn hóa", accessible: "Văn hóa", icon: BookOpen },
  { id: "assistant", label: "Trợ lý AI", accessible: "Trợ lý AI", icon: Sparkles },
] as const;

export default function StudioWorkbench({ header, notices, children, panel, onPanelChange, inspectorOpen, onInspectorChange, panels, properties, controlsRef, loggedIn, onLogin }: {
  header: ReactNode;
  notices: ReactNode;
  children: ReactNode;
  panel: StudioPanelId | null;
  onPanelChange: (panel: StudioPanelId | null) => void;
  inspectorOpen: boolean;
  onInspectorChange: (open: boolean) => void;
  panels: Record<StudioPanelId, ReactNode>;
  properties: ReactNode;
  controlsRef: (element: HTMLDivElement | null) => void;
  loggedIn: boolean;
  onLogin: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => {
    const id = panel;
    onPanelChange(null);
    root.current?.querySelector<HTMLButtonElement>(`[data-panel-trigger="${id}"]`)?.focus({ preventScroll: true });
  }, [panel, onPanelChange]);
  const closeInspector = useCallback(() => {
    onInspectorChange(false);
    root.current?.querySelector<HTMLButtonElement>("[data-inspector-trigger]")?.focus({ preventScroll: true });
  }, [onInspectorChange]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"]')) return;
      const menu = root.current?.querySelector<HTMLDetailsElement>("details[open]");
      if (menu) {
        menu.open = false;
        menu.querySelector<HTMLElement>("summary")?.focus();
        event.preventDefault();
        return;
      }
      if (inspectorOpen) closeInspector();
      else if (panel) closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectorOpen, panel, closeInspector, closePanel]);
  useEffect(() => {
    const narrow = matchMedia("(max-width: 1399px)");
    const resize = () => { if (narrow.matches && panel && inspectorOpen) onInspectorChange(false); };
    narrow.addEventListener("change", resize);
    resize();
    return () => narrow.removeEventListener("change", resize);
  }, [panel, inspectorOpen, onInspectorChange]);
  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      root.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => {
        if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      });
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, []);
  const togglePanel = (id: StudioPanelId) => {
    onPanelChange(panel === id ? null : id);
    if (matchMedia("(max-width: 1399px)").matches) onInspectorChange(false);
  };
  const openInspector = () => {
    onInspectorChange(!inspectorOpen);
    if (matchMedia("(max-width: 1399px)").matches) onPanelChange(null);
  };
  return <div ref={root} className="studio-workbench" data-panel-open={!!panel} data-inspector-open={inspectorOpen}>
    <nav className="studio-tool-rail" aria-label="Công cụ Studio">
      <Link href="/" className="studio-home" aria-label="VietStylist · Trang chủ"><Logo size="sm" showText={false} /></Link>
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
            if (matchMedia("(max-width: 1399px)").matches) onInspectorChange(false);
            root.current?.querySelector<HTMLButtonElement>(`[data-panel-trigger="${tools[next].id}"]`)?.focus();
          }}
          onClick={() => togglePanel(id)}><Icon size={21} aria-hidden="true" /><span>{label}</span></button>)}
      </div>
      <div className="studio-rail-links">
        <details className="studio-site-menu"><summary aria-label="Điều hướng website" title="Điều hướng website"><Menu size={21} /></summary>
          <nav aria-label="Khám phá VietStylist"><Link href="/">Trang chủ</Link><Link href="/thu-vien">Thư viện cổ phục</Link><Link href="/lookbook">Lookbook</Link><Link href="/chuyen-co-phuc">Chuyện cổ phục</Link><Link href="/tai-khoan">Tủ đồ của tôi</Link>
            {!loggedIn && <button type="button" onClick={() => { root.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach(menu => { menu.open = false; }); onLogin(); }}>Đăng nhập</button>}
          </nav>
        </details>
        {loggedIn ? <Link href="/tai-khoan" aria-label="Tài khoản" title="Tài khoản"><UserRound size={21} /></Link>
          : <button type="button" onClick={onLogin} aria-label="Đăng nhập" title="Đăng nhập"><UserRound size={21} /></button>}
      </div>
    </nav>
    <header className="studio-topbar">{header}</header>
    <div className="studio-workspace-alerts" role="region" aria-label="Thông tin bộ phối">{notices}</div>
    <div className="studio-editor">
      {(panel || inspectorOpen) && <button type="button" tabIndex={-1} className="studio-sheet-backdrop" aria-label="Đóng bảng công cụ"
        onClick={() => { if (inspectorOpen) closeInspector(); else closePanel(); }} />}
      {tools.map(({ id, label }) => <section key={id} id={`studio-panel-${id}`} role="tabpanel" aria-label={`Bảng ${label}`}
        hidden={panel !== id} className="studio-panel studio-tool-panel">
        <div className="studio-panel-heading"><h2>{label}</h2><button type="button" aria-label={`Đóng bảng ${label}`} onClick={closePanel}><X size={20} /></button></div>
        <div className="studio-panel-body">{panels[id]}</div>
      </section>)}
      <section id="studio-board" className="studio-center" aria-label="Bảng phối Studio">
        <div className="studio-canvas-heading"><span>Bảng phối 2D</span><button type="button" data-inspector-trigger
          aria-controls="studio-item-properties" aria-expanded={inspectorOpen} onClick={openInspector}><SlidersHorizontal size={16} />Món đang chọn</button></div>
        {children}
      </section>
      <section id="studio-item-properties" aria-label="Món đang chọn" hidden={!inspectorOpen} className="studio-panel studio-item-panel">
        <div className="studio-panel-heading"><h2>Món đang chọn</h2><button type="button" aria-label="Đóng thuộc tính món" onClick={closeInspector}><X size={20} /></button></div>
        <div className="studio-panel-body"><div ref={controlsRef} />{properties}</div>
      </section>
    </div>
  </div>;
}
