import z from "zod";

import { protectedNoGuestProcedure } from "../index";
import { createRateLimitMiddleware } from "../lib/ratelimit";

// Each block also writes a contentReports row to notify admins, so an
// unthrottled block endpoint is a direct path to flooding the moderation queue.
const blockRateLimit = () =>
  createRateLimitMiddleware({ maxRequests: 10, window: 60_000 });

/**
 * A unique index on (blocker, blocked) makes a duplicate block a database
 * error rather than something to guard against in application code. Postgres
 * reports it as 23505; the adapter may surface it wrapped, so the code is
 * matched anywhere in the error rather than at a fixed path.
 */
function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23505") {
    return true;
  }
  if (candidate.cause) {
    return isUniqueViolation(candidate.cause);
  }
  return /duplicate key value|23505/i.test(String((error as Error).message));
}

const blockUser = protectedNoGuestProcedure
  .use(blockRateLimit())
  .input(z.object({ userId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const { user, payload } = context;

    if (input.userId === user.id) {
      throw errors.BAD_REQUEST({
        message: "You cannot block yourself",
      });
    }

    try {
      await payload.create({
        collection: "userBlocks",
        data: { blocker: user.id, blocked: input.userId },
      });
    } catch (error) {
      // Already blocked; treat as success so a double tap is harmless.
      if (isUniqueViolation(error)) {
        return { success: true, alreadyBlocked: true };
      }
      throw error;
    }

    await payload.create({
      collection: "contentReports",
      data: {
        type: "block",
        reason: "other",
        additionalDetails: `User ${input.userId} blocked by user ${user.id}`,
        reportedBy: user.id,
        status: "pending",
      },
    });

    return { success: true };
  });

const unblockUser = protectedNoGuestProcedure
  .use(blockRateLimit())
  .input(z.object({ userId: z.string() }))
  .handler(async ({ input, context }) => {
    const { user, payload } = context;

    const deleted = await payload.delete({
      collection: "userBlocks",
      where: {
        and: [
          { blocker: { equals: user.id } },
          { blocked: { equals: input.userId } },
        ],
      },
    });

    if (deleted.docs.length === 0) {
      return { success: true, notBlocked: true };
    }

    return { success: true };
  });

const getBlockedUsersInput = z.object({
  page: z.number().min(1).nullish().default(1),
  limit: z.number().min(1).max(100).nullish().default(20),
});

export type GetBlockedUsersInput = z.infer<typeof getBlockedUsersInput>;

const getBlockedUsers = protectedNoGuestProcedure
  .input(getBlockedUsersInput)
  .handler(async ({ input, context }) => {
    const { user, payload } = context;

    const blocks = await payload.find({
      collection: "userBlocks",
      where: { blocker: { equals: user.id } },
      select: {
        blocked: true,
        createdAt: true,
      },
      sort: "-createdAt",
      depth: 1,
      limit: input.limit ?? 20,
      page: input.page ?? 1,
    });

    const blockedUsers = blocks.docs
      .map((doc) => {
        const blocked = doc.blocked;
        if (!blocked || typeof blocked !== "object") {
          return null;
        }
        const { id, username } = blocked;
        if (!id) {
          return null;
        }
        return {
          id,
          username: username ?? "",
          blockedAt: (doc as { createdAt?: string }).createdAt ?? null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return {
      blockedUsers,
      // `nextPage` is what the client's infinite-query pattern reads as its
      // cursor; the rest is for rendering counts and empty states.
      page: blocks.page ?? 1,
      nextPage: blocks.hasNextPage ? blocks.nextPage : undefined,
      hasNextPage: blocks.hasNextPage,
      totalDocs: blocks.totalDocs,
      totalPages: blocks.totalPages,
    };
  });

export const blockRouter = {
  blockUser,
  unblockUser,
  getBlockedUsers,
};
