import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

import { storage } from "./storage";

export function createMMKVPersister(key = "reactQuery") {
  return {
    persistClient: (client: PersistedClient) => {
      storage.set(key, JSON.stringify(client));
    },
    restoreClient: () => {
      const cached = storage.getString(key);
      return cached ? JSON.parse(cached) : undefined;
    },
    removeClient: () => {
      storage.remove(key);
    },
  } satisfies Persister;
}
