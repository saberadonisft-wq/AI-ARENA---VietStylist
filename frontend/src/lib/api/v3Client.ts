import { apiFetch } from "./client";
import {
  Entity,
  EducationProjection,
  ComposerBundle,
  GenerationProfile,
  OutfitSpecV2,
  ContextQualifier,
  LegacyMappingBundle,
} from "../types/v3";

export interface OutfitValidationResult {
  status: 'clear' | 'warning' | 'error' | 'not_evaluated';
  missing_entities: string[];
  unchecked_entities: string[];
  unevaluated_rule_ids: string[];
  evaluated_rule_count: number;
  violations: Array<{ rule_id: string; severity: string; explanation: string; suggested_fix?: string }>;
  outfit: Record<string, any>;
}

export interface SynthesisResult {
  status: string;
  model_id: string;
  result_media_id: string | null;
  prompt_used: string;
  post_validation: Record<string, any>;
  metadata: Record<string, any>;
}

export interface GenerationRequest {
  outfit: OutfitSpecV2;
  legacy_item_ids: string[];
  outfit_image_id: string;
  user_image_id: string | null;
  model_id: string;
  options: Record<string, unknown>;
  idempotency_key: string;
}

export interface GenerationJob {
  job_id: string;
  status: "running" | "completed" | "failed";
  result: SynthesisResult | null;
  error: { code: string; message: string } | null;
}

export function projectionQuery(context?: Partial<ContextQualifier>, datasetVersion?: string): string {
  const params = new URLSearchParams();
  if (datasetVersion) params.set("dataset_version", datasetVersion);
  const keys: Array<keyof ContextQualifier> = ["period_ids", "region_ids", "place_ids", "community_ids", "occasion_ids", "social_context_ids"];
  for (const key of keys) for (const id of context?.[key] || []) params.append(key, id);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const v3Api = {
  listDatasets: () => apiFetch<Array<{ dataset_version: string; ruleset_version: string; label: string }>>("/api/v3/datasets"),
  getLegacyMappings: (datasetVersion = "dev") => apiFetch<LegacyMappingBundle>(`/api/v3/legacy-mappings?dataset_version=${encodeURIComponent(datasetVersion)}`),
  /**
   * Liệt kê canonical cultural entities trong Knowledge Graph
   */
  async listEntities(params?: { entity_type?: string; status?: string; limit?: number; offset?: number; dataset_version?: string }): Promise<Entity[]> {
    const query = new URLSearchParams();
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.dataset_version) query.set("dataset_version", params.dataset_version);
    const qs = query.toString();
    return apiFetch<Entity[]>(`/api/v3/entities${qs ? `?${qs}` : ""}`);
  },

  /**
   * Lấy Education Projection cho trang chi tiết văn hóa / điển tích
   */
  async getEducationProjection(entityId: string, context?: Partial<ContextQualifier>, datasetVersion?: string): Promise<EducationProjection> {
    return apiFetch<EducationProjection>(`/api/v3/entities/${encodeURIComponent(entityId)}/education${projectionQuery(context, datasetVersion)}`);
  },

  /**
   * Lấy Composer Bundle cho Studio phối đồ
   */
  async getComposerBundle(entityId: string, context?: Partial<ContextQualifier>, datasetVersion?: string): Promise<ComposerBundle> {
    return apiFetch<ComposerBundle>(`/api/v3/composer/bundles/${encodeURIComponent(entityId)}${projectionQuery(context, datasetVersion)}`);
  },

  /**
   * Lấy Generation Profile cho AI grounding
   */
  async getGenerationProfile(entityId: string, context?: Partial<ContextQualifier>): Promise<GenerationProfile> {
    return apiFetch<GenerationProfile>(`/api/v3/generation/profiles/${encodeURIComponent(entityId)}${projectionQuery(context)}`);
  },

  /**
   * Validate OutfitSpecV2 dựa trên Cultural Knowledge Graph
   */
  async validateOutfit(spec: OutfitSpecV2): Promise<OutfitValidationResult> {
    return apiFetch<OutfitValidationResult>("/api/v3/outfits/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    });
  },

  async uploadPrivateImage(file: File, signal?: AbortSignal): Promise<string> {
    const session = await apiFetch<{
      media_id: string;
      upload_url: string;
      method: string;
      storage_type: "local" | "r2";
    }>("/api/media/uploads", {
      signal,
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        media_type: "image",
        mime_type: file.type,
        size_bytes: file.size,
        visibility: "private",
      }),
    });

    const body = session.storage_type === "local" ? new FormData() : file;
    const headers = new Headers();
    if (body instanceof FormData) body.append("file", file);
    else headers.set("Content-Type", file.type);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, 60000);
    try {
      const uploaded = await fetch(session.upload_url, {
        method: session.method, headers, body, signal: controller.signal,
      });
      if (!uploaded.ok) throw new Error("Không thể tải ảnh lên kho media.");
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) throw new Error("Tải ảnh vượt quá 60 giây. Hãy kiểm tra kết nối rồi thử lại.");
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }

    await apiFetch(`/api/media/${encodeURIComponent(session.media_id)}/complete`, {
      method: "POST",
      body: JSON.stringify({}),
      timeoutMs: 30000,
      signal,
    });
    return session.media_id;
  },

  async getGenerationStatus(): Promise<{ enabled: boolean }> {
    return apiFetch<{ enabled: boolean }>("/api/v3/generation/status");
  },

  startGeneration: (request: GenerationRequest, signal?: AbortSignal) => apiFetch<GenerationJob>("/api/v3/generation/jobs", {
    method: "POST", body: JSON.stringify(request), signal,
  }),
  getGenerationJob: (jobId: string, signal?: AbortSignal) => apiFetch<GenerationJob>(`/api/v3/generation/jobs/${encodeURIComponent(jobId)}`, { signal }),

  async synthesize(outfit: OutfitSpecV2, legacyItemIds: string[], outfitImageId: string, userImageId: string | null, modelId: string): Promise<SynthesisResult> {
    return apiFetch<SynthesisResult>("/api/v3/generation/synthesize", {
      method: "POST",
      timeoutMs: 70000,
      body: JSON.stringify({
        outfit,
        legacy_item_ids: legacyItemIds,
        outfit_image_id: outfitImageId,
        user_image_id: userImageId,
        model_id: modelId,
        options: {},
        idempotency_key: `studio_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      }),
    });
  },

  async getMediaAccessUrl(mediaId: string): Promise<string> {
    const response = await apiFetch<{ access_url: string }>(
      `/api/media/${encodeURIComponent(mediaId)}/access`,
    );
    return response.access_url;
  },
};
