/**
 * How long a recorded activity timestamp stands before it is worth writing
 * again.
 *
 * `lastActive` feeds segments measured in days ("active in the last 30"), so
 * resolution finer than an hour buys nothing and costs a row update on every
 * single authenticated request. An hour bounds the write rate to at most 24
 * per user per day while keeping every segment boundary exact.
 */
export const LAST_ACTIVE_WINDOW_SECONDS = 3600;

/** Per-process fallback used when Redis is unavailable. */
const localWindows = new Map<string, number>();

/**
 * Bound how large the in-process fallback can grow.
 *
 * Redis expires its own keys; a Map does not, and one entry per user would
 * grow without limit on a long-running server. When the cap is reached the
 * oldest half is dropped: those users simply become writable again sooner
 * than the window would otherwise allow, which costs one extra update.
 */
const MAX_LOCAL_ENTRIES = 10_000;

function markLocally(key: string, now: number): boolean {
  const until = localWindows.get(key);
  if (until !== undefined && until > now) {
    return false;
  }

  if (localWindows.size >= MAX_LOCAL_ENTRIES) {
    const entries = [...localWindows.entries()].sort((a, b) => a[1] - b[1]);
    for (const [staleKey] of entries.slice(0, Math.floor(entries.length / 2))) {
      localWindows.delete(staleKey);
    }
  }

  localWindows.set(key, now + LAST_ACTIVE_WINDOW_SECONDS * 1000);
  return true;
}

/**
 * Whether this user's activity should be written now.
 *
 * Deliberately fails *closed* onto a per-process window rather than open. An
 * open failure would turn a Redis outage into a database write on every
 * authenticated request, which is precisely the load a cache exists to
 * prevent. The fallback is per-instance, so several servers may each write
 * once per window; that is a handful of redundant updates, not a stampede.
 */
export async function shouldRecordActivity(
  userId: string,
  now: number = Date.now()
): Promise<boolean> {
  const key = `lastActive:${userId}`;

  if (!process.env.REDIS_URL) {
    return markLocally(key, now);
  }

  try {
    const { getRedis } = await import("./redis");
    /*
     * Sent as a raw command because the typed `set` overloads expose EX and
     * NX only separately, and splitting them into two round trips would open
     * a window where a key is created without a TTL. A key that never expires
     * is a user whose activity is never recorded again, so the atomic form is
     * worth the untyped call. Redis replies "OK" when this call claimed the
     * window and nil when a previous one still holds it.
     */
    const claimed = await getRedis().send("SET", [
      key,
      "1",
      "EX",
      String(LAST_ACTIVE_WINDOW_SECONDS),
      "NX",
    ]);
    return claimed !== null;
  } catch {
    return markLocally(key, now);
  }
}

/** Reset the in-process window. Exposed for tests, which share a module. */
export function resetLastActiveWindows(): void {
  localWindows.clear();
}
