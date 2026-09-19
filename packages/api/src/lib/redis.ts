import { RedisClient } from "bun";

let client: RedisClient | null = null;

export function getRedis() {
  if (client) {
    return client;
  }
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }
  // Bun's RedisClient rejects commands with errors instead of emitting
  // unhandled "error" events, so no crash-on-error handler is needed.
  client = new RedisClient(url);
  return client;
}

export function disconnectRedis() {
  if (!client) {
    return;
  }
  try {
    client.close();
  } catch {
    // ignore
  }
  client = null;
}
