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
  const [error, setError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const loaded = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (inFlight.current) return inFlight.current;
    if (!isRefresh && loaded.current) return;
    const pending = (async () => {
      setIsLoading(true);
      setError(null);
      setItemsError(null);

      try {
        const [gtRes, occRes, itemsRes, avtRes] = await Promise.allSettled([
          api.getGarmentTypes(),
          api.getOccasions(),
          api.getAllCatalogItems(),
          api.getAvatars(),
        ]);

        if (gtRes.status === "fulfilled") setGarmentTypes(gtRes.value || []);
        if (occRes.status === "fulfilled") setOccasions(occRes.value || []);
        if (itemsRes.status === "fulfilled") setCatalogItems(itemsRes.value || []);
        else setItemsError("Chưa tải được kho trang phục. Hãy thử tải lại để kiểm tra bộ phối.");
        if (avtRes.status === "fulfilled") setAvatars(avtRes.value || []);

        const anyRejected = [gtRes, occRes, itemsRes, avtRes].some((r) => r.status === "rejected");
        if (anyRejected) {
          setError("Một số dữ liệu chưa thể đồng bộ từ máy chủ.");
        }
        setIsLoaded(true);
        loaded.current = true;
      } catch (err: any) {
        console.warn("Không thể tải danh mục cổ phục:", err?.message || err);
        setError(err?.message || "Không thể kết nối đến máy chủ.");
      } finally {
        setIsLoading(false);
      }
    })();
    inFlight.current = pending;
    try { await pending; }
    finally { inFlight.current = null; }
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

export function useCatalog() {
  const context = useContext(CatalogContext);
  const { ensureLoaded } = context;
  useEffect(() => { void ensureLoaded(); }, [ensureLoaded]);
  if (!context) {
    throw new Error("useCatalog must be used within a CatalogProvider");
  }
  return context;
}

