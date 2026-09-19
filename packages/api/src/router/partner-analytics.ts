import { format, subDays } from "date-fns";
import type { Payload } from "payload";
import z from "zod";

import { publicProcedure } from "../index";

const partnerAnalyticsInput = z.object({
  storeId: z.string(),
  days: z.number().min(1).max(90).nullish().default(7),
});

async function getAnalyticsForStore(
  payloadCtx: Payload,
  storeId: string,
  daysBack: number
) {
  const startDate = subDays(new Date(), daysBack);

  const result = await payloadCtx.find({
    collection: "shop-analytics",
    where: {
      store: { equals: storeId },
      timestamp: { greater_than_equal: startDate.toISOString() },
    },
    pagination: false,
  });

  let views = 0;
  let clicks = 0;
  const dailyStats: Record<string, { views: number; clicks: number }> = {};

  for (const doc of result.docs) {
    const docData = doc;
    const dateKey = format(new Date(docData.timestamp), "yyyy-MM-dd");
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = { views: 0, clicks: 0 };
    }

    if (docData.type === "view") {
      views += 1;
      dailyStats[dateKey].views += 1;
    } else if (docData.type === "click") {
      clicks += 1;
      dailyStats[dateKey].clicks += 1;
    }
  }

  return { views, clicks, dailyStats };
}

const overview = publicProcedure
  .input(partnerAnalyticsInput)
  .handler(async ({ input, context }) => {
    const { storeId, days } = input;
    const { payload } = context;

    const stats = await getAnalyticsForStore(payload, storeId, days || 7);

    return {
      totalViews: stats.views,
      totalClicks: stats.clicks,
      clickThroughRate:
        stats.views > 0
          ? Math.round((stats.clicks / stats.views) * 100 * 100) / 100
          : 0,
      period: `${days || 7} days`,
    };
  });

const trends = publicProcedure
  .input(partnerAnalyticsInput)
  .handler(async ({ input, context }) => {
    const { storeId, days } = input;
    const { payload } = context;
    const daysBack = days || 7;

    const stats = await getAnalyticsForStore(payload, storeId, daysBack);

    const trendData = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateKey = format(date, "yyyy-MM-dd");
      trendData.push({
        date: dateKey,
        views: stats.dailyStats[dateKey]?.views || 0,
        clicks: stats.dailyStats[dateKey]?.clicks || 0,
      });
    }

    return trendData;
  });

const byStore = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).nullish().default(10),
    })
  )
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const limit = input.limit || 10;

    const stores = await payload.find({
      collection: "partners",
      select: {
        id: true,
        companyName: true,
        slug: true,
      },
      where: {
        inShopTab: { equals: true },
      },
      limit: 50,
      pagination: false,
    });

    let storeIds: string[] = [];
    try {
      const { getRedis } = await import("../lib/redis");
      const redis = getRedis();
      storeIds = await redis.zrevrange("store:popularity", 0, -1);
    } catch (error) {
      console.error("Error fetching popularity from Redis:", error);
    }

    const idToStore = new Map(stores.docs.map((s) => [s.id, s]));
    return storeIds
      .map((id) => idToStore.get(id))
      .filter(Boolean)
      .slice(0, limit)
      .map((store) => ({
        store: {
          id: store?.id,
          name: store?.companyName,
          slug: store?.slug,
        },
        score: 0,
      }));
  });

export const partnerAnalyticsRouter = {
  overview,
  trends,
  byStore,
};
