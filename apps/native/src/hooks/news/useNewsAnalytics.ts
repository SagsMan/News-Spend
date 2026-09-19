import { useCallback, useRef } from "react";
import { useSnapshot } from "valtio";

import { newsAnalyticsClient } from "#/lib/newsAnalyticsClient";
import { authState } from "#/state/auth";
import { storage } from "#/utils/storage";

// Stable device ID: generated once and persisted
function getOrCreateDeviceId(): string {
  const key = "news_analytics_device_id";
  const existing = storage.getString(key);
  if (existing) {
    return existing;
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.set(key, id);
  return id;
}

// Session ID: regenerated each app launch (kept in memory)
let sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function renewAnalyticsSession(): void {
  sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const deviceId = getOrCreateDeviceId();

type ArticleMeta = {
  id: string;
  slug?: string | null;
  category?: unknown;
};

export function useNewsAnalytics(article?: ArticleMeta) {
  const { user } = useSnapshot(authState);
  // Track impressions seen this session to avoid duplicate events
  const impressionsSeen = useRef<Set<string>>(new Set());

  const buildBase = useCallback(
    (articleId: string) => ({
      articleId,
      sessionId,
      deviceId,
    }),
    []
  );

  const trackImpression = useCallback(
    (item: ArticleMeta, position: number, screen: string) => {
      // Dedupe per session
      const key = `${item.id}:${screen}`;
      if (impressionsSeen.current.has(key)) {
        return;
      }
      impressionsSeen.current.add(key);

      newsAnalyticsClient.enqueue({
        ...buildBase(item.id),
        event: "impression",
        metadata: { position, screen },
      });
    },
    [buildBase]
  );

  const trackView = useCallback(() => {
    if (!article) {
      return;
    }
    newsAnalyticsClient.enqueue({
      ...buildBase(article.id),
      event: "view",
      metadata: { screen: "Article" },
    });
    // Flush immediately on explicit views
    newsAnalyticsClient.flush(user?.id);
  }, [article, buildBase, user?.id]);

  const trackRead = useCallback(
    (timeSpent: number, scrollDepth: number) => {
      if (!article) {
        return;
      }
      newsAnalyticsClient.enqueue({
        ...buildBase(article.id),
        event: "read",
        metadata: { timeSpent, scrollDepth, screen: "Article" },
      });
      newsAnalyticsClient.flush(user?.id);
    },
    [article, buildBase, user?.id]
  );

  const trackLike = useCallback(() => {
    if (!article) {
      return;
    }
    newsAnalyticsClient.enqueue({
      ...buildBase(article.id),
      event: "like",
      metadata: { screen: "Article" },
    });
  }, [article, buildBase]);

  const trackDislike = useCallback(() => {
    if (!article) {
      return;
    }
    newsAnalyticsClient.enqueue({
      ...buildBase(article.id),
      event: "dislike",
      metadata: { screen: "Article" },
    });
  }, [article, buildBase]);

  const trackShare = useCallback(
    (shareMethod: string) => {
      if (!article) {
        return;
      }
      newsAnalyticsClient.enqueue({
        ...buildBase(article.id),
        event: "share",
        metadata: { shareMethod, screen: "Article" },
      });
    },
    [article, buildBase]
  );

  const trackComment = useCallback(() => {
    if (!article) {
      return;
    }
    newsAnalyticsClient.enqueue({
      ...buildBase(article.id),
      event: "comment",
      metadata: { screen: "Article" },
    });
  }, [article, buildBase]);

  return {
    trackImpression,
    trackView,
    trackRead,
    trackLike,
    trackDislike,
    trackShare,
    trackComment,
  };
}
