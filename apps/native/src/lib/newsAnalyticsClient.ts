import { AppState, type AppStateStatus, Platform } from "react-native";

import { storage } from "#/utils/storage";

import { client } from "./orpc";

const QUEUE_KEY = "news_analytics_queue";
const FLUSH_INTERVAL_MS = 10_000; // 10 seconds
const MAX_BATCH_SIZE = 50;

export type AnalyticsEvent = {
  articleId: string;
  event:
    | "impression"
    | "view"
    | "read"
    | "like"
    | "dislike"
    | "share"
    | "comment";
  sessionId: string;
  deviceId: string;
  platform: "android" | "ios" | "web";
  metadata?: {
    position?: number;
    screen?: string;
    timeSpent?: number;
    scrollDepth?: number;
    shareMethod?: string;
  };
  timestamp: string;
};

class NewsAnalyticsClient {
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;

  readonly platform: "android" | "ios" | "web" =
    Platform.OS === "android"
      ? "android"
      : Platform.OS === "ios"
        ? "ios"
        : "web";

  // --- Queue persistence via MMKV ---

  private loadQueue(): AnalyticsEvent[] {
    try {
      const raw = storage.getString(QUEUE_KEY);
      if (raw) {
        return JSON.parse(raw) as AnalyticsEvent[];
      }
    } catch {}
    return [];
  }

  private saveQueue(queue: AnalyticsEvent[]): void {
    try {
      storage.set(QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  }

  // --- Public API ---

  enqueue(event: Omit<AnalyticsEvent, "platform" | "timestamp">): void {
    const queue = this.loadQueue();
    queue.push({
      ...event,
      platform: this.platform,
      timestamp: new Date().toISOString(),
    });
    this.saveQueue(queue);
  }

  async flush(userId?: string): Promise<void> {
    const queue = this.loadQueue();
    if (queue.length === 0) {
      return;
    }

    // Take up to MAX_BATCH_SIZE events
    const batch = queue.splice(0, MAX_BATCH_SIZE);
    // Persist remaining events immediately
    this.saveQueue(queue);

    try {
      await client.news.analytics.track({ events: batch, userId });
    } catch {
      // On failure, prepend the batch back so nothing is lost
      const remaining = this.loadQueue();
      this.saveQueue([...batch, ...remaining]);
    }
  }

  // --- Lifecycle ---

  start(getUserId: () => string | undefined): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flush(getUserId());
    }, FLUSH_INTERVAL_MS);

    // Flush on app background
    this.appStateSubscription = AppState.addEventListener(
      "change",
      (state: AppStateStatus) => {
        if (state === "background" || state === "inactive") {
          this.flush(getUserId());
        }
      }
    );
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }
}

export const newsAnalyticsClient = new NewsAnalyticsClient();
