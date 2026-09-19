/**
 * Generic Redis caching utilities.
 *
 * All functions gracefully degrade: if Redis is unavailable or errors occur,
 * the fallback function is called and the result is returned uncached.
 */

type CacheOptions = {
  /** TTL in seconds */
  ttl: number;
  /** Optional prefix for logging / debugging */
  label?: string;
};

/**
 * Read-through cache wrapper.
 *
 * 1. Try to read `key` from Redis
 * 2. If hit, return parsed JSON
 * 3. If miss, call `fn()`, store the result with TTL, and return it
 * 4. If Redis is unavailable at any point, just call `fn()` directly
 *
 * @example
 * const data = await withCache("news:home:1:10", { ttl: 90 }, async () => {
 *   return await fetchMainNews({ payload, limit: 10, page: 1 });
 * });
 */
export async function withCache<T>(
  key: string,
  options: CacheOptions,
  fn: () => Promise<T>
): Promise<T> {
  // Try to read from cache
  try {
    const { getRedis } = await import("./redis");
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis unavailable or parse error: fall through to fn()
  }

  // Cache miss or Redis error: execute the function
  const result = await fn();

  // Try to write to cache (fire-and-forget)
  try {
    const { getRedis } = await import("./redis");
    const redis = getRedis();
    await redis.set(key, JSON.stringify(result), "EX", options.ttl);
  } catch {
    // Ignore write errors: data is still returned from fn()
  }

  return result;
}

/**
 * Invalidate a cache key (or keys matching a pattern).
 *
 * @param keyOrPattern - Exact key or glob pattern (e.g. "news:home:*")
 */
export async function invalidateCache(keyOrPattern: string): Promise<void> {
  try {
    const { getRedis } = await import("./redis");
    const redis = getRedis();

    if (keyOrPattern.includes("*")) {
      // Pattern-based invalidation using SCAN (non-blocking)
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          keyOrPattern,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } else {
      await redis.del(keyOrPattern);
    }
  } catch {
    // Ignore: cache invalidation is best-effort
  }
}
