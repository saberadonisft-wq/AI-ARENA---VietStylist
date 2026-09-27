"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiFetch, ApiError } from "@/lib/api/client";
import type { OutfitSnapshot, OutfitResponse } from "@/lib/types/api";
import { DRAFT_KEY, INITIAL_DOCUMENT, parseDraft, sameDocument, studioReducer } from "./state";
import type { StudioAction, StudioDraft, StudioHistory } from "./state";
import { readStudioDraft, saveOutfitDocument, writeStudioDraft } from "./persistence";

const initialHistory = (): StudioHistory => ({ past: [], present: structuredClone(INITIAL_DOCUMENT), future: [] });
const archiveKey = (owner?: string) => `${DRAFT_KEY}:${owner || "guest"}`;
type AccountDraftChoice = { deviceDraft: StudioDraft; accountDraft: StudioDraft };
type StoredRecoveryDraft = { key: string; kind: "recovery" | "account-choice" | "tab-recovery" | "conflict"; draft: StudioDraft };

function readRecoveryDrafts(baseKey: string): StoredRecoveryDraft[] {
  if (typeof window === "undefined") return [];
  try {
    return Object.keys(localStorage).flatMap(key => {
      if (!key.startsWith(`${baseKey}:`)) return [];
      const suffix = key.slice(baseKey.length + 1).split(":");
      const kind = suffix[0] as StoredRecoveryDraft["kind"];
      if (!["recovery", "account-choice", "tab-recovery", "conflict"].includes(kind)) return [];
      const draft = parseDraft(localStorage.getItem(key));
      return draft ? [{ key, kind, draft }] : [];
    }).sort((left, right) => right.key.localeCompare(left.key));
  } catch {
    return [];
  }
}

export function useStudioDocument(ownerId: string | undefined, authReady: boolean, isAdmin = false) {
  const [managedId, setManagedId] = useState<string | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setManagedId(isAdmin && params.get("manage") === "1" ? params.get("loadOutfit") : null);
    setScopeReady(true);
  }, [isAdmin]);
  // Admin edits never overwrite the administrator's personal Studio draft.
  const draftKey = managedId ? `${DRAFT_KEY}:managed:${managedId}` : DRAFT_KEY;
  const scopedArchiveKey = (owner?: string) => managedId ? `${draftKey}:${owner || "guest"}` : archiveKey(owner);
  const [history, setHistory] = useState<StudioHistory>(initialHistory);
  const [hydrated, setHydrated] = useState(false);
  const [draftNotice, setDraftNotice] = useState<StudioDraft | null>(null);
  const [accountDraftChoice, setAccountDraftChoice] = useState<AccountDraftChoice | null>(null);
  const [recoveryDrafts, setRecoveryDrafts] = useState<StoredRecoveryDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [requestedOutfit, setRequestedOutfit] = useState<string | null>(null);
  const [externalDraft, setExternalDraft] = useState<StudioDraft | null>(null);
  const current = useRef(history);
  const identity = useRef<Pick<StudioDraft, "outfitId" | "revision" | "ownerId" | "savedDocument" | "createIdempotencyKey" | "createDocument">>({});
  const ready = useRef(false);
  const epoch = useRef(0);
  const editSerial = useRef(0);
  const cleanSerial = useRef(0);
  const inFlight = useRef(false);
  const activeOwner = useRef<string | undefined>();
  const persistedScope = useRef(draftKey);

  const persist = useCallback(() => {
    if (!ready.current || persistedScope.current !== draftKey) return false;
    try {
      const draft = { ...current.current.present, ...identity.current } as StudioDraft;
      if (!writeStudioDraft(scopedArchiveKey(identity.current.ownerId), draft)) throw new Error("storage unavailable");
      const sessionUser = localStorage.getItem("viet_stylist_user");
      const sessionOwner = localStorage.getItem("viet_stylist_auth_token") && sessionUser ? JSON.parse(sessionUser).id : undefined;
      if (sessionOwner === identity.current.ownerId && !writeStudioDraft(draftKey, draft)) throw new Error("storage unavailable");
      return true;
    } catch {
      setError("Không ghi được bản nháp trên thiết bị. Giữ trang mở và lưu bộ phối lên tài khoản.");
      return false;
    }
  }, [draftKey]);

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
    if (!authReady || !scopeReady) return;
    const generation = ++epoch.current;
    persist();
    ready.current = false;
    persistedScope.current = draftKey;
    setHydrated(false);
    setError(null);
    setConflict(false);
    setMessage(null);
    setAccountDraftChoice(null);
    setSaving(false);
    setRequestedOutfit(null);
    setExternalDraft(null);
    inFlight.current = false;
    let draft: StudioDraft | null = null;
    let preserveGuestOwner = false;
    try {
      const active = readStudioDraft(draftKey);
      if (active && active.ownerId !== ownerId) {
        if (!writeStudioDraft(scopedArchiveKey(active.ownerId), active)) throw new Error("storage unavailable");
      }
      // Guest work can be claimed once after login. If this account already has
      // its own draft, require an explicit choice and keep both copies recoverable.
      if (active && active.ownerId === ownerId) draft = active;
      else if (active && !active.ownerId && ownerId && !active.outfitId) {
        const accountDraft = readStudioDraft(scopedArchiveKey(ownerId));
        if (accountDraft?.ownerId === ownerId && !sameDocument(active, accountDraft)) {
          draft = active;
          preserveGuestOwner = true;
          setAccountDraftChoice({ deviceDraft: active, accountDraft });
        } else if (accountDraft?.ownerId === ownerId) {
          draft = accountDraft;
        } else {
          draft = { ...active, ownerId };
          localStorage.removeItem(scopedArchiveKey());
        }
      } else {
        const archived = readStudioDraft(scopedArchiveKey(ownerId));
        if (archived?.ownerId === ownerId) draft = archived;
      }
    } catch {
      setError("Không đọc được bản nháp trên thiết bị.");
    }
    activeOwner.current = ownerId;
    setRecoveryDrafts(readRecoveryDrafts(scopedArchiveKey(ownerId)));
    identity.current = { ownerId: preserveGuestOwner ? draft?.ownerId : ownerId, outfitId: draft?.outfitId, revision: draft?.revision, savedDocument: draft?.savedDocument,
      createIdempotencyKey: draft?.createIdempotencyKey, createDocument: draft?.createDocument };
    current.current = { past: [], present: draft ? { title: draft.title, snapshot: draft.snapshot } : structuredClone(INITIAL_DOCUMENT), future: [] };
    setHistory(current.current);
    setDraftNotice(draft && (!draft.savedDocument || !sameDocument(draft, draft.savedDocument)) ? draft : null);
    ready.current = true;
    cleanSerial.current = editSerial.current;
    setHydrated(true);
    persist();

    const loadId = new URLSearchParams(window.location.search).get("loadOutfit");
    // A local unsaved draft wins until the user explicitly chooses the server copy.
    if (loadId && (!draft || (draft.savedDocument && sameDocument(draft, draft.savedDocument)))) {
      const serial = editSerial.current;
      (managedId ? apiFetch<OutfitResponse>(`/api/admin/outfits/${encodeURIComponent(loadId)}`) : api.getOutfit(loadId)).then(saved => {
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
  }, [ownerId, authReady, persist, managedId, scopeReady]);

  useEffect(() => {
    if (!hydrated || activeOwner.current !== ownerId) return;
    const key = scopedArchiveKey(ownerId);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue) return;
      const incoming = parseDraft(event.newValue);
      if (!incoming || incoming.ownerId !== ownerId) return;
      if (sameDocument(incoming, current.current.present)) {
        identity.current = { ownerId, outfitId: incoming.outfitId, revision: incoming.revision,
          savedDocument: incoming.savedDocument, createIdempotencyKey: incoming.createIdempotencyKey,
          createDocument: incoming.createDocument };
        cleanSerial.current = editSerial.current;
        return;
      }
      if (editSerial.current > cleanSerial.current) {
        const saved = writeStudioDraft(`${key}:tab-recovery:${Date.now()}`, incoming);
        if (saved) setRecoveryDrafts(readRecoveryDrafts(scopedArchiveKey(ownerId)));
        setExternalDraft(incoming);
        return;
      }
      identity.current = { ownerId, outfitId: incoming.outfitId, revision: incoming.revision,
        savedDocument: incoming.savedDocument, createIdempotencyKey: incoming.createIdempotencyKey,
        createDocument: incoming.createDocument };
      current.current = { past: [], present: { title: incoming.title, snapshot: incoming.snapshot }, future: [] };
      setHistory(current.current);
      cleanSerial.current = editSerial.current;
      setDraftNotice(!incoming.savedDocument || !sameDocument(incoming, incoming.savedDocument) ? incoming : null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrated, ownerId, draftKey, managedId]);

  useEffect(() => {
    const flush = () => persist();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persist]);

  const save = useCallback(async (asNew = false) => {
    if (!ready.current || inFlight.current || activeOwner.current !== ownerId) return false;
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
        onPendingCreate: pending => {
          meta = pending;
          identity.current = pending;
          if (!persist()) throw new Error("Không thể lưu mã chống trùng trên thiết bị; chưa gửi yêu cầu tạo bộ phối.");
        },
      });
      if (generation !== epoch.current) return false;
      identity.current = result.identity;
      persist();
      setConflict(false);
      setMessage(sameDocument(current.current.present, submitted) ? "Đã lưu bộ phối vào Tủ đồ." : "Đã lưu phiên bản vừa gửi vào Tủ đồ; thay đổi mới vẫn nằm trong bản nháp trên thiết bị.");
      return true;
    } catch (err) {
      if (generation !== epoch.current) return false;
      identity.current = meta;
      const apiError = err as ApiError;
      setConflict(apiError.statusCode === 409);
      setError(apiError.statusCode === 401 ? "Phiên đăng nhập không hợp lệ. Đăng nhập lại để lưu; bản nháp vẫn được giữ." : apiError.statusCode === 409 ? "Bộ phối đã được sửa ở nơi khác. Bản nháp của bạn vẫn được giữ." : apiError.code === "NETWORK_ERROR" ? "Không kết nối được máy chủ để xác nhận lưu. Bản nháp vẫn được giữ trên thiết bị; hãy kiểm tra kết nối rồi thử lại." : apiError.message);
      persist();
      return false;
    } finally {
      if (generation === epoch.current) { inFlight.current = false; setSaving(false); }
    }
  }, [ownerId, persist, managedId]);

  const loadServerCopy = useCallback(async () => {
    const id = requestedOutfit || identity.current.outfitId;
    if (!id || inFlight.current) return;
    const generation = epoch.current;
    const serial = editSerial.current;
    try {
      const saved = managedId ? await apiFetch<OutfitResponse>(`/api/admin/outfits/${encodeURIComponent(id)}`) : await api.getOutfit(id);
      if (generation !== epoch.current || serial !== editSerial.current) return;
      const document = parseDraft(JSON.stringify({ title: saved.title, snapshot: saved.current_snapshot }));
      if (!document) throw new Error("Bộ phối trên máy chủ có dữ liệu không hợp lệ.");
      // Preserve the user's losing edit before replacing the visible document.
      if (!writeStudioDraft(`${scopedArchiveKey(ownerId)}:conflict:${Date.now()}`, { ...current.current.present, ...identity.current } as StudioDraft)) throw new Error("storage unavailable");
      setRecoveryDrafts(readRecoveryDrafts(scopedArchiveKey(ownerId)));
      identity.current = { ownerId, outfitId: saved.id, revision: saved.revision, savedDocument: document };
      dispatch({ type: "commit", update: () => document });
      persist();
      setConflict(false);
      setRequestedOutfit(null);
      setError(null);
      setMessage("Đã tải bản máy chủ. Có thể Hoàn tác để lấy lại nội dung đang sửa.");
    } catch (err) { if (generation === epoch.current) setError((err as Error).message); }
  }, [dispatch, ownerId, persist, requestedOutfit, managedId]);

  const acceptExternalDraft = useCallback(() => {
    if (!externalDraft || externalDraft.ownerId !== ownerId) return;
    if (!writeStudioDraft(`${scopedArchiveKey(ownerId)}:tab-recovery:${Date.now()}`, { ...current.current.present, ...identity.current } as StudioDraft)) {
      setError("Không thể lưu bản đang mở vào mục khôi phục. Bản này vẫn đang mở; hãy giải phóng dung lượng lưu trữ rồi thử lại.");
      return;
    }
    setRecoveryDrafts(readRecoveryDrafts(scopedArchiveKey(ownerId)));
    identity.current = { ownerId, outfitId: externalDraft.outfitId, revision: externalDraft.revision,
      savedDocument: externalDraft.savedDocument, createIdempotencyKey: externalDraft.createIdempotencyKey,
      createDocument: externalDraft.createDocument };
    current.current = { past: [], present: { title: externalDraft.title, snapshot: externalDraft.snapshot }, future: [] };
    editSerial.current++;
    cleanSerial.current = editSerial.current;
    setHistory(current.current);
    setDraftNotice(!externalDraft.savedDocument || !sameDocument(externalDraft, externalDraft.savedDocument) ? externalDraft : null);
    setExternalDraft(null);
    setMessage("Đã tiếp tục bản nháp từ tab khác; bản đang mở được lưu trong mục khôi phục trên thiết bị.");
    persist();
  }, [externalDraft, ownerId, persist, draftKey, managedId]);

  const keepCurrentDraft = useCallback(() => {
    setExternalDraft(null);
    persist();
  }, [persist]);

  const archiveCurrentDraft = useCallback(() => {
    try {
      const archive = scopedArchiveKey(ownerId);
      if (!writeStudioDraft(`${archive}:recovery:${Date.now()}`, { ...current.current.present, ...identity.current } as StudioDraft)) {
        setError("Không thể lưu bản nháp vào mục khôi phục. Bản hiện tại vẫn đang mở; hãy kiểm tra dung lượng lưu trữ rồi thử lại.");
        return false;
      }
      setRecoveryDrafts(readRecoveryDrafts(archive));
      return true;
    } catch {
      setError("Không thể lưu bản khôi phục trên thiết bị. Bản phối hiện tại vẫn được giữ nguyên.");
      return false;
    }
  }, [ownerId, draftKey, managedId]);

  const restoreRecoveryDraft = useCallback((recoveryKey: string) => {
    if (!ready.current || activeOwner.current !== ownerId || !recoveryKey.startsWith(`${scopedArchiveKey(ownerId)}:`)) return false;
    const entry = recoveryDrafts.find(candidate => candidate.key === recoveryKey);
    const recovered = entry?.draft;
    if (!recovered || (recovered.ownerId && recovered.ownerId !== ownerId)) return false;
    const saved = identity.current.savedDocument;
    const currentIsDirty = saved
      ? !sameDocument(current.current.present, saved)
      : !sameDocument(current.current.present, INITIAL_DOCUMENT);
    if (currentIsDirty && !archiveCurrentDraft()) return false;
    identity.current = {
      ownerId,
      outfitId: recovered.outfitId,
      revision: recovered.revision,
      savedDocument: recovered.savedDocument,
      createIdempotencyKey: recovered.createIdempotencyKey,
      createDocument: recovered.createDocument,
    };
    current.current = { past: [], present: { title: recovered.title, snapshot: recovered.snapshot }, future: [] };
    editSerial.current++;
    cleanSerial.current = editSerial.current;
    setHistory(current.current);
    setDraftNotice(null);
    setError(null);
    if (!persist()) return false;
    try { localStorage.removeItem(recoveryKey); } catch { /* The restored copy is already durable; keep the backup if removal is blocked. */ }
    setRecoveryDrafts(readRecoveryDrafts(scopedArchiveKey(ownerId)));
    setMessage("Đã khôi phục bản phối. Bản đang mở trước đó được giữ lại nếu có thay đổi chưa lưu.");
    return true;
  }, [recoveryDrafts, ownerId, archiveCurrentDraft, persist, draftKey, managedId]);

  const chooseAccountDraft = useCallback((source: "device" | "account") => {
    if (!accountDraftChoice || !ownerId || !ready.current || activeOwner.current !== ownerId) return false;
    const selected = source === "device" ? accountDraftChoice.deviceDraft : accountDraftChoice.accountDraft;
    const other = source === "device" ? accountDraftChoice.accountDraft : accountDraftChoice.deviceDraft;
    const recoveryKey = `${scopedArchiveKey(ownerId)}:account-choice:${Date.now()}`;
    if (!writeStudioDraft(recoveryKey, other)) {
      setError("Không thể lưu bản còn lại vào mục khôi phục. Hai bản phối vẫn đang được giữ; hãy kiểm tra dung lượng lưu trữ rồi thử lại.");
      return false;
    }
    identity.current = {
      ownerId,
      outfitId: selected.outfitId,
      revision: selected.revision,
      savedDocument: selected.savedDocument,
      createIdempotencyKey: selected.createIdempotencyKey,
      createDocument: selected.createDocument,
    };
    current.current = { past: [], present: { title: selected.title, snapshot: selected.snapshot }, future: [] };
    editSerial.current++;
    cleanSerial.current = editSerial.current;
    setHistory(current.current);
    setDraftNotice(null);
    setError(null);
    if (!persist()) return false;
    setRecoveryDrafts(readRecoveryDrafts(scopedArchiveKey(ownerId)));
    setAccountDraftChoice(null);
    setMessage(source === "device"
      ? "Đã tiếp tục nháp trên thiết bị. Nháp cũ của tài khoản được giữ trong mục khôi phục."
      : "Đã tiếp tục nháp của tài khoản. Nháp trên thiết bị được giữ trong mục khôi phục.");
    return true;
  }, [accountDraftChoice, ownerId, persist, draftKey, managedId]);

  const startNewDocument = useCallback((document: { title: string; snapshot: OutfitSnapshot }) => {
    if (!ready.current || activeOwner.current !== ownerId) return false;
    identity.current = { ownerId };
    const next: StudioHistory = { past: [], present: structuredClone(document), future: [] };
    current.current = next;
    editSerial.current++;
    cleanSerial.current = editSerial.current;
    setHistory(next);
    setDraftNotice(null);
    setExternalDraft(null);
    setError(null);
    setConflict(false);
    setMessage(null);
    persist();
    return true;
  }, [ownerId, persist]);

  const startFreshDraft = useCallback(() => {
    if (!draftNotice || !archiveCurrentDraft()) return false;
    const started = startNewDocument(INITIAL_DOCUMENT);
    if (started) setMessage("Đã tạo bản phối trống. Bản nháp trước được giữ trong mục khôi phục trên thiết bị.");
    return started;
  }, [draftNotice, archiveCurrentDraft, startNewDocument]);

  const updateSnapshot = useCallback((patch: Partial<OutfitSnapshot>) => dispatch({ type: "commit", update: doc => ({ ...doc, snapshot: { ...doc.snapshot, ...patch } }) }), [dispatch]);
  const isDirty = identity.current.savedDocument
    ? !sameDocument(current.current.present, identity.current.savedDocument)
    : !sameDocument(current.current.present, INITIAL_DOCUMENT);
  return { history, isManaging: !!managedId, hydrated: hydrated && authReady && activeOwner.current === ownerId, dispatch, updateSnapshot, startNewDocument, startFreshDraft, draftNotice, dismissDraft: () => setDraftNotice(null), accountDraftChoice, chooseAccountDraft, recoveryDrafts, restoreRecoveryDraft, error, conflict, saving, message, dismissMessage: () => setMessage(null), save, loadServerCopy, requestedOutfit, keepLocal: () => setRequestedOutfit(null), externalDraft, acceptExternalDraft, keepCurrentDraft, isDirty, archiveCurrentDraft };
}
