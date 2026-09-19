import { BunRedisPublisher } from "@orpc/bun";
import type { Publisher } from "@orpc/publisher";
import { MemoryPublisher } from "@orpc/publisher/memory";
import { redis } from "bun";

type PublisherEvents = Record<string, { id: string; message: string }>;

/**
 * Cross-process event publisher backed by Bun's built-in Redis when
 * REDIS_URL is configured, falling back to in-memory for local dev.
 */
export const publisher: Publisher<PublisherEvents> = process.env.REDIS_URL
  ? new BunRedisPublisher<PublisherEvents>(redis)
  : new MemoryPublisher<PublisherEvents>();
