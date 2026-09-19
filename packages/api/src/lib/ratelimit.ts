import { type RateLimiter, ratelimit } from "@orpc/ratelimit";

/**
 * Resolve the limiter backend lazily so only the adapter matching the current
 * environment is loaded: `@orpc/bun` (Redis) when REDIS_URL is configured,
 * otherwise the in-memory fallback for local dev.
 */
async function loadDefaultLimiterFactory(): Promise<
  (maxRequests: number, window: number) => RateLimiter
> {
  if (process.env.REDIS_URL) {
    const { BunRedisRateLimiter } = await import("@orpc/bun");
    const { redis } = await import("bun");
    return (maxRequests, window) =>
      new BunRedisRateLimiter(redis, { maxRequests, window });
  }

  const { MemoryRateLimiter } = await import("@orpc/ratelimit/memory");
  return (maxRequests, window) =>
    new MemoryRateLimiter({ maxRequests, window });
}

const createDefaultLimiter = await loadDefaultLimiterFactory();

export function createRateLimitMiddleware(options?: {
  limiter?: RateLimiter;
  maxRequests?: number;
  window?: number;
  /**
   * Namespaces the bucket, so this middleware's budget is its own.
   *
   * Without one, every rate-limited procedure shares a single counter per
   * caller: the default is 10 requests a minute, so a client that spends it
   * on one endpoint is locked out of all the others, and adding a limit to a
   * new procedure silently tightens every existing one. Omit for the shared
   * default bucket; pass a name for anything wanting its own allowance.
   */
  name?: string;
}) {
  const maxRequests = options?.maxRequests ?? 10;
  const window = options?.window ?? 60_000;
  const limiter = options?.limiter ?? createDefaultLimiter(maxRequests, window);
  const prefix = options?.name ? `${options.name}:` : "";

  return ratelimit({
    limiter,
    key: ({ context }) => {
      if (process.env.NODE_ENV === "development") {
        return `${prefix}dev-mode`;
      }

      if (context.user) {
        return `${prefix}user:${context.user.id}`;
      }

      const ip =
        context.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        context.request.headers.get("cf-connecting-ip") ||
        "unknown";
      return `${prefix}anon:${ip}`;
    },
  });
}

export const rateLimitMiddleware = createRateLimitMiddleware();

/**
 * A dedicated bucket for the tweet proxy.
 *
 * It calls Twitter with our server as the egress, so it needs a ceiling — but
 * it is a content-rendering call, not a write, and it should not eat into the
 * allowance a reader needs for reporting content or posting a comment.
 */
export const tweetRateLimitMiddleware = createRateLimitMiddleware({
  name: "tweet",
  maxRequests: 30,
});
