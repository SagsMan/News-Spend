import type { Payload } from "payload";
import z from "zod";

import { publicProcedure } from "../index";
import { getRedis } from "../lib/redis";

const allStoreInput = z.object({
  page: z.number().nullish().default(1),
  limit: z.number().min(1).max(100).nullish().default(10),
  sortBy: z
    .enum(["popular", "newest", "cashback"])
    .optional()
    .default("popular"),
});

export type AllStoreInput = z.infer<typeof allStoreInput>;

const trackEventInput = z.object({
  storeId: z.string(),
  userId: z.string().optional(),
  device: z
    .enum(["mobile", "tablet", "desktop", "unknown"])
    .optional()
    .default("unknown"),
  platform: z.enum(["android", "ios", "web"]).optional().default("web"),
});

export type TrackEventInput = z.infer<typeof trackEventInput>;

const VIEW_WEIGHT = 0.3;
const CLICK_WEIGHT = 0.7;

const POPULARITY_KEY = "store:popularity";

async function incrementPopularityScore(
  storeId: string,
  type: "view" | "click",
  payload: Payload
) {
  const weight = type === "click" ? CLICK_WEIGHT : VIEW_WEIGHT;

  try {
    const redis = getRedis();
    const newScore = await redis.zincrby(POPULARITY_KEY, weight, storeId);

    await payload.update({
      collection: "partners",
      id: storeId,
      data: {
        popularityScore: newScore,
      },
    });
  } catch (error) {
    console.error("Error updating popularity score:", error);
  }
}

const trackView = publicProcedure
  .input(trackEventInput)
  .handler(async ({ input, context }) => {
    const { payload } = context;

    await payload.create({
      collection: "shop-analytics",
      data: {
        store: input.storeId,
        type: "view",
        userId: input.userId,
        device: input.device,
        platform: input.platform,
        timestamp: new Date().toISOString(),
      },
    });

    await incrementPopularityScore(input.storeId, "view", payload);

    return { success: true };
  });

const trackClick = publicProcedure
  .input(trackEventInput)
  .handler(async ({ input, context }) => {
    const { payload } = context;

    await payload.create({
      collection: "shop-analytics",
      data: {
        store: input.storeId,
        type: "click",
        userId: input.userId,
        device: input.device,
        platform: input.platform,
        timestamp: new Date().toISOString(),
      },
    });

    await incrementPopularityScore(input.storeId, "click", payload);

    return { success: true };
  });

async function getPopularStoreIds(limit: number): Promise<string[]> {
  try {
    const redis = getRedis();
    const ids = await redis.zrevrange(POPULARITY_KEY, 0, limit - 1);
    return ids;
  } catch (error) {
    console.error("Error fetching popular stores from Redis:", error);
    return [];
  }
}

const sortByMap = {
  popular: "-popularityScore",
  newest: "-createdAt",
  cashback: "-cashBack",
} as const;

const all = publicProcedure
  .input(allStoreInput)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const { page, limit, sortBy } = input;

    return await payload.find({
      collection: "partners",
      select: {
        id: true,
        websiteUrl: true,
        logo: true,
        description: true,
        cashBack: true,
        slug: true,
        companyName: true,
        createdAt: true,
      },
      where: {
        inShopTab: {
          equals: true,
        },
      },
      sort: sortByMap[sortBy || "popular"],
      limit: limit || 10,
      page: page || 1,
    });
  });

const popular = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).nullish().default(10),
    })
  )
  .handler(async ({ input, context }) => {
    const { payload } = context;

    const storeIds = await getPopularStoreIds(input.limit || 10);

    if (storeIds.length === 0) {
      return [];
    }

    const result = await payload.find({
      collection: "partners",
      select: {
        id: true,
        websiteUrl: true,
        logo: true,
        description: true,
        cashBack: true,
        slug: true,
        companyName: true,
      },
      where: {
        id: { in: storeIds },
        inShopTab: { equals: true },
      },
      pagination: false,
    });

    const idToDoc = new Map(result.docs.map((d) => [d.id, d]));
    return storeIds.map((id) => idToDoc.get(id)).filter(Boolean);
  });

const one = publicProcedure
  .input(z.object({ slug: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { payload } = context;
    const result = await payload.find({
      collection: "partners",
      select: {
        id: true,
        websiteUrl: true,
        logo: true,
        description: true,
        cashBack: true,
        slug: true,
        companyName: true,
      },
      where: {
        slug: {
          equals: input.slug,
        },
      },
      pagination: false,
    });

    if (result.docs.length === 0) {
      throw errors.NOT_FOUND({
        message: "Store not found",
      });
    }

    return result.docs[0];
  });

export const storeRouter = {
  all,
  popular,
  one,
  trackView,
  trackClick,
};
