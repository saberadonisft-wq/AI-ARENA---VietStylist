import {
  GarmentType,
  Occasion,
  CatalogItem,
  Avatar,
  StarterOutfit,
  OutfitSnapshot,
  OutfitResponse,
  OutfitVersionResponse,
  CursorPage,
  CulturalCheckResponse,
  ColorAnalysisResponse,
  WeatherResponse,
  HeritageArticle,
  CreateStoryPayload,
  HeritageSource,
  Lookbook,
  SolutionForm,
  AuthUser,
  AuthResponse,
  AIMediaItem,
  RecommendationResponse,
} from "../types/api";

const configuredApiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
if (!configuredApiOrigin && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_ORIGIN must be set when building the production frontend.");
}
export const API_ORIGIN = (configuredApiOrigin || "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details: any;
  requestId?: string;
  retryAfter?: number;

  constructor(message: string, code: string, statusCode: number, details?: any, requestId?: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.retryAfter = retryAfter;
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const url = `${API_ORIGIN}${endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (options.body != null && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Lấy token đăng nhập từ client nếu có
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("viet_stylist_auth_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const timeoutMs = options.timeoutMs ?? 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });

  let response: Response;
  let data: any;
  try {
    response = await fetch(url, {
      ...options,
      // Publication and access can change between reads, even for catalog data.
      // Cache only after the API supports revalidation/invalidation explicitly.
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    try { data = text ? JSON.parse(text) : null; }
    catch {
      if (response.ok) throw new ApiError("Máy chủ trả dữ liệu không hợp lệ.", "INVALID_RESPONSE", response.status, undefined, response.headers.get("X-Request-ID") || undefined);
      data = {};
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      if (options.signal?.aborted) throw new ApiError("Yêu cầu đã được hủy.", "REQUEST_CANCELLED", 0);
      throw new ApiError(
        `Yêu cầu máy chủ vượt quá thời gian chờ (${timeoutMs}ms): ${endpoint}`,
        "TIMEOUT_ERROR",
        408
      );
    }
    throw new ApiError(
      "Không thể kết nối đến máy chủ. Hãy kiểm tra kết nối rồi thử lại.",
      "NETWORK_ERROR",
      503
    );
  } finally {
    clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abort);
  }

  if (!response.ok) {
    const errBody = data || {};
    const errInfo = errBody.error || {};
    const retry = response.headers.get("Retry-After");
    const retrySeconds = retry === null ? Number(errInfo.details?.retry_after) : /^\d+$/.test(retry) ? Number(retry) : Math.max(0, Math.ceil((Date.parse(retry) - Date.now()) / 1000));
    throw new ApiError(
      errInfo.message || `Lỗi yêu cầu máy chủ (mã ${response.status})`,
      errInfo.code || "UNKNOWN_ERROR",
      response.status,
      errInfo.details,
      errInfo.request_id || response.headers.get("X-Request-ID") || undefined,
      Number.isFinite(retrySeconds) ? retrySeconds : undefined
    );
  }

  return data;
}

// --- API Service Methods ---

export const api = {
  // Catalog
  getGarmentTypes: () => apiFetch<GarmentType[]>("/api/catalog/garment-types"),
  getOccasions: () => apiFetch<Occasion[]>("/api/catalog/occasions"),
  getCatalogItems: (params: Record<string, string | number | undefined> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") searchParams.append(k, String(v));
    });
    const qs = searchParams.toString();
    return apiFetch<CatalogItem[]>(`/api/catalog/items${qs ? `?${qs}` : ""}`);
  },
  getAllCatalogItems: async () => {
    const items: CatalogItem[] = [];
    const limit = 50;
    for (let offset = 0; ; offset += limit) {
      const batch = await apiFetch<CatalogItem[]>(`/api/catalog/items?limit=${limit}&offset=${offset}`);
      items.push(...batch);
      if (batch.length < limit) return items;
    }
  },
  getItemDetail: (id: string) => apiFetch<CatalogItem>(`/api/catalog/items/${id}`),
  previewCatalogColor: (id: string, color: string) => apiFetch<{ supported: boolean; image_url?: string; reason?: string; algorithm_version?: string; source_version?: string }>(`/api/catalog/items/${encodeURIComponent(id)}/color-preview?color=${encodeURIComponent(color)}`),
  getAvatars: () => apiFetch<Avatar[]>("/api/catalog/avatars"),
  getStarterOutfits: () => apiFetch<StarterOutfit[]>("/api/catalog/starter-outfits"),

  // Heritage & Stylist Blog Stories
  uploadStoryImage: async (file: File) => {
    const session = await apiFetch<{ media_id: string; upload_url: string; method: string; storage_type: string }>("/api/heritage/images/uploads", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, mime_type: file.type, size_bytes: file.size }),
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const body = session.storage_type === "local" ? new FormData() : file;
      if (body instanceof FormData) body.append("file", file);
      const response = await fetch(session.upload_url, {
        method: session.method, body, signal: controller.signal,
        headers: body instanceof FormData ? undefined : { "Content-Type": file.type },
      });
      if (!response.ok) throw new Error(`Không tải được ảnh “${file.name}”. Hãy thử lại.`);
      const media = await apiFetch<{ id: string; public_url: string; status: string }>(`/api/media/${encodeURIComponent(session.media_id)}/complete`, {
        method: "POST", body: "{}", timeoutMs: 30000,
      });
      if (media.status !== "ready" || !media.public_url) throw new Error("Ảnh chưa sẵn sàng để xuất bản.");
      return { media_id: media.id, url: media.public_url };
    } catch (error) {
      await api.deleteMedia(session.media_id).catch(() => {});
      if (controller.signal.aborted) throw new Error(`Tải ảnh “${file.name}” quá thời gian. Hãy thử lại.`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  },
  getHeritageArticles: (filters?: { era?: string; category?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.era && filters.era !== "all") params.append("era", filters.era);
    if (filters?.category && filters.category !== "all") params.append("category", filters.category);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString();
    return apiFetch<HeritageArticle[]>(`/api/heritage/articles${qs ? `?${qs}` : ""}`);
  },
  getHeritageArticle: (slugOrId: string) => apiFetch<HeritageArticle>(`/api/heritage/articles/${slugOrId}`),
  createHeritageArticle: (payload: CreateStoryPayload) =>
    apiFetch<any>("/api/heritage/articles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateHeritageArticle: (id: string, payload: CreateStoryPayload & { expected_version: number }) =>
    apiFetch<{ id: string; version: number; media_cleanup_pending?: number }>(`/api/heritage/articles/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteHeritageArticle: (slugOrId: string) =>
    apiFetch<any>(`/api/heritage/articles/${slugOrId}`, {
      method: "DELETE",
    }),
  getHeritageSources: () => apiFetch<HeritageSource[]>("/api/heritage/sources"),

  // Cultural Check (F10)
  checkCulturalCompliance: (payload: {
    garment_type_id?: string;
    occasion_id?: string;
    style_mode?: string;
    overlap_direction?: string;
    items: Array<{ slot: string; item_id: string; variant_id?: string; color_hex?: string }>;
  }) => apiFetch<CulturalCheckResponse>("/api/cultural-check", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  // Color Harmony (F07)
  analyzeColors: (payload: {
    colors: Array<{ slot: string; hex_color: string; color_name?: string; item_id?: string; variant_id?: string }>;
  }) => apiFetch<ColorAnalysisResponse>("/api/color-analysis", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  // Weather (F06)
  getWeather: (city: string = "hanoi", lat?: number, lon?: number) => {
    const params = new URLSearchParams({ city });
    if (lat !== undefined) params.append("lat", String(lat));
    if (lon !== undefined) params.append("lon", String(lon));
    return apiFetch<WeatherResponse>(`/api/weather?${params.toString()}`);
  },

  // Recommendations (F06, F11)
  getContextRecommendations: (payload: {
    occasion_id: string;
    city_key?: string;
    gender?: string;
    style_mode?: string;
    locked_items?: Array<{ slot: string; item_id: string; variant_id?: string }>;
  }) => apiFetch<RecommendationResponse>("/api/recommendations/context", {
    method: "POST",
    timeoutMs: 120000,
    body: JSON.stringify(payload),
  }),
  getAIRecommendations: (payload: {
    prompt: string;
    occasion_id?: string;
    gender?: string;
    style_mode?: string;
    locked_items?: Array<{ slot: string; item_id: string; variant_id?: string }>;
  }, signal?: AbortSignal) => apiFetch<RecommendationResponse>("/api/recommendations/ai", {
    method: "POST",
    timeoutMs: 120000,
    signal,
    body: JSON.stringify(payload),
  }),

  // Outfits & Versions
  listUserOutfits: (signal?: AbortSignal) => apiFetch<OutfitResponse[]>("/api/outfits", { signal }),
  listUserOutfitsPage: (cursor?: string | null, signal?: AbortSignal) => apiFetch<CursorPage<OutfitResponse>>(
    `/api/outfits/page?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }),
  countUserOutfits: (signal?: AbortSignal) => apiFetch<{ count: number }>("/api/outfits/count", { signal }),
  listOutfitVersions: (id: string, cursor?: string | null, signal?: AbortSignal) => apiFetch<CursorPage<OutfitVersionResponse>>(
    `/api/outfits/${encodeURIComponent(id)}/versions?limit=30${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { signal }),
  createOutfit: (payload: {
    title: string;
    occasion_id?: string;
    style_mode?: string;
    snapshot: OutfitSnapshot;
    preview_image_url?: string;
  }, idempotencyKey?: string) => apiFetch<OutfitResponse>("/api/outfits", {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: JSON.stringify(payload),
  }),
  getOutfit: (id: string) => apiFetch<OutfitResponse>(`/api/outfits/${id}`),
  getOutfitVersion: (id: string, signal?: AbortSignal) => apiFetch<OutfitVersionResponse>(`/api/outfits/versions/${encodeURIComponent(id)}`, { signal }),
  updateOutfit: (id: string, payload: {
    title?: string;
    occasion_id?: string;
    style_mode?: string;
    revision: number;
    snapshot: OutfitSnapshot;
    preview_image_url?: string;
  }) => apiFetch<OutfitResponse>(`/api/outfits/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
  deleteOutfit: (id: string) => apiFetch<{ message: string }>(`/api/outfits/${id}`, { method: "DELETE" }),
  listAiMedia: (limit = 30, offset = 0) => apiFetch<AIMediaItem[]>(`/api/media/ai?limit=${limit}&offset=${offset}`),
  getMediaAccess: (id: string) => apiFetch<{ access_url: string; expires_in: number }>(`/api/media/${encodeURIComponent(id)}/access`),
  deleteMedia: (id: string) => apiFetch<{ message: string; status: string }>(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" }),
  compareOutfits: (payload: { snapshot_a: OutfitSnapshot; snapshot_b: OutfitSnapshot }) =>
    apiFetch<any>("/api/outfits/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Lookbooks & Public Share (F09)
  listLookbooks: () => apiFetch<Lookbook[]>("/api/lookbooks"),
  createLookbook: (payload: {
    title: string;
    description?: string;
    cover_image_url?: string;
    visibility?: string;
    entries?: Array<{ outfit_version_id: string; sort_order: number; notes?: string }>;
  }) => apiFetch<Lookbook>("/api/lookbooks", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getLookbook: (id: string) => apiFetch<Lookbook>(`/api/lookbooks/${id}`),
  updateLookbook: (id: string, payload: any) => apiFetch<Lookbook>(`/api/lookbooks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }),
  deleteLookbook: (id: string) => apiFetch<any>(`/api/lookbooks/${id}`, { method: "DELETE" }),
  shareLookbook: (id: string, expires_in_days: number = 30) =>
    apiFetch<{ share_token: string; share_url: string; scope: string; expires_at?: string }>(
      `/api/lookbooks/${id}/share`,
      {
        method: "POST",
        body: JSON.stringify({ expires_in_days }),
      }
    ),
  getSharedLookbook: (token: string) => apiFetch<any>(`/api/shares/${token}`),

  // Solution Forms (F12)
  getSolutionForm: () => apiFetch<SolutionForm>("/api/solution-form"),
  updateSolutionForm: (payload: any) => apiFetch<SolutionForm>("/api/solution-form", {
    method: "PUT",
    body: JSON.stringify(payload),
  }),

  // AI Try-on (F05)
  createTryOnJob: (payload: {
    user_photo_url: string;
    outfit_version_id?: string;
    outfit_snapshot: OutfitSnapshot;
    idempotency_key?: string;
  }) => apiFetch<any>("/api/ai/try-on", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getTryOnJobStatus: (id: string) => apiFetch<any>(`/api/ai/jobs/${id}`),

  // Authentication & Phân quyền RBAC
  login: (payload: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload: { email: string; password: string; display_name: string; role?: string }) =>
    apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  googleAuth: (payload: { credential: string }) =>
    apiFetch<AuthResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMe: () => apiFetch<AuthUser>("/api/auth/me"),
};
