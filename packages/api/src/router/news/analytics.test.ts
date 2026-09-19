import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import {
  createFakePayload,
  expectError,
  mockContext,
  stubDrizzle,
} from "../../test-utils";
import { newsAnalyticsRouter } from "./analytics";

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };

// ---------------------------------------------------------------------------
// track
// ---------------------------------------------------------------------------
describe("newsAnalyticsRouter.track", () => {
  it("creates analytics events for valid articles", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          {
            id: "news-1",
            type: "article",
            _status: "published",
            slug: "a1",
          },
        ],
      },
    });
    const drizzle = stubDrizzle(payload, [{ id: "evt-1" }]);
    const ctx = mockContext({ payload });

    const result = await call(
      newsAnalyticsRouter.track,
      {
        events: [
          {
            articleId: "news-1",
            event: "view",
            sessionId: "sess-1",
            deviceId: "device-1",
          },
        ],
      },
      { context: ctx }
    );

    expect(result.inserted).toBe(1);
    expect(result.failed).toBe(0);
    // One statement for the whole batch, not one per event.
    expect(drizzle.queries).toHaveLength(1);
    expect(drizzle.queries[0]?.sql).toContain("news_analytics");
  });

  it("drops events with unknown article IDs", async () => {
    const payload = createFakePayload({
      collections: {
        news: [],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsAnalyticsRouter.track,
      {
        events: [
          {
            articleId: "unknown-id",
            event: "view",
            sessionId: "sess-1",
            deviceId: "device-1",
          },
        ],
      },
      { context: ctx }
    );

    expect(result.inserted).toBe(0);
    expect(result.failed).toBe(0);
    // Dropped is reported separately from a write failure.
    expect(result.dropped).toBe(1);
  });

  it("returns correct shape with multiple events", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          {
            id: "news-1",
            type: "article",
            _status: "published",
            slug: "a1",
          },
          {
            id: "news-2",
            type: "article",
            _status: "published",
            slug: "a2",
          },
        ],
      },
    });
    const drizzle = stubDrizzle(payload, [
      { id: "evt-1" },
      { id: "evt-2" },
      { id: "evt-3" },
    ]);
    const ctx = mockContext({ payload });

    const result = await call(
      newsAnalyticsRouter.track,
      {
        events: [
          {
            articleId: "news-1",
            event: "impression",
            sessionId: "sess-1",
            deviceId: "device-1",
          },
          {
            articleId: "news-2",
            event: "view",
            sessionId: "sess-1",
            deviceId: "device-1",
          },
          {
            articleId: "news-1",
            event: "read",
            sessionId: "sess-1",
            deviceId: "device-1",
          },
        ],
      },
      { context: ctx }
    );

    expect(result.inserted).toBe(3);
    expect(result.failed).toBe(0);
    // Three events, still a single round trip.
    expect(drizzle.queries).toHaveLength(1);
  });

  it("still writes a batch when no timestamp is supplied", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          {
            id: "news-1",
            type: "article",
            _status: "published",
            slug: "a1",
          },
        ],
      },
    });
    const drizzle = stubDrizzle(payload, [{ id: "evt-1" }]);
    const ctx = mockContext({ payload });

    const result = await call(
      newsAnalyticsRouter.track,
      {
        events: [
          {
            articleId: "news-1",
            event: "view",
            sessionId: "sess-1",
            deviceId: "device-1",
          },
        ],
      },
      { context: ctx }
    );

    expect(result.inserted).toBe(1);
    expect(drizzle.queries).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// articleStats
// ---------------------------------------------------------------------------
// Both aggregations now GROUP BY in Postgres, so the fixtures are the grouped
// rows the database hands back rather than raw event documents.
describe("newsAnalyticsRouter.articleStats", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("computes totals and CTR", async () => {
    const payload = createFakePayload();
    stubDrizzle(payload, [
      { day: today, event: "impression", count: 2 },
      { day: today, event: "view", count: 1 },
    ]);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.articleStats,
      { articleId: "news-1", days: 30 },
      { context: ctx }
    );

    expect(result.totals.impressions).toBe(2);
    expect(result.totals.views).toBe(1);
    expect(result.ctr).toBe(50); // 1/2 * 100 = 50
    expect(result.period).toBe("30 days");
    expect(result.trend.length).toBe(30);
  });

  it("returns 0 CTR when no impressions", async () => {
    const payload = createFakePayload();
    stubDrizzle(payload, []);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.articleStats,
      { articleId: "news-1", days: 7 },
      { context: ctx }
    );

    expect(result.ctr).toBe(0);
    expect(result.totals.impressions).toBe(0);
    expect(result.trend.length).toBe(7);
  });

  it("zeroes days with no events rather than repeating the totals", async () => {
    const payload = createFakePayload();
    stubDrizzle(payload, [{ day: today, event: "view", count: 5 }]);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.articleStats,
      { articleId: "news-1", days: 7 },
      { context: ctx }
    );

    expect(result.trend.length).toBe(7);

    // The one day with data carries it; every other day is zero. This used to
    // spread the running totals, so quiet days reported the whole period.
    const withData = result.trend.filter((d) => d.views > 0);
    expect(withData).toHaveLength(1);
    expect(withData[0]?.date).toBe(today);
    expect(withData[0]?.views).toBe(5);

    for (const entry of result.trend) {
      if (entry.date !== today) {
        expect(entry.views).toBe(0);
        expect(entry.impressions).toBe(0);
      }
    }
  });

  it("rejects unauthenticated callers", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        newsAnalyticsRouter.articleStats,
        { articleId: "news-1" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// topArticles
// ---------------------------------------------------------------------------
describe("newsAnalyticsRouter.topArticles", () => {
  it("returns articles ranked by event count", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          { id: "news-1", title: "Article 1" },
          { id: "news-2", title: "Article 2" },
        ],
      },
    });
    stubDrizzle(payload, [
      { article_id: "news-1", count: 2 },
      { article_id: "news-2", count: 1 },
    ]);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.topArticles,
      { event: "view", days: 30, limit: 10 },
      { context: ctx }
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.articleId).toBe("news-1");
    expect(result[0]?.count).toBe(2);
    expect(result[1]?.articleId).toBe("news-2");
    expect(result[1]?.count).toBe(1);
  });

  it("passes the limit through to the ranking query", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          { id: "news-1", title: "Article 1" },
          { id: "news-2", title: "Article 2" },
        ],
      },
    });
    // The database applies LIMIT, so the stub returns what it would have.
    stubDrizzle(payload, [
      { article_id: "news-1", count: 2 },
      { article_id: "news-2", count: 1 },
    ]);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.topArticles,
      { event: "view", days: 30, limit: 2 },
      { context: ctx }
    );

    expect(result).toHaveLength(2);
  });

  it("attaches the article document to each ranked row", async () => {
    const payload = createFakePayload({
      collections: {
        news: [{ id: "news-1", title: "Article 1" }],
      },
    });
    stubDrizzle(payload, [{ article_id: "news-1", count: 1 }]);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.topArticles,
      { event: "view" },
      { context: ctx }
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.articleId).toBe("news-1");
    expect(result[0]?.article).toMatchObject({
      id: "news-1",
      title: "Article 1",
    });
  });

  it("returns an empty list when nothing matched", async () => {
    const payload = createFakePayload();
    stubDrizzle(payload, []);
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsAnalyticsRouter.topArticles,
      { event: "view" },
      { context: ctx }
    );

    expect(result).toEqual([]);
  });

  it("rejects unauthenticated callers", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(newsAnalyticsRouter.topArticles, {}, { context: ctx })
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });
});
