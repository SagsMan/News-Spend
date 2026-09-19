import { openapi } from "@orpc/openapi";
import type { Where } from "payload";
import z from "zod";

import { protectedProcedure, publicProcedure } from "../..";
import { withCache } from "../../lib/cache";
import { createAdManager, DEFAULT_AD_CONFIG } from "./ad-manager";
import { newsAnalyticsRouter } from "./analytics";
import { getCommentCountForNews } from "./comment-counts";
import {
  fetchMainNews,
  fetchPromoMedia,
  fetchRelatedNews,
} from "./content-fetchers";
import {
  composeFeed,
  composeSimpleFeed,
  DEFAULT_FEED_CONFIG,
  type FeedComposerData,
} from "./feed-composer";
import { sanitizeContent } from "./sanitize-content";
import {
  getNewsReactionCounts,
  getUserReactionForNews,
  type UserReaction,
} from "./user-reaction";

// Input schemas
const HomeInputSchema = z.object({
  limit: z.number().min(1).max(100).nullish().default(10),
  page: z.number().nullish().default(1),
});

const AllInputSchema = z.object({
  limit: z.number().min(1).max(100).nullish().default(10),
  page: z.number().nullish().default(1),
  category: z.string().optional(),
  type: z.enum(["article", "video"]).optional().default("article"),
  includeAds: z.boolean().optional().default(true),
});

export type AllNewsInput = z.input<typeof AllInputSchema>;
export type HomeNewsInput = z.input<typeof HomeInputSchema>;

// Helper to build "where" clause
function buildWhere(input: AllNewsInput) {
  const where: Where = {
    type: { equals: input.type },
    _status: { equals: "published" },
  };
  if (input.category) {
    where.category = { equals: input.category };
  }
  return where;
}

const all = publicProcedure
  .input(AllInputSchema)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const where = buildWhere(input);

    // Fetch news items (depth 1, exclude heavy fields for list views)
    const data = await payload.find({
      collection: "news",
      where,
      limit: input.limit || 10,
      page: input.page || 1,
      depth: 1,
      select: { content: false, keyPoints: false },
    });

    // Only inject ads if input.includeAds is true (default: true)
    if (input.includeAds !== false) {
      // Create ad manager and compose simple feed with ads
      const adManager = await createAdManager(payload, DEFAULT_AD_CONFIG);
      const docsWithAds = composeSimpleFeed(data.docs, adManager, 4);

      return { ...data, docs: docsWithAds };
    }

    // If ads are not included, return plain news
    return data;
  });

const trending = publicProcedure
  .input(
    z
      .object({ limit: z.number().min(1).max(50).nullish().default(3) })
      .nullish()
  )
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const limit = input?.limit ?? 3;

    let cachedResult: any[] | null = null;

    // try redis first
    try {
      const { getRedis } = await import("../../lib/redis");
      const r = getRedis();
      const cached = await r.get("trending:news");
      if (cached) {
        const parsed = JSON.parse(cached) as { id: string; score: number }[];
        // Grab a larger pool to account for unpublished/drafted items
        const candidateIds = parsed.slice(0, limit * 3).map((p) => p.id);
        if (candidateIds.length) {
          const res = await payload.find({
            collection: "news",
            where: {
              id: { in: candidateIds },
              _status: { equals: "published" },
            },
            depth: 1,
            limit: candidateIds.length,
            pagination: false,
            select: { content: false, keyPoints: false },
          });
          // preserve score order from cache
          const docsById = new Map(res.docs.map((d) => [d.id, d]));
          const ordered = candidateIds
            .map((id) => docsById.get(id))
            .filter(Boolean);
          cachedResult = ordered.slice(0, limit);
        }
      }
    } catch {
      // ignore redis errors
    }

    if (cachedResult && cachedResult.length >= limit) {
      return cachedResult;
    }

    if (cachedResult && cachedResult.length > 0) {
      const remaining = limit - cachedResult.length;
      const news = await payload.find({
        collection: "news",
        limit: remaining,
        depth: 1,
        sort: "-createdAt",
        select: { content: false, keyPoints: false },
        where: {
          _status: { equals: "published" },
          id: { not_in: cachedResult.map((d: any) => d.id) },
        },
      });
      return [...cachedResult, ...news.docs];
    }

    const news = await payload.find({
      collection: "news",
      limit,
      depth: 1,
      sort: "-createdAt",
      select: { content: false, keyPoints: false },
      where: {
        _status: { equals: "published" },
      },
    });
    return news.docs;
  });

const recordView = publicProcedure
  .input(
    z.object({ newsId: z.string().optional(), slug: z.string().optional() })
  )
  .handler(async ({ input, context, errors }) => {
    const { payload, user, request } = context;
    if (!(input.newsId || input.slug)) {
      throw errors.BAD_REQUEST({
        message: "newsId or slug is required to record view",
      });
    }

    const where: Where = {};
    if (input.newsId) {
      where.id = { equals: input.newsId };
    }
    if (input.slug) {
      where.slug = { equals: input.slug };
    }
    where._status = { equals: "published" };

    const news = await payload.find({
      collection: "news",
      where,
      limit: 1,
      depth: 0,
    });
    const doc = news.docs[0];
    if (!doc) {
      throw errors.NOT_FOUND({
        message: "News not found",
      });
    }

    // determine dedupe key: prefer user id, fallback to IP header
    let dedupeKey = "";
    try {
      if (user?.id) {
        dedupeKey = `news:view:${doc?.id}:user:${user.id}`;
      } else {
        const hdr =
          request?.headers?.get?.("x-forwarded-for") ||
          request?.headers?.get?.("x-real-ip");
        const ip = hdr ? String(hdr).split(",")[0]?.trim() : "anonymous";
        dedupeKey = `news:view:${doc?.id}:ip:${ip}`;
      }
    } catch {
      // If header parsing fails, fallback to anonymous dedupe key
      dedupeKey = `news:view:${doc?.id}:anon`;
    }

    // TTL for dedupe key in seconds (default 24 hours)
    const ttl = Number(process.env.VIEW_DEDUPE_TTL_SECONDS ?? 86_400);

    let incremented = true;
    try {
      const { getRedis } = await import("../../lib/redis");
      const r = getRedis();
      // set key only if not exists
      // Bun returns 'OK' when set, null when not set
      // use EX and NX to atomically check-and-set
      const res = await r.set(dedupeKey, "1", "EX", String(ttl), "NX");
      if (res === null) {
        // already viewed recently, do not increment
        incremented = false;
      }
    } catch {
      // if redis not available, fall back to incrementing always
      incremented = true;
    }

    if (incremented) {
      // Raw SQL (not payload.update) on purpose: news is a drafts/versions
      // collection, and a normal update writes a new _news_v snapshot on
      // every call, meaning every article view was generating a junk
      // editorial-history entry. It was also a non-atomic read-then-write
      // (data: { views: (doc.views ?? 0) + 1 }), so concurrent viewers could
      // race and lose an increment. Raw SQL is a single atomic UPDATE and
      // bypasses Payload's hooks/versioning entirely. The one afterChange
      // hook on News (sendNotificationOnCreate) already no-ops on repeat
      // updates via doc.hasBeenPublished, so skipping it here changes nothing.
      const { sql } = await import("@payloadcms/db-postgres");
      const result = await payload.db.drizzle.execute(sql`
        UPDATE news SET views = COALESCE(views, 0) + 1
        WHERE id = ${doc.id}
        RETURNING views
      `);
      const updatedViews = (result.rows[0] as { views: number } | undefined)
        ?.views;
      return { ok: true, views: updatedViews ?? doc.views, incremented: true };
    }

    // not incremented due to dedupe
    return { ok: true, views: doc.views ?? 0, incremented: false };
  });

const home = publicProcedure
  .input(HomeInputSchema)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const limit = input?.limit || 12;
    const page = input?.page || 1;

    // 1. Fetch main news with cache (90s TTL), the heaviest query
    const news = await withCache(
      `news:home:${page}:${limit}`,
      { ttl: 90 },
      () =>
        fetchMainNews({
          payload,
          type: "article",
          limit,
          page,
        })
    );

    // 2. Fetch supporting data in parallel (lightweight, randomized per request)
    const [related, promotionMedia] = await Promise.all([
      fetchRelatedNews({ payload, limit: 3 }),
      fetchPromoMedia({ payload, limit: 1 }),
    ]);

    // 3. Initialize ad manager (pool is cached in Redis for 5 min)
    const adManager = await createAdManager(payload, DEFAULT_AD_CONFIG);

    // 4. Compose the feed using the feed composer (synchronous)
    const feedData: FeedComposerData = {
      mainNews: news.docs,
      relatedNews: related.docs,
      promotionMedia: promotionMedia.docs,
    };

    const composedFeed = composeFeed(adManager, feedData, DEFAULT_FEED_CONFIG);

    return { ...news, docs: composedFeed };
  });

const one = publicProcedure
  .input(
    z.object({
      slug: z.string(),
      type: z.string().optional().default("article"),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { payload, user } = context;
    const where: Where = {
      slug: { equals: input.slug },
      _status: { equals: "published" },
    };
    if (input.type === "video") {
      where.type = { equals: "video" };
    }
    const news = await payload.find({
      collection: "news",
      where,
      depth: 2,
      limit: 1,
      context: user?.id ? { userId: user.id } : undefined,
      // draft: false,
    });
    if (!news.docs.length) {
      throw errors.NOT_FOUND({
        message: "News not found",
      });
    }
    const doc = news.docs[0]!;
    const [userReaction, totalComments] = await Promise.all([
      getUserReactionForNews(payload, user?.id, doc.id),
      getCommentCountForNews(payload, doc.id),
    ]);
    return {
      ...doc,
      content: sanitizeContent(doc.content),
      userReaction,
      totalComments,
    };
  });

/**
 * Three random-ish published articles.
 *
 * Delegates to `fetchRelatedNews`, which picks a random page off a `count()`.
 * This handler used to do that itself with `pagination: false` and no
 * `select` — hydrating every published article, at Payload's default depth of
 * 2, purely to read `totalPages` off the result and throw the documents away.
 */
const relatedNews = publicProcedure
  .input(z.number().optional())
  .handler(async ({ context }) => {
    const { payload } = context;

    const items = await fetchRelatedNews({ payload, limit: 3 });
    let relatedDocs = items.docs;

    // A random page can land short on the last page; top up from the front.
    if (relatedDocs.length < 3) {
      const seen = new Set(relatedDocs.map((d) => d.id));
      const remainingItems = await payload.find({
        collection: "news",
        depth: 1,
        limit: 3,
        sort: "-createdAt",
        page: 1,
        where: { _status: { equals: "published" } },
        draft: false,
        select: { content: false, keyPoints: false },
      });
      for (const doc of remainingItems.docs) {
        if (relatedDocs.length >= 3) {
          break;
        }
        if (!seen.has(doc.id)) {
          relatedDocs = [...relatedDocs, doc];
          seen.add(doc.id);
        }
      }
    }

    return relatedDocs.slice(0, 3);
  });

const likeDislikeInput = z.object({
  newsId: z.string(),
  userId: z.string(),
  slug: z.string(),
});

/**
 * Shared response shape returned by like/dislike. The client uses this to
 * reconcile the optimistic cache write with server truth, so no refetch is needed,
 * so the icon doesn't get clobbered by a stale read.
 */
type ReactionResponse = {
  userReaction: UserReaction;
  likesCount: number;
  dislikesCount: number;
};

const like = protectedProcedure
  .input(likeDislikeInput)
  .handler(async ({ input, context }): Promise<ReactionResponse> => {
    const { payload } = context;
    const reaction = await payload.find({
      collection: "reactions",
      where: {
        and: [
          { "target.relationTo": { equals: "news" } },
          { "target.value": { equals: input.newsId } },
          { user: { equals: input.userId } },
        ],
      },
    });

    if (reaction.docs && reaction.docs.length > 0 && reaction.docs[0]) {
      const existing = reaction.docs[0];
      if (existing.type === "like") {
        await payload.delete({
          collection: "reactions",
          id: existing.id,
        });
      } else {
        await payload.update({
          collection: "reactions",
          where: { id: { equals: existing.id } },
          data: { type: "like" },
        });
      }
    } else {
      await payload.create({
        collection: "reactions",
        data: {
          target: { relationTo: "news", value: input.newsId },
          user: input.userId,
          type: "like",
        },
      });
    }

    const [counts, userReaction] = await Promise.all([
      getNewsReactionCounts(payload, input.newsId),
      getUserReactionForNews(payload, input.userId, input.newsId),
    ]);
    return { userReaction, ...counts };
  });

const dislike = protectedProcedure
  .input(likeDislikeInput)
  .handler(async ({ input, context }): Promise<ReactionResponse> => {
    const { payload } = context;
    const reaction = await payload.find({
      collection: "reactions",
      where: {
        and: [
          { "target.relationTo": { equals: "news" } },
          { "target.value": { equals: input.newsId } },
          { user: { equals: input.userId } },
        ],
      },
    });

    if (reaction.docs.length > 0 && reaction.docs[0]) {
      const existing = reaction.docs[0];
      if (existing.type === "dislike") {
        await payload.delete({
          collection: "reactions",
          id: existing.id,
        });
      } else {
        await payload.update({
          collection: "reactions",
          where: { id: { equals: existing.id } },
          data: { type: "dislike" },
        });
      }
    } else {
      await payload.create({
        collection: "reactions",
        data: {
          target: { relationTo: "news", value: input.newsId },
          user: input.userId,
          type: "dislike",
        },
      });
    }

    const [counts, userReaction] = await Promise.all([
      getNewsReactionCounts(payload, input.newsId),
      getUserReactionForNews(payload, input.userId, input.newsId),
    ]);
    return { userReaction, ...counts };
  });

const categories = publicProcedure
  .meta(
    openapi({
      method: "GET",
      path: "/news/categories",
      tags: ["news"],
      summary: "Get all news categories",
    })
  )
  .handler(async ({ context }) => {
    const { payload } = context;
    const result = await payload.findGlobal({
      slug: "news-category",
      populate: {
        categories: {
          title: true,
          slug: true,
        },
      },
    });

    return result.items || [];
  });

export const newsRouter = {
  all,
  trending,
  recordView,
  one,
  home,
  relatedNews,
  like,
  dislike,
  categories,
  analytics: newsAnalyticsRouter,
};
