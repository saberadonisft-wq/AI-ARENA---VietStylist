"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  refreshCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue>({
  garmentTypes: [],
  occasions: [],
  catalogItems: [],
  avatars: [],
  isLoading: true,
  isLoaded: false,
  error: null,
  refreshCatalog: async () => {},
});

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh && isLoaded) return;
    setIsLoading(true);
    setError(null);

    try {
      const [gtRes, occRes, itemsRes, avtRes] = await Promise.allSettled([
        api.getGarmentTypes(),
        api.getOccasions(),
        api.getCatalogItems(),
        api.getAvatars(),
      ]);

      if (gtRes.status === "fulfilled") setGarmentTypes(gtRes.value || []);
      if (occRes.status === "fulfilled") setOccasions(occRes.value || []);
      if (itemsRes.status === "fulfilled") setCatalogItems(itemsRes.value || []);
      if (avtRes.status === "fulfilled") setAvatars(avtRes.value || []);

      const anyRejected = [gtRes, occRes, itemsRes, avtRes].some((r) => r.status === "rejected");
      if (anyRejected) {
        setError("Một số dữ liệu chưa thể đồng bộ từ máy chủ.");
      }
      setIsLoaded(true);
    } catch (err: any) {
      console.warn("Không thể tải danh mục cổ phục:", err?.message || err);
      setError(err?.message || "Không thể kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        refreshCatalog,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalog must be used within a CatalogProvider");
  }
  return context;
}

