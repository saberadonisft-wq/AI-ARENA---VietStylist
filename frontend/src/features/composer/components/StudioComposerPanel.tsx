"use client";

import { useEffect, useState } from "react";
import type { OutfitSnapshot } from "@/lib/types/api";
import type { LegacyMappingBundle } from "@/lib/types/v3";
import { v3Api } from "@/lib/api/v3Client";
import { snapshotV1ToSpecV2 } from "../adapters/snapshotAdapter";
import { ComposerKnowledgePanel } from "./ComposerKnowledgePanel";
import { CulturalSettingsEditor, emptyContext, type CulturalSettings } from "./CulturalSettingsEditor";

export default function StudioComposerPanel({ snapshot, onSettingsChange }: { snapshot: OutfitSnapshot; onSettingsChange: (settings: CulturalSettings | null) => void }) {
  const [mapping, setMapping] = useState<LegacyMappingBundle>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const version = snapshot.culturalSettings?.dataset_version || "dev";
  useEffect(() => {
    let active = true;
    setFailed(false);
    setMapping(undefined);
    v3Api.getLegacyMappings(version).then(value => { if (active) setMapping(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt, version]);
  const currentMapping = mapping?.dataset_version === version ? mapping : undefined;
  return <div data-testid="studio-composer" className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
    <h3 className="font-semibold">Tra cứu văn hóa</h3>
    {snapshot.culturalSettings ? <>
      <CulturalSettingsEditor settings={snapshot.culturalSettings} onChange={onSettingsChange} />
      <button type="button" className="underline text-sm" onClick={() => onSettingsChange(null)}>Dùng lại dịp của bộ phối và dữ liệu hiện hành</button>
    </> : currentMapping && <button type="button" className="underline text-sm" onClick={() => {
      const context = emptyContext();
      const occasion = currentMapping.mappings.find(m => m.legacy_table === "occasions" && m.legacy_id === snapshot.occasionId);
      if (occasion) context.occasion_ids = [occasion.canonical_entity_id];
      onSettingsChange({ dataset_version: version, ruleset_version: currentMapping.ruleset_version, context });
    }}>Chọn bối cảnh và bộ dữ liệu riêng</button>}
    {failed ? <><p role="status">Chưa tải được dữ liệu đối chiếu.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></>
      : currentMapping ? <ComposerKnowledgePanel spec={snapshotV1ToSpecV2(snapshot, currentMapping)} /> : <p role="status">Đang tải dữ liệu đối chiếu…</p>}
  </div>;
}
