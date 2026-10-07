"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { GarmentType, Occasion, CatalogItem, Avatar } from "@/lib/types/api";
import { api } from "@/lib/api/client";

interface CatalogContextValue {
  garmentTypes: GarmentType[];
  occasions: Occasion[];
  catalogItems: CatalogItem[];
  avatars: Avatar[];
  isLoading: boolean;
  isLoaded: boolean;
  itemsLoading: boolean;
  itemsLoaded: boolean;
  error: string | null;
  itemsError: string | null;
  refreshCatalog: () => Promise<void>;
  ensureLoaded: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue>({
  garmentTypes: [],
  occasions: [],
  catalogItems: [],
  avatars: [],
  isLoading: true,
  isLoaded: false,
  itemsLoading: true,
  itemsLoaded: false,
  error: null,
  itemsError: null,
  refreshCatalog: async () => {},
  ensureLoaded: async () => {},
});

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [itemsLoading, setItemsLoading] = useState<boolean>(true);
  const [itemsLoaded, setItemsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const loaded = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    // A user retry must not wait for unrelated metadata from an older failed batch.
    // Ordinary consumers still share the active request; requestId fences the old batch.
    if (inFlight.current && !isRefresh) return inFlight.current;
    if (!isRefresh && loaded.current) return;
    const currentRequestId = ++requestId.current;
    const isCurrent = () => mounted.current && currentRequestId === requestId.current;
    const pending = (async () => {
      setIsLoading(true);
      setItemsLoading(true);
      setItemsLoaded(false);
      setError(null);
      setItemsError(null);

      try {
        const [gtRes, occRes, itemsRes, avtRes] = await Promise.allSettled([
          api.getGarmentTypes().then((data) => {
            if (isCurrent()) setGarmentTypes(data || []);
          }),
          api.getOccasions().then((data) => {
            if (isCurrent()) setOccasions(data || []);
          }),
          api.getAllCatalogItems().then((data) => {
            if (!isCurrent()) return;
            // Only publish the complete list; partial pagination cannot prove an item is unavailable.
            setCatalogItems(data || []);
            setItemsLoaded(true);
            setItemsLoading(false);
          }, (err) => {
            if (isCurrent()) {
              setItemsError("Chưa tải được kho trang phục. Hãy thử tải lại để kiểm tra bộ phối.");
              setItemsLoading(false);
            }
            throw err;
          }),
          api.getAvatars().then((data) => {
            if (isCurrent()) setAvatars(data || []);
          }),
        ]);

        if (!isCurrent()) return;
        const anyRejected = [gtRes, occRes, itemsRes, avtRes].some((r) => r.status === "rejected");
        if (anyRejected) {
          setError("Một số dữ liệu chưa thể đồng bộ từ máy chủ.");
        }
        setIsLoaded(true);
        loaded.current = true;
      } catch (err: any) {
        if (!isCurrent()) return;
        console.warn("Không thể tải danh mục cổ phục:", err?.message || err);
        setError(err?.message || "Không thể kết nối đến máy chủ.");
      } finally {
        if (isCurrent()) {
          setIsLoading(false);
          setItemsLoading(false);
        }
      }
    })();
    inFlight.current = pending;
    try { await pending; }
    finally { if (inFlight.current === pending) inFlight.current = null; }
  }, []);

  const ensureLoaded = useCallback(() => loadData(), [loadData]);

  const refreshCatalog = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  return (
    <CatalogContext.Provider
      value={{
        garmentTypes,
        occasions,
        catalogItems,
        avatars,
        isLoading,
        isLoaded,
        itemsLoading,
        itemsLoaded,
        error,
        itemsError,
        refreshCatalog,
        ensureLoaded,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog({ enabled = true }: { enabled?: boolean } = {}) {
  const context = useContext(CatalogContext);
  const { ensureLoaded } = context;
  useEffect(() => { if (enabled) void ensureLoaded(); }, [enabled, ensureLoaded]);
  if (!context) {
    throw new Error("useCatalog must be used within a CatalogProvider");
  }
  return context;
}
