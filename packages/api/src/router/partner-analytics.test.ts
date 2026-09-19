import { describe, expect, it, mock } from "bun:test";
import { call } from "@orpc/server";
import { format, subDays } from "date-fns";

import { createFakePayload, type Doc, mockContext } from "../test-utils";
import { partnerAnalyticsRouter } from "./partner-analytics";

const today = new Date();
const daysAgo = (n: number) => format(subDays(today, n), "yyyy-MM-dd");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function analyticsDoc(overrides: Doc = {}): Doc {
  return {
    id: `analytics-${Math.random().toString(36).slice(2, 8)}`,
    store: "store-1",
    type: "view",
    timestamp: today.toISOString(),
    ...overrides,
  };
}

describe("partnerAnalyticsRouter.overview", () => {
  it("returns zeroed stats when there are no analytics docs", async () => {
    const payload = createFakePayload({
      collections: { "shop-analytics": [] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.overview,
      { storeId: "store-1" },
      { context: ctx }
    );

    expect(result).toEqual({
      totalViews: 0,
      totalClicks: 0,
      clickThroughRate: 0,
      period: "7 days",
    });
  });

  it("aggregates views and clicks across multiple docs", async () => {
    const payload = createFakePayload({
      collections: {
        "shop-analytics": [
          analyticsDoc({ type: "view" }),
          analyticsDoc({ type: "view" }),
          analyticsDoc({ type: "click" }),
          analyticsDoc({ type: "view" }),
          analyticsDoc({ type: "click" }),
          analyticsDoc({ type: "click" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.overview,
      { storeId: "store-1" },
      { context: ctx }
    );

    expect(result.totalViews).toBe(3);
    expect(result.totalClicks).toBe(3);
    expect(result.clickThroughRate).toBe(100);
  });

  it("calculates click-through rate with rounding", async () => {
    const payload = createFakePayload({
      collections: {
        "shop-analytics": [
          analyticsDoc({ type: "view" }),
          analyticsDoc({ type: "view" }),
          analyticsDoc({ type: "click" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.overview,
      { storeId: "store-1" },
      { context: ctx }
    );

    // 1 click / 2 views = 0.5 → 50%
    expect(result.totalViews).toBe(2);
    expect(result.totalClicks).toBe(1);
    expect(result.clickThroughRate).toBe(50);
  });

  it("returns CTR of 0 when there are no views", async () => {
    const payload = createFakePayload({
      collections: {
        "shop-analytics": [analyticsDoc({ type: "click" })],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.overview,
      { storeId: "store-1" },
      { context: ctx }
    );

    expect(result.totalViews).toBe(0);
    expect(result.totalClicks).toBe(1);
    expect(result.clickThroughRate).toBe(0);
  });

  it("uses the provided days parameter in the period string", async () => {
    const payload = createFakePayload({
      collections: { "shop-analytics": [] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.overview,
      { storeId: "store-1", days: 30 },
      { context: ctx }
    );

    expect(result.period).toBe("30 days");
  });

  it("filters analytics to the requested store only", async () => {
    const payload = createFakePayload({
      collections: {
        "shop-analytics": [
          analyticsDoc({ store: "store-1", type: "view" }),
          analyticsDoc({ store: "store-2", type: "view" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.overview,
      { storeId: "store-1" },
      { context: ctx }
    );

    expect(result.totalViews).toBe(1);
  });
});

describe("partnerAnalyticsRouter.trends", () => {
  it("returns one entry per day with zero fill for missing days", async () => {
    const payload = createFakePayload({
      collections: { "shop-analytics": [] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.trends,
      { storeId: "store-1", days: 7 },
      { context: ctx }
    );

    expect(result).toHaveLength(7);
    for (const entry of result) {
      expect(entry.views).toBe(0);
      expect(entry.clicks).toBe(0);
      expect(entry.date).toMatch(DATE_RE);
    }
    // First entry is (days-1) days ago, last entry is today
    expect(result[0]?.date).toBe(daysAgo(6));
    expect(result[6]?.date).toBe(daysAgo(0));
  });

  it("groups analytics by date and fills gaps", async () => {
    const payload = createFakePayload({
      collections: {
        "shop-analytics": [
          analyticsDoc({
            type: "view",
            timestamp: subDays(today, 2).toISOString(),
          }),
          analyticsDoc({
            type: "view",
            timestamp: subDays(today, 2).toISOString(),
          }),
          analyticsDoc({
            type: "click",
            timestamp: subDays(today, 2).toISOString(),
          }),
          analyticsDoc({
            type: "view",
            timestamp: subDays(today, 5).toISOString(),
          }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.trends,
      { storeId: "store-1", days: 7 },
      { context: ctx }
    );

    expect(result).toHaveLength(7);
    // 2 days ago: 2 views, 1 click
    const twoDaysAgo = result.find((r) => r.date === daysAgo(2));
    expect(twoDaysAgo).toEqual({ date: daysAgo(2), views: 2, clicks: 1 });
    // 5 days ago: 1 view, 0 clicks
    const fiveDaysAgo = result.find((r) => r.date === daysAgo(5));
    expect(fiveDaysAgo).toEqual({ date: daysAgo(5), views: 1, clicks: 0 });
    // Today: 0
    const todayEntry = result.find((r) => r.date === daysAgo(0));
    expect(todayEntry).toEqual({ date: daysAgo(0), views: 0, clicks: 0 });
  });

  it("respects the days parameter", async () => {
    const payload = createFakePayload({
      collections: { "shop-analytics": [] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.trends,
      { storeId: "store-1", days: 3 },
      { context: ctx }
    );

    expect(result).toHaveLength(3);
    expect(result[0]?.date).toBe(daysAgo(2));
    expect(result[2]?.date).toBe(daysAgo(0));
  });
});

describe("partnerAnalyticsRouter.byStore", () => {
  it("returns stores ordered by redis popularity score", async () => {
    mock.module("../lib/redis", () => ({
      getRedis: () => ({
        zrevrange: async () => ["s2", "s1", "s3"],
      }),
    }));

    const payload = createFakePayload({
      collections: {
        partners: [
          {
            id: "s1",
            companyName: "Store One",
            slug: "store-one",
            inShopTab: true,
          },
          {
            id: "s2",
            companyName: "Store Two",
            slug: "store-two",
            inShopTab: true,
          },
          {
            id: "s3",
            companyName: "Store Three",
            slug: "store-three",
            inShopTab: true,
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.byStore,
      {},
      { context: ctx }
    );

    expect(result).toHaveLength(3);
    expect(result[0]?.store.id).toBe("s2");
    expect(result[1]?.store.id).toBe("s1");
    expect(result[2]?.store.id).toBe("s3");
    expect(result[0]?.score).toBe(0);
    expect(result[0]?.store.name).toBe("Store Two");
  });

  it("respects the limit parameter", async () => {
    mock.module("../lib/redis", () => ({
      getRedis: () => ({
        zrevrange: async () => ["s1", "s2", "s3"],
      }),
    }));

    const payload = createFakePayload({
      collections: {
        partners: [
          {
            id: "s1",
            companyName: "Store One",
            slug: "store-one",
            inShopTab: true,
          },
          {
            id: "s2",
            companyName: "Store Two",
            slug: "store-two",
            inShopTab: true,
          },
          {
            id: "s3",
            companyName: "Store Three",
            slug: "store-three",
            inShopTab: true,
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.byStore,
      { limit: 2 },
      { context: ctx }
    );

    expect(result).toHaveLength(2);
  });

  it("skips redis IDs that do not match a partner store", async () => {
    mock.module("../lib/redis", () => ({
      getRedis: () => ({
        zrevrange: async () => ["s1", "unknown", "s2"],
      }),
    }));

    const payload = createFakePayload({
      collections: {
        partners: [
          {
            id: "s1",
            companyName: "Store One",
            slug: "store-one",
            inShopTab: true,
          },
          {
            id: "s2",
            companyName: "Store Two",
            slug: "store-two",
            inShopTab: true,
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.byStore,
      {},
      { context: ctx }
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.store.id).toBe("s1");
    expect(result[1]?.store.id).toBe("s2");
  });

  it("returns empty array when redis returns empty list", async () => {
    mock.module("../lib/redis", () => ({
      getRedis: () => ({
        zrevrange: async () => [],
      }),
    }));

    const payload = createFakePayload({
      collections: {
        partners: [
          {
            id: "s1",
            companyName: "Store One",
            slug: "store-one",
            inShopTab: true,
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.byStore,
      {},
      { context: ctx }
    );

    expect(result).toEqual([]);
  });

  it("returns empty array when redis import fails", async () => {
    // When getRedis throws, the catch sets storeIds to [] and we get no results
    mock.module("../lib/redis", () => ({
      getRedis: () => {
        throw new Error("REDIS_URL is not configured");
      },
    }));

    const payload = createFakePayload({
      collections: {
        partners: [
          {
            id: "s1",
            companyName: "Store One",
            slug: "store-one",
            inShopTab: true,
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerAnalyticsRouter.byStore,
      {},
      { context: ctx }
    );

    expect(result).toEqual([]);
  });
});
