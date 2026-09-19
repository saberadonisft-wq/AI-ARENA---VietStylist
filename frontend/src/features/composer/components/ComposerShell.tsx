"use client";

import type { ReactNode } from "react";
import type { OutfitSpecV2 } from "@/lib/types/v3";
import { ComposerKnowledgePanel } from "./ComposerKnowledgePanel";

interface ComposerShellProps {
  closet: ReactNode;
  preview: ReactNode;
  activeGarmentEntityId?: string;
  outfitSpec?: OutfitSpecV2;
  onGenerateAI?: () => void;
}

export function ComposerShell({ closet, preview, outfitSpec, onGenerateAI }: ComposerShellProps) {
  return <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
    <aside className="lg:col-span-3">{closet}</aside>
    <main className="lg:col-span-6">{preview}</main>
    <aside className="lg:col-span-3 space-y-4">
      {outfitSpec ? <ComposerKnowledgePanel spec={outfitSpec} /> : <p>Chưa có bộ phối để kiểm tra.</p>}
      {onGenerateAI && <button type="button" onClick={onGenerateAI}>Thử đồ AI</button>}
    </aside>
  </div>;
}
