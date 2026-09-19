import type { Partner } from "@news-spend-media/payload/types";
import { useMMKVObject } from "react-native-mmkv";

import { storage } from "#/utils/storage";

const STORAGE_KEY = "FAVORITE_STORES";

function getInitialStores(): Partial<Partner>[] {
  try {
    const raw = storage.getString(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavoriteStores() {
  const [stores, setStores] = useMMKVObject<Partial<Partner>[]>(
    STORAGE_KEY,
    storage,
    { defaultValue: getInitialStores }
  );

  const setFavoriteStores = (newStores: Partial<Partner>[]) => {
    setStores(newStores);
  };

  const toggleFavoriteStore = (store: Partial<Partner>) => {
    setStores((prev) => {
      const current = prev ?? [];
      const index = current.findIndex((s) => s.id === store.id);
      if (index === -1) {
        return [...current, store];
      }
      return current.filter((s) => s.id !== store.id);
    });
  };

  const isFavorite = (storeId: string) =>
    (stores ?? []).some((s) => s.id === storeId);

  return {
    stores: stores ?? [],
    setFavoriteStores,
    toggleFavoriteStore,
    isFavorite,
  };
}
