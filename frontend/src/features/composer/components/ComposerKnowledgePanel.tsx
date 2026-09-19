"use client";

import { useEffect, useState } from "react";
import { v3Api, type OutfitValidationResult } from "@/lib/api/v3Client";
import type { ComposerBundle, EducationProjection, OutfitSpecV2 } from "@/lib/types/v3";
import { mappingIssues } from "../adapters/snapshotAdapter";
import { CulturalKnowledgeBadge } from "./CulturalKnowledgeBadge";

export function ComposerKnowledgePanel({ spec }: { spec: OutfitSpecV2 }) {
  const [selectedId, setSelectedId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const entityIds = Array.from(new Set(spec.selections.map(s => s.canonical_variant_id || s.canonical_entity_id)));
  const entityId = entityIds.includes(selectedId) ? selectedId : entityIds[0];
  const payload = JSON.stringify(spec);
  const key = JSON.stringify([payload, entityId, attempt]);
  const [loaded, setLoaded] = useState<{ key: string; bundle?: ComposerBundle; education?: EducationProjection; validation?: OutfitValidationResult; error?: string }>();
  const issues = mappingIssues(spec);
  useEffect(() => {
    let active = true;
    setLoaded(undefined);
    if (!entityId || issues.length) return;
    const current: OutfitSpecV2 = JSON.parse(payload);
    const timer = setTimeout(() => {
      Promise.all([
        v3Api.getComposerBundle(entityId, current.context, current.dataset_version),
        v3Api.getEducationProjection(entityId, current.context, current.dataset_version),
        v3Api.validateOutfit(current),
      ]).then(([bundle, education, validation]) => {
        if (active) setLoaded({ key, bundle, education, validation });
      }).catch(() => {
        if (active) setLoaded({ key, error: "Không thể kiểm tra lúc này. Hãy thử lại sau khi kết nối được khôi phục." });
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [key, payload, entityId, issues.length]);
  const result = loaded?.key === key ? loaded : undefined;
  if (issues.length) return <p role="status">Chưa kiểm tra: {issues.length} mục trang phục hoặc bối cảnh chưa có ánh xạ đầy đủ. Bộ phối gốc vẫn được giữ nguyên.</p>;
  if (!entityId) return <p role="status">Chọn trang phục để tra cứu và kiểm tra văn hóa.</p>;
  return <section aria-label="Tri thức văn hóa" className="space-y-3 text-sm">
    <label className="block">Trang phục đang tra cứu
      <select className="w-full border rounded p-2" value={entityId} onChange={event => setSelectedId(event.target.value)}>
        {entityIds.map(id => <option key={id} value={id}>{result?.education?.entity_id === id ? result.education.title || id : id}</option>)}
      </select>
    </label>
    {!result ? <p role="status">Đang kiểm tra…</p> : result.error ? <><p role="status">Chưa kiểm tra. {result.error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Thử lại</button></> : <>
      <CulturalKnowledgeBadge bundle={result.bundle} education={result.education} validationStatus={result.validation?.status} />
      <p>Đã kiểm tra {result.validation?.evaluated_rule_count || 0} quy tắc.</p>
      {!!(result.validation?.unchecked_entities.length || result.validation?.unevaluated_rule_ids.length || result.validation?.missing_entities.length) && <p>Một phần dữ liệu chưa đủ để kiểm tra.</p>}
      {result.validation?.violations.map(v => <p key={v.rule_id}>{v.explanation}{v.suggested_fix ? ` — ${v.suggested_fix}` : ""}</p>)}
      <h4 className="font-semibold">Nguồn theo trang phục</h4>
      {!result.education?.evidence.length && <p>Chưa có nguồn được công bố cho dữ liệu này.</p>}
      {result.education?.evidence.map(citation => <div key={citation.assertion_id} className="border-t pt-2">
        {citation.sources.map((source, index) => <p key={`${source.source_id}-${index}`}>
          {source.title}{source.creator ? ` — ${source.creator}` : ""}; {source.locator}
          {source.url && /^https?:\/\//i.test(source.url) && <> · <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">Xem nguồn</a></>}
        </p>)}
      </div>)}
    </>}
  </section>;
}
