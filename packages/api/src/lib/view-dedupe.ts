export async function tryMarkView(
  redisClient: any,
  key: string,
  ttlSeconds: number
) {
  if (!redisClient) {
    return true; // no redis => optimistic increment
  }
  try {
    // Bun redis: set with NX returns 'OK' if set, null if not set
    // support both callback signatures
    const res = await redisClient.set(key, "1", "EX", ttlSeconds, "NX");
    if (res === null) {
      return false;
    }
    return true;
  } catch {
    // if redis errors, allow increment so we don't block views
    return true;
  }
}
