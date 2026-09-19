import {
  enum_activities_action,
  enum_activities_type,
} from "@news-spend-media/payload/payload-generated-schema";
import { createORPCErrorConstructorMap } from "@orpc/contract";
import { isSameDay } from "date-fns";
import z from "zod";

import type { Context } from "../context";
import { commonErrors } from "../errors";

// `addActivity` runs outside a procedure's handler context, so it cannot use
// the `errors` factory that oRPC injects there. Build the same factories from
// the shared error map so thrown errors stay defined/inferable on the wire.
const errors = createORPCErrorConstructorMap(commonErrors);

const ActivityCreateInput = z.object({
  type: z.enum(enum_activities_type.enumValues).default("point"),
  point: z.number(),
  reward: z.string().optional(),
  description: z.string().optional(),
  action: z.enum(enum_activities_action.enumValues),
  newsId: z.string().optional(),
});

type ActivityCreateInputType = z.infer<typeof ActivityCreateInput>;

/**
 * Adds an activity for a user, handling special logic for "read" and "musicListeningTime" actions.
 * This function is intended for cross-module use.
 */
export async function addActivity(
  input: ActivityCreateInputType,
  ctx: Context
) {
  const { user, payload } = ctx;
  if (!user) {
    throw errors.UNAUTHORIZED();
  }

  const { newsId, ...rest } = input;

  if (rest.action === "read") {
    const reward = await payload.find({
      collection: "activities",
      where: {
        action: {
          equals: "read",
        },
        news: {
          equals: newsId,
        },
        user: {
          equals: user.id,
        },
      },
    });

    if (reward.docs.length > 0) {
      return {
        data: reward.docs[0],
        message: "ALREADY_READ",
      };
    }

    const dailyRead = user.dailyRead ?? {
      count: 0,
      updatedAt: new Date().toISOString(),
    };
    // @ts-expect-error
    const { count, updatedAt } = dailyRead;

    const isToday = isSameDay(
      new Date(),
      new Date(updatedAt ?? new Date().toISOString())
    );

    if (isToday && count! < 5) {
      await payload.update({
        collection: "users",
        id: user.id,
        data: {
          dailyRead: {
            count: count! + 1,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    } else if (!isToday) {
      await payload.update({
        collection: "users",
        id: user.id,
        data: {
          dailyRead: {
            count: 1,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  if (rest.action === "musicListeningTime") {
    const activity = await payload.find({
      collection: "activities",
      where: {
        user: {
          equals: user.id,
        },
        action: {
          equals: "musicListeningTime",
        },
        createdAt: {
          greater_than_equal: new Date().setHours(0, 0, 0, 0),
        },
      },
    });

    if (activity.totalDocs > 0) {
      return {
        data: activity.docs[0],
        message: "ALREADY_EXISTS",
      };
    }
  }

  if (rest.action === "connectBrandAd" || rest.action === "share") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cap = rest.action === "connectBrandAd" ? 8 : 5;

    const activities = await payload.find({
      collection: "activities",
      where: {
        user: {
          equals: user.id,
        },
        action: {
          equals: rest.action,
        },
        createdAt: {
          greater_than_equal: today.toISOString(),
        },
      },
    });

    if (activities.totalDocs >= cap) {
      return {
        message: "CAP_REACHED",
      };
    }
  }

  const result = await payload.create({
    collection: "activities",
    data: {
      ...rest,
      news: newsId,
      user: user.id,
    },
  });

  return result;
}
