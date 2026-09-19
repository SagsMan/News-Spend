import * as Sentry from "@sentry/react-native";
import { setVideoCacheSizeAsync } from "expo-video";
import { useCallback, useEffect, useState } from "react";

import { orpc } from "#/lib/orpc";
import { storage } from "#/utils/storage";

export default function useCachedResources() {
  const [loadingComplete, setLoadingComplete] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Helper to load categories
  const loadCategories = useCallback(async (isInitialLoad = false) => {
    try {
      const categoriesResponse = await orpc.news.categories.call();

      // Update categories state
      storage.set("CATEGORIES", JSON.stringify(categoriesResponse ?? []));
      return true;
    } catch (e) {
      console.warn("Failed loading categories", e);
      Sentry.captureException(e, {
        tags: {
          isInitialLoad: isInitialLoad ? "yes" : "no",
        },
      });

      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    function loadResourcesAndDataAsync() {
      try {
        console.log("Loading resources and data");

        // Set video cache size to 30MB. Not awaited before anything else: it
        // is a native round trip whose result no startup path depends on.
        setVideoCacheSizeAsync(30 * 1024 * 1024).catch((e) => {
          console.warn("Failed setting video cache size", e);
        });

        const hasLoadedCategories = storage.getBoolean("HAS_LOADED_CATEGORIES");
        console.log("Has loaded categories:", hasLoadedCategories);

        if (!hasLoadedCategories) {
          // Set default notification settings regardless of network status
          storage.set(
            "NOTIFICATION_SETTINGS",
            JSON.stringify([
              {
                notification_type: "BREAKING_NEWS",
                user_id: null,
                is_notification_enabled: true,
              },
              {
                notification_type: "COMMENT",
                user_id: null,
                is_notification_enabled: true,
              },
              {
                notification_type: "EARNING_OPPORTUNITY",
                user_id: null,
                is_notification_enabled: false,
              },
              {
                notification_type: "MISC",
                user_id: null,
                is_notification_enabled: false,
              },
            ])
          );
        }

        // Load categories in the background on every launch (including the first)
        // so slow/flaky networks never delay first paint. Consumers (e.g. NewsHome's
        // useMMKVObject("CATEGORIES")) pick up the value reactively once it arrives.
        loadCategories(!hasLoadedCategories)
          .then((success) => {
            if (success) {
              storage.set("HAS_LOADED_CATEGORIES", true);
            }
          })
          .catch((e) => {
            console.log("Background loading of categories failed:", e);
          });
      } catch (e) {
        console.warn("Error loading cached resources", e);
        if (isMounted) {
          setError(e as Error);
        }
      } finally {
        if (isMounted) {
          setLoadingComplete(true);
          console.log("Loading complete");
        }
      }
    }

    loadResourcesAndDataAsync();

    // Cleanup flag on unmount
    return () => {
      isMounted = false;
    };
  }, [loadCategories]);

  return { loadingComplete, error };
}
