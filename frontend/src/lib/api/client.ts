import {
  GarmentType,
  Occasion,
  CatalogItem,
  Avatar,
  StarterOutfit,
  OutfitSnapshot,
  OutfitResponse,
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
} from "../types/api";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details: any;

  constructor(message: string, code: string, statusCode: number, details?: any) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// In-memory cache cho dữ liệu tĩnh catalog & heritage (TTL 60s)
const requestCache = new Map<string, { data: any; expiry: number }>();

export async function apiFetch<T>(endpoint: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const url = `${API_ORIGIN}${endpoint.startsWith("/api") ? endpoint : `/api${endpoint}`}`;
  const method = (options.method || "GET").toUpperCase();
  const isCacheable = method === "GET" && (endpoint.includes("/catalog") || endpoint.includes("/heritage"));

  if (isCacheable) {
    const cached = requestCache.get(url);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
  }
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Lấy token đăng nhập từ client nếu có
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("viet_stylist_auth_token");
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const timeoutMs = options.timeoutMs || 3000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    if (options.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new ApiError(
        `Yêu cầu máy chủ vượt quá thời gian chờ (${timeoutMs}ms): ${endpoint}`,
        "TIMEOUT_ERROR",
        408
      );
    }
    throw new ApiError(
      err.message || "Không thể kết nối đến máy chủ backend",
      "NETWORK_ERROR",
      503
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errBody: any = {};
    try {
      errBody = await response.json();
    } catch {
      // ignore json parse error
    }
    const errInfo = errBody.error || {};
    throw new ApiError(
      errInfo.message || `Lỗi yêu cầu máy chủ (mã ${response.status})`,
      errInfo.code || "UNKNOWN_ERROR",
      response.status,
      errInfo.details
    );
  }

  const data = await response.json();
  if (isCacheable) {
    requestCache.set(url, { data, expiry: Date.now() + 60000 });
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
  getAvatars: () => apiFetch<Avatar[]>("/api/catalog/avatars"),
  getStarterOutfits: () => apiFetch<StarterOutfit[]>("/api/catalog/starter-outfits"),

  // Heritage & Stylist Blog Stories
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
  }) => apiFetch<any>("/api/recommendations/context", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getAIRecommendations: (payload: {
    prompt: string;
    occasion_id?: string;
    gender?: string;
    style_mode?: string;
    locked_items?: Array<{ slot: string; item_id: string; variant_id?: string }>;
  }) => apiFetch<any>("/api/recommendations/ai", {
    method: "POST",
    body: JSON.stringify(payload),
  }),

  // Outfits & Versions
  listUserOutfits: () => apiFetch<OutfitResponse[]>("/api/outfits"),
  createOutfit: (payload: {
    title: string;
    occasion_id?: string;
    style_mode?: string;
    snapshot: OutfitSnapshot;
    preview_image_url?: string;
  }) => apiFetch<OutfitResponse>("/api/outfits", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  getOutfit: (id: string) => apiFetch<OutfitResponse>(`/api/outfits/${id}`),
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
