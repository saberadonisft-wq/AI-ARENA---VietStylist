import { apiFetch } from "./client";
import type { CatalogItem, OutfitResponse, Lookbook } from "@/lib/types/api";

export interface AdminUser {
  id: string; email: string; display_name: string; roles: string[];
  is_active: boolean; auth_provider: string; created_at: string;
}
export interface AdminOverview { users: number; items: number; outfits: number; lookbooks: number; rules: number }
export interface Page<T> { items: T[]; total: number }
export type ManagedOutfit = OutfitResponse & { owner_name?: string; owner_email?: string };
export type ManagedLookbook = Lookbook & { owner_name?: string; owner_email?: string };
export interface StylistSubmission {
  id: string;
  name: string;
  garment_type_id: string;
  garment_type_name?: string;
  slot: string;
  gender: string;
  description?: string;
  era?: string;
  status: "pending" | "approved" | "rejected";
  color_name?: string;
  hex_color?: string;
  material?: string;
  submitted_at?: string;
  reviewed_at?: string;
  review_note?: string;
  submitter_id?: string;
  submitter_name?: string;
  submitter_email?: string;
  media_id?: string;
}
export type AdminSection = "users" | "items" | "outfits" | "lookbooks" | "submissions";
export type AdminRow = AdminUser | CatalogItem | ManagedOutfit | ManagedLookbook | StylistSubmission;

export const adminApi = {
  overview: () => apiFetch<AdminOverview>("/api/admin/overview"),
  list: <T,>(section: AdminSection, search = "", offset = 0) =>
    apiFetch<Page<T>>(`/api/admin/${section}?${new URLSearchParams({ search, offset: String(offset), limit: "20" })}`),
  listSubmissions: (search = "", offset = 0) =>
    apiFetch<Page<StylistSubmission>>(`/api/admin/stylist-submissions?${new URLSearchParams({ search, offset: String(offset), limit: "20" })}`),
  submissionPreview: (id: string) =>
    apiFetch<{ access_url: string; expires_in: number }>(`/api/admin/stylist-submissions/${encodeURIComponent(id)}/preview`),
  reviewSubmission: (id: string, action: "approve" | "reject", note?: string) =>
    apiFetch<StylistSubmission>(`/api/admin/stylist-submissions/${encodeURIComponent(id)}/review`, { method: "POST", body: JSON.stringify({ action, note }) }),
  updateUser: (id: string, changes: { is_stylist?: boolean; is_active?: boolean }) =>
    apiFetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(changes) }),
  saveItem: (payload: Record<string, unknown>, editing: boolean) =>
    apiFetch(`/api/admin/items${editing ? `/${encodeURIComponent(String(payload.id))}` : ""}`, { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) }),
  remove: (section: Exclude<AdminSection, "users" | "submissions">, id: string) =>
    apiFetch(`/api/admin/${section}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateLookbook: (id: string, payload: Record<string, unknown>) =>
    apiFetch(`/api/admin/lookbooks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }),
};
