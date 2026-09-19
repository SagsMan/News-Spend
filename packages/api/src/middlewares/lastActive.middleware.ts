import { os } from "@orpc/server";

import type { Context } from "../context";
import { commonErrors } from "../errors";
import { shouldRecordActivity } from "../lib/lastActive";

/**
 * Record that a signed-in reader used the app.
 *
 * `users.lastActive` existed and was queried by notification segments, but
 * nothing ever wrote it, so "active users" and "inactive users" both matched
 * nobody. This is the writer.
 *
 * Placed on the authenticated procedures rather than on a single "I'm here"
 * endpoint, because activity is what the reader *does*: an endpoint the app
 * has to remember to call is one that stops being called the moment a screen
 * is rewritten, and the segment silently empties again.
 *
 * The timestamp is stored as a UTC instant, so a 30-day boundary means the
 * same thing for a reader in Lagos and one in Toronto.
 */
export const recordLastActive = os
  .$context<Context>()
  .errors(commonErrors)
  .middleware(async ({ context, next }) => {
    const result = await next();

    const userId = context.user?.id;
    if (!userId) {
      return result;
    }

    /*
     * Deliberately not awaited. Marking activity is bookkeeping, not part of
     * what the caller asked for, and a reader should never wait on it or see
     * a request fail because of it. Errors are swallowed for the same reason:
     * the worst case is one stale timestamp.
     */
    const record = async () => {
      try {
        if (!(await shouldRecordActivity(userId))) {
          return;
        }

        await context.payload.update({
          collection: "users",
          id: userId,
          data: { lastActive: new Date().toISOString() },
          overrideAccess: true,
        });
      } catch (error) {
        context.payload.logger.error(
          { err: error, userId },
          "[lastActive] could not record activity"
        );
      }
    };

    record();

    return result;
  });
