"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { OutfitSnapshot } from "@/lib/types/api";
import { DRAFT_KEY, INITIAL_DOCUMENT, parseDraft, sameDocument, studioReducer } from "./state";
import type { StudioAction, StudioDraft, StudioHistory } from "./state";

const initialHistory = (): StudioHistory => ({ past: [], present: structuredClone(INITIAL_DOCUMENT), future: [] });
const archiveKey = (owner?: string) => `${DRAFT_KEY}:${owner || "guest"}`;

export function useStudioDocument(ownerId: string | undefined, authReady: boolean) {
  const [history, setHistory] = useState<StudioHistory>(initialHistory);
  const [hydrated, setHydrated] = useState(false);
  const [draftNotice, setDraftNotice] = useState<StudioDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestedOutfit, setRequestedOutfit] = useState<string | null>(null);
  const current = useRef(history);
  const identity = useRef<Pick<StudioDraft, "outfitId" | "revision" | "ownerId" | "savedDocument">>({});
  const ready = useRef(false);
  const epoch = useRef(0);
  const editSerial = useRef(0);
  const inFlight = useRef(false);
  const activeOwner = useRef<string | undefined>();

  const persist = useCallback(() => {
    if (!ready.current) return;
    try {
      const draft = JSON.stringify({ ...current.current.present, ...identity.current });
      localStorage.setItem(archiveKey(identity.current.ownerId), draft);
      const sessionUser = localStorage.getItem("viet_stylist_user");
      const sessionOwner = localStorage.getItem("viet_stylist_auth_token") && sessionUser ? JSON.parse(sessionUser).id : undefined;
      if (sessionOwner === identity.current.ownerId) localStorage.setItem(DRAFT_KEY, draft);
    } catch {
      setError("Không ghi được bản nháp trên thiết bị. Giữ trang mở và lưu bộ phối lên tài khoản.");
    }
  }, []);

  const dispatch = useCallback((action: StudioAction) => {
    if (!ready.current) return;
    const next = studioReducer(current.current, action);
    if (next === current.current) return;
    editSerial.current++;
    current.current = next;
    setHistory(next);
    setDraftNotice(null);
    setMessage(null);
    // Persist document boundaries synchronously, including the end of a drag.
    // Refresh immediately after an edit must not race an autosave timer.
    persist();
  }, [persist]);

  useEffect(() => {
    if (!authReady) return;
    const generation = ++epoch.current;
    persist();
    ready.current = false;
    setHydrated(false);
    setError(null);
    setConflict(false);
    setMessage(null);
    setSaving(false);
    setRequestedOutfit(null);
    inFlight.current = false;
    let draft: StudioDraft | null = null;
    try {
      const active = parseDraft(localStorage.getItem(DRAFT_KEY));
      if (active && active.ownerId !== ownerId) {
        localStorage.setItem(archiveKey(active.ownerId), JSON.stringify(active));
      }
      // Guest work can be claimed once after login. Private work never crosses owners.
      if (active && active.ownerId === ownerId) draft = active;
      else if (active && !active.ownerId && ownerId && !active.outfitId) {
        draft = { ...active, ownerId };
        localStorage.removeItem(archiveKey());
      } else {
        const archived = parseDraft(localStorage.getItem(archiveKey(ownerId)));
        if (archived?.ownerId === ownerId) draft = archived;
      }
    } catch {
      setError("Không đọc được bản nháp trên thiết bị.");
    }
    activeOwner.current = ownerId;
    identity.current = { ownerId, outfitId: draft?.outfitId, revision: draft?.revision, savedDocument: draft?.savedDocument };
    current.current = { past: [], present: draft ? { title: draft.title, snapshot: draft.snapshot } : structuredClone(INITIAL_DOCUMENT), future: [] };
    setHistory(current.current);
    setDraftNotice(draft && (!draft.savedDocument || !sameDocument(draft, draft.savedDocument)) ? draft : null);
    ready.current = true;
    setHydrated(true);
    persist();

    const loadId = new URLSearchParams(window.location.search).get("loadOutfit");
    // A local unsaved draft wins until the user explicitly chooses the server copy.
    if (loadId && (!draft || (draft.savedDocument && sameDocument(draft, draft.savedDocument)))) {
      const serial = editSerial.current;
      api.getOutfit(loadId).then(saved => {
        if (generation !== epoch.current || serial !== editSerial.current) return;
        const document = parseDraft(JSON.stringify({ title: saved.title, snapshot: saved.current_snapshot }));
        if (!document) throw new Error("Bộ phối trên máy chủ có dữ liệu không hợp lệ.");
        identity.current = { ownerId, outfitId: saved.id, revision: saved.revision, savedDocument: document };
        current.current = { past: [], present: document, future: [] };
        setHistory(current.current);
        persist();
      }).catch(err => { if (generation === epoch.current) setError(err.message); });
    } else if (loadId) setRequestedOutfit(loadId);
    return () => { epoch.current++; };
  }, [ownerId, authReady, persist]);

  useEffect(() => {
    const flush = () => persist();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persist]);

  const save = useCallback(async (asNew = false) => {
    if (!ready.current || inFlight.current || activeOwner.current !== ownerId) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setMessage(null);
    const generation = epoch.current;
    const submitted = structuredClone(current.current.present);
    const meta = { ...identity.current };
    const payload = { title: submitted.title, snapshot: submitted.snapshot, occasion_id: submitted.snapshot.occasionId, style_mode: submitted.snapshot.styleMode };
    try {
      if (meta.outfitId && !asNew && !meta.revision) throw new Error("Thiếu phiên bản bộ phối. Tải bản máy chủ hoặc lưu thành bộ mới.");
      const saved = meta.outfitId && !asNew
        ? await api.updateOutfit(meta.outfitId, { ...payload, revision: meta.revision! })
        : await api.createOutfit(payload);
      if (generation !== epoch.current) return;
      identity.current = { ownerId, outfitId: saved.id, revision: saved.revision, savedDocument: submitted };
      persist();
      setConflict(false);
      setMessage(sameDocument(current.current.present, submitted) ? "Đã lưu bộ phối thành công!" : "Đã lưu phiên bản vừa gửi; thay đổi mới vẫn nằm trong bản nháp.");
    } catch (err) {
      if (generation !== epoch.current) return;
      const apiError = err as ApiError;
      setConflict(apiError.statusCode === 409);
      setError(apiError.statusCode === 401 ? "Phiên đăng nhập không hợp lệ. Đăng nhập lại để lưu; bản nháp vẫn được giữ." : apiError.statusCode === 409 ? "Bộ phối đã được sửa ở nơi khác. Bản nháp của bạn vẫn được giữ." : apiError.message);
      persist();
    } finally {
      if (generation === epoch.current) { inFlight.current = false; setSaving(false); }
    }
  }, [ownerId, persist]);

  const loadServerCopy = useCallback(async () => {
    const id = requestedOutfit || identity.current.outfitId;
    if (!id || inFlight.current) return;
    const generation = epoch.current;
    const serial = editSerial.current;
    try {
      const saved = await api.getOutfit(id);
      if (generation !== epoch.current || serial !== editSerial.current) return;
      const document = parseDraft(JSON.stringify({ title: saved.title, snapshot: saved.current_snapshot }));
      if (!document) throw new Error("Bộ phối trên máy chủ có dữ liệu không hợp lệ.");
      // Preserve the user's losing edit before replacing the visible document.
      localStorage.setItem(`${archiveKey(ownerId)}:conflict`, JSON.stringify({ ...current.current.present, ...identity.current }));
      identity.current = { ownerId, outfitId: saved.id, revision: saved.revision, savedDocument: document };
      dispatch({ type: "commit", update: () => document });
      persist();
      setConflict(false);
      setRequestedOutfit(null);
      setError(null);
      setMessage("Đã tải bản máy chủ. Có thể Hoàn tác để lấy lại nội dung đang sửa.");
    } catch (err) { if (generation === epoch.current) setError((err as Error).message); }
  }, [dispatch, ownerId, persist, requestedOutfit]);

  const updateSnapshot = useCallback((patch: Partial<OutfitSnapshot>) => dispatch({ type: "commit", update: doc => ({ ...doc, snapshot: { ...doc.snapshot, ...patch } }) }), [dispatch]);
  return { history, hydrated: hydrated && authReady && activeOwner.current === ownerId, dispatch, updateSnapshot, draftNotice, dismissDraft: () => setDraftNotice(null), error, conflict, saving, message, save, loadServerCopy, requestedOutfit, keepLocal: () => setRequestedOutfit(null) };
}
