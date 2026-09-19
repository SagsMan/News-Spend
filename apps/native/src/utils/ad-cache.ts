import type { NativeAd } from "react-native-google-mobile-ads";

const AD_TTL_MS = 60 * 60 * 1000;

type CacheEntry = {
  ad: NativeAd;
  cachedAt: number;
};

const cache = new Map<string, CacheEntry>();

const makeKey = (tab: string | undefined, id: string) =>
  `${tab ?? "default"}:${id}`;

/**
 * Release a cached ad's native resources.
 *
 * A NativeAd holds a reference on the native side that outlives the JS
 * object, so dropping an entry from this Map is not enough on its own —
 * evicted and cleared ads used to leak. `destroy` is best-effort: an ad that
 * has already been torn down natively throws rather than no-oping.
 */
const releaseAd = (ad: NativeAd) => {
  try {
    ad.destroy();
  } catch {
    // Already destroyed, or the native view is gone. Nothing to release.
  }
};

export const getCachedAd = (
  tab: string | undefined,
  id: string
): NativeAd | null => {
  const key = makeKey(tab, id);
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.cachedAt > AD_TTL_MS) {
    cache.delete(key);
    releaseAd(entry.ad);
    return null;
  }
  return entry.ad;
};

export const setCachedAd = (
  tab: string | undefined,
  id: string,
  ad: NativeAd
) => {
  const key = makeKey(tab, id);
  // Replacing an entry orphans whatever it held.
  const previous = cache.get(key);
  if (previous && previous.ad !== ad) {
    releaseAd(previous.ad);
  }
  cache.set(key, { ad, cachedAt: Date.now() });
};

export const clearTabAdCache = (tab: string) => {
  for (const [key, entry] of cache) {
    if (key.startsWith(`${tab}:`)) {
      cache.delete(key);
      releaseAd(entry.ad);
    }
  }
};
