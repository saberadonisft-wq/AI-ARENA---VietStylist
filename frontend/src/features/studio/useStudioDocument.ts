"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, apiFetch, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import type { OutfitSnapshot, OutfitResponse } from "@/lib/types/api";
import { INITIAL_DOCUMENT, parseDraft, sameDocument, studioReducer } from "./state";
import type { StudioAction, StudioHistory } from "./state";
import { saveOutfitDocument } from "./persistence";
import type { OutfitSaveIdentity } from "./persistence";
import { useSessionGarments } from "./useSessionGarments";

const initialHistory = (): StudioHistory => ({ past: [], present: structuredClone(INITIAL_DOCUMENT), future: [] });

function useStudioDocumentState(ownerId: string | undefined, authReady: boolean, isAdmin: boolean) {
  const [route, setRoute] = useState<{ loadId: string | null; managedId: string | null; visit: number; active: boolean } | null>(null);
  const managedId = isAdmin ? route?.managedId ?? null : null;
  const loadId = route?.loadId ?? null;
  const scopeReady = route !== null;
  const visit = route?.visit ?? 0;
  const active = route?.active ?? false;
  const visits = useRef(0);
  const enterStudio = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const nextLoadId = params.get("loadOutfit");
    const nextManagedId = isAdmin && params.get("manage") === "1" ? nextLoadId : null;
    const nextVisit = ++visits.current;
    setRoute({ loadId: nextLoadId, managedId: nextManagedId, visit: nextVisit, active: true });
    return () => setRoute(previous => previous?.visit === nextVisit ? { ...previous, active: false } : previous);
  }, [isAdmin]);

  const [history, setHistory] = useState<StudioHistory>(initialHistory);
  const [documentScope, setDocumentScope] = useState<{ ownerId?: string; managedId: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestedOutfit, setRequestedOutfit] = useState<string | null>(null);
  const current = useRef(history);
  const identity = useRef<OutfitSaveIdentity>({});
  const ready = useRef(false);
  const epoch = useRef(0);
  const editSerial = useRef(0);
  const inFlight = useRef(false);
  const loadingServer = useRef(false);
  const scope = useRef<{ ownerId?: string; managedId: string | null } | null>(null);
  const lastLoad = useRef<{ ownerId?: string; managedId: string | null; loadId: string | null; visit: number } | null>(null);
  const serverLoadEpoch = useRef(0);

  const dispatch = useCallback((action: StudioAction) => {
    if (!ready.current) return;
    const next = studioReducer(current.current, action);
    if (next === current.current) return;
    editSerial.current++;
    current.current = next;
    setHistory(next);
    setMessage(null);
  }, []);

  useEffect(() => {
    const generation = ++epoch.current;
    ready.current = false;
    if (!authReady || !scopeReady) return;
    const previous = scope.current;
    const sameScope = previous?.ownerId === ownerId && previous?.managedId === managedId;
    // Login can claim guest work in this web session. Leaving an authenticated
    // account discards its in-memory work instead of exposing it to another user.
    const claimGuest = previous && !previous.ownerId && ownerId &&
      !previous.managedId && !managedId && !identity.current.outfitId;
    if (!sameScope && !claimGuest) {
      current.current = initialHistory();
      identity.current = { ownerId };
      editSerial.current++;
    } else {
      identity.current = { ...identity.current, ownerId };
    }
    scope.current = { ownerId, managedId };
    setHistory(current.current);
    setError(null);
    setConflict(false);
    setMessage(null);
    setSaving(false);
    setLoading(false);
    loadingServer.current = false;
    if (!sameScope) setRequestedOutfit(null);
    inFlight.current = false;
    ready.current = true;
    // Publish the scope transition even when guest login retains the exact same
    // history object, so pending account actions can observe that it is ready.
    setDocumentScope(scope.current);
    return () => { ready.current = false; epoch.current = generation + 1; };
  }, [ownerId, authReady, managedId, scopeReady]);

  useEffect(() => {
    if (!active || !authReady || !scopeReady || !ready.current) return;
    const previous = lastLoad.current;
    const sameRequest = previous?.ownerId === ownerId && previous?.managedId === managedId && previous?.loadId === loadId && previous?.visit === visit;
    lastLoad.current = { ownerId, managedId, loadId, visit };
    // A same-account token refresh retains the open document and any uncertain
    // save receipt. Visiting a link again is an explicit request to open it.
    const resumeOpenDocument = sameRequest && Boolean(identity.current.outfitId || identity.current.createIdempotencyKey);
    if (!loadId || resumeOpenDocument || loadId === identity.current.outfitId) {
      if (!loadId) setRequestedOutfit(null);
      return;
    }
    const isDirty = identity.current.savedDocument
      ? !sameDocument(current.current.present, identity.current.savedDocument)
      : !sameDocument(current.current.present, INITIAL_DOCUMENT);
    if (isDirty || inFlight.current || loadingServer.current) { setRequestedOutfit(loadId); return; }
    const generation = epoch.current;
    const loadSequence = serverLoadEpoch;
    const request = ++loadSequence.current;
    const isCurrent = () => generation === epoch.current && request === loadSequence.current;
    loadingServer.current = true;
    setLoading(true);
    const serial = editSerial.current;
    (managedId ? apiFetch<OutfitResponse>(`/api/admin/outfits/${encodeURIComponent(loadId)}`) : api.getOutfit(loadId)).then(saved => {
      if (!isCurrent()) return;
      if (serial !== editSerial.current) { setRequestedOutfit(loadId); return; }
      const document = parseDraft(JSON.stringify({ title: saved.title, snapshot: saved.current_snapshot }));
      if (!document) throw new Error("Bộ phối trên máy chủ có dữ liệu không hợp lệ.");
      identity.current = { ownerId, outfitId: saved.id, revision: saved.revision, savedDocument: document };
      current.current = { past: [], present: document, future: [] };
      setHistory(current.current);
      setRequestedOutfit(null);
    }).catch(err => { if (isCurrent()) setError(err.message); }).finally(() => {
      if (isCurrent()) { loadingServer.current = false; setLoading(false); }
    });
    return () => {
      if (request === loadSequence.current) {
        loadSequence.current++;
        loadingServer.current = false;
        setLoading(false);
      }
    };
  }, [ownerId, authReady, managedId, scopeReady, loadId, visit, active]);

  const save = useCallback(async (asNew = false) => {
    if (!ready.current || loadingServer.current || inFlight.current || scope.current?.ownerId !== ownerId) return false;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setMessage(null);
    const generation = epoch.current;
    const submitted = structuredClone(current.current.present);
    let meta = { ...identity.current };
    try {
      if (managedId && !meta.outfitId && !asNew) throw new Error("Chưa tải được bộ phối cần quản lý. Hãy tải lại trang.");
      const result = await saveOutfitDocument({
        document: submitted,
        identity: meta,
        asNew,
        create: (payload, key) => api.createOutfit(payload, key),
        update: (id, payload) => managedId
          ? apiFetch<OutfitResponse>(`/api/admin/outfits/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) })
          : api.updateOutfit(id, payload),
        onCheckpoint: pending => {
          if (generation !== epoch.current) throw new Error("Tài khoản đã thay đổi.");
          // Keep the retry receipt only in memory for this web session.
          meta = pending;
          identity.current = pending;
        },
      });
      if (generation !== epoch.current) return false;
      identity.current = result.identity;
      setConflict(false);
      setMessage(sameDocument(current.current.present, submitted) ? "Đã lưu bộ phối vào Tủ đồ." : "Đã lưu phiên bản vừa gửi vào Tủ đồ; thay đổi mới trên trang chưa được lưu.");
      return result.saved;
    } catch (err) {
      if (generation !== epoch.current) return false;
      identity.current = meta;
      const apiError = err as ApiError;
      setConflict(apiError.statusCode === 409 && apiError.code !== "OUTFIT_DELETED");
      setError(apiError.code === "OUTFIT_DELETED"
        ? "Bộ phối đã được xóa. Bản đang mở chưa được lưu; chọn Lưu thành bản mới để lưu riêng."
        : apiError.statusCode === 401
          ? "Phiên đăng nhập không hợp lệ. Đăng nhập lại để lưu bộ phối đang mở."
          : apiError.statusCode === 409
            ? "Bộ phối đã được sửa ở nơi khác. Thay đổi của bạn vẫn đang mở trên trang."
            : apiError.code === "NETWORK_ERROR"
              ? "Không kết nối được máy chủ để xác nhận lưu. Giữ trang mở, kiểm tra kết nối rồi thử lại."
              : apiError.message);
      return false;
    } finally {
      if (generation === epoch.current) { inFlight.current = false; setSaving(false); }
    }
  }, [ownerId, managedId]);

  const loadServerCopy = useCallback(async () => {
    const id = requestedOutfit || identity.current.outfitId;
    if (!ready.current || !id || inFlight.current) return;
    if (loadingServer.current) return;
    loadingServer.current = true;
    setLoading(true);
    const generation = epoch.current;
    const request = ++serverLoadEpoch.current;
    const isCurrent = () => generation === epoch.current && request === serverLoadEpoch.current;
    const serial = editSerial.current;
    try {
      const saved = managedId ? await apiFetch<OutfitResponse>(`/api/admin/outfits/${encodeURIComponent(id)}`) : await api.getOutfit(id);
      if (!isCurrent() || serial !== editSerial.current) return;
      const document = parseDraft(JSON.stringify({ title: saved.title, snapshot: saved.current_snapshot }));
      if (!document) throw new Error("Bộ phối trên máy chủ có dữ liệu không hợp lệ.");
      identity.current = { ownerId, outfitId: saved.id, revision: saved.revision, savedDocument: document };
      dispatch({ type: "commit", update: () => document });
      setConflict(false);
      setRequestedOutfit(requested => requested === id ? null : requested);
      setError(null);
      setMessage("Đã tải bản máy chủ. Có thể Hoàn tác để lấy lại nội dung đang sửa.");
    } catch (err) { if (isCurrent()) setError((err as Error).message); }
    finally { if (isCurrent()) { loadingServer.current = false; setLoading(false); } }
  }, [dispatch, ownerId, requestedOutfit, managedId]);

  const startNewDocument = useCallback((document: { title: string; snapshot: OutfitSnapshot }) => {
    if (!ready.current || scope.current?.ownerId !== ownerId || inFlight.current) return false;
    // A replacement must invalidate any server load still in progress.
    editSerial.current++;
    identity.current = { ownerId };
    const next: StudioHistory = { past: [], present: structuredClone(document), future: [] };
    current.current = next;
    setHistory(next);
    setError(null);
    setConflict(false);
    setRequestedOutfit(null);
    setMessage(null);
    return true;
  }, [ownerId]);

  const updateSnapshot = useCallback((patch: Partial<OutfitSnapshot>) => dispatch({ type: "commit", update: doc => ({ ...doc, snapshot: { ...doc.snapshot, ...patch } }) }), [dispatch]);
  const isDirty = identity.current.savedDocument
    ? !sameDocument(current.current.present, identity.current.savedDocument)
    : !sameDocument(current.current.present, INITIAL_DOCUMENT);
  return { history, isManaging: !!managedId, hydrated: authReady && documentScope?.ownerId === ownerId && documentScope?.managedId === managedId, dispatch, updateSnapshot, startNewDocument, error, conflict, saving, loading, message, dismissMessage: () => setMessage(null), save, loadServerCopy, requestedOutfit, keepLocal: () => setRequestedOutfit(null), isDirty, enterStudio };
}

const StudioDocumentContext = createContext<(ReturnType<typeof useStudioDocumentState> & { sessionGarments: ReturnType<typeof useSessionGarments> }) | null>(null);

/** Own the open outfit for this tab's lifetime; never write a browser draft. */
export function StudioDocumentProvider({ children }: { children: ReactNode }) {
  const { user, isReady, isAdmin } = useAuth();
  const document = useStudioDocumentState(user?.id, isReady, isAdmin);
  const sessionGarments = useSessionGarments(user?.id, isReady);
  return createElement(StudioDocumentContext.Provider, { value: { ...document, sessionGarments } }, children);
}

export function useStudioDocument() {
  const document = useContext(StudioDocumentContext);
  if (!document) throw new Error("StudioDocumentProvider not found");
  const { enterStudio } = document;
  useEffect(enterStudio, [enterStudio]);
  return document;
}
