import {
  activities,
  enum_activities_action,
  enum_activities_type,
} from "@news-spend-media/payload/payload-generated-schema";
import { eq, sum } from "@payloadcms/db-postgres/drizzle";
import type { Where } from "payload";
import z from "zod";

import { protectedNoGuestProcedure, protectedProcedure } from "../index";
import { addActivity as sharedAddActivity } from "../shared/activity";

const ActivityCreateInput = z.object({
  type: z.enum(enum_activities_type.enumValues).default("point"),
  point: z.number(),
  reward: z.string().optional(),
  description: z.string().optional(),
  action: z.enum(enum_activities_action.enumValues),
  newsId: z.string().optional(),
});

const ActivityByUserId = z.object({
  category: z
    .enum(["all", "shopping-and-purchase", "referrals", "reward-history"])
    .default("all"),
  startDate: z
    .string()
    .optional()
    .default(() => new Date().toISOString().substring(0, 10)),
  endDate: z
    .string()
    .optional()
    .default(() =>
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
    ),
  type: z.enum(["visited", "posted", "pending"]).default("visited"),
  page: z.number().nullish().default(1),
  limit: z.number().min(1).max(100).nullish().default(10),
});

const addActivity = protectedNoGuestProcedure
  .input(ActivityCreateInput)
  .handler(async ({ input, context }) => sharedAddActivity(input, context));

const totalPoints = protectedProcedure.handler(async ({ context }) => {
  const { user, payload } = context;
  const query = await payload.db.drizzle
    .select({
      totalPoints: sum(activities.point).mapWith(Number),
    })
    .from(activities)
    .where(eq(activities.user, user.id));

  return query[0]?.totalPoints ?? 0;
});

const byUserId = protectedProcedure
  .input(ActivityByUserId)
  .handler(async ({ input, context }) => {
    const { user, payload } = context;
    if (
      (input.category !== "all" && input.category !== "reward-history") ||
      input.type !== "posted"
    ) {
      return {
        docs: [],
        totalDocs: 0,
        limit: 10,
        page: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
        prevPage: null,
        nextPage: null,
        pagingCounter: 0,
      };
    }
    const result = await payload.find({
      collection: "activities",
      where: {
        user: {
          equals: user.id,
        },
        ...(input.startDate && input.endDate
          ? {
              createdAt: {
                greater_than: input.startDate,
                less_than: input.endDate,
              },
            }
          : {}),
      },
      sort: "-createdAt",
      limit: input.limit || 10,
      page: input.page || 1,
    });

    return result;
  });

const byNewsId = protectedProcedure
  .input(
    z.object({
      newsId: z.string(),
      action: ActivityCreateInput.shape.action.optional(),
    })
  )
  .handler(async ({ input, context }) => {
    const { user, payload } = context;
    const { newsId, action } = input;
    const where: Where = {
      news: {
        equals: newsId,
      },
      user: {
        equals: user.id,
      },
    };
    if (action) {
      where.action = {
        equals: action,
      };
    }
    const result = await payload.find({
      collection: "activities",
      where,
    });

    return result.docs;
  });

export const activityRouter = {
  add: addActivity,
  totalPoints,
  byUserId,
  byNewsId,
};
