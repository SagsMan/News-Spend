import { sql } from "@payloadcms/db-postgres";
import type { TaskConfig } from "payload";

/**
 * Payload job task: cleanupAnonymousUsers
 *
 * Deletes anonymous users who:
 * 1. Were created more than 1 day ago
 * 2. Have no active sessions (all sessions expired)
 *
 * Runs automatically every day at midnight via the 'maintenance' queue.
 * Deletion goes through payload.delete with overrideAccess which triggers
 * the Users collection beforeDelete hook for push_tokens + activities cleanup.
 */
export const cleanupAnonymousUsersTask: TaskConfig<"cleanupAnonymousUsers"> = {
  slug: "cleanupAnonymousUsers",
  schedule: [
    {
      // Run every day at 3 AM
      cron: "0 3 * * *",
      queue: "maintenance",
    },
  ],
  outputSchema: [
    {
      name: "deletedCount",
      type: "number",
    },
  ],
  retries: 1,
  handler: async ({ req }) => {
    const { payload } = req;
    const logger = payload.logger;

    logger.info("Starting anonymous user cleanup");

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { docs: anonUsers } = await payload.find({
      collection: "users",
      where: {
        isAnonymous: { equals: true },
        createdAt: { less_than: oneDayAgo.toISOString() },
      },
      limit: 1000,
    });

    if (anonUsers.length === 0) {
      logger.info("No stale anonymous users found");
      return { output: { deletedCount: 0 } };
    }

    logger.info(`Found ${anonUsers.length} candidate anonymous users`);

    let deletedCount = 0;

    for (const user of anonUsers) {
      try {
        // Check if user has any active session in the better-auth sessions table
        const result = await payload.db.drizzle.execute(
          sql`SELECT 1 FROM sessions WHERE user_id = ${user.id} AND expires_at > NOW() LIMIT 1`
        );
        const hasActiveSession = result.rows.length > 0;
        if (hasActiveSession) {
          logger.info(`Skipping anonymous user ${user.id}: has active session`);
          continue;
        }

        await payload.delete({
          collection: "users",
          id: user.id,
          overrideAccess: true,
        });

        deletedCount += 1;
        logger.info(`Deleted anonymous user ${user.id}`);
      } catch (err) {
        logger.error(
          { err, userId: user.id },
          "Failed to delete anonymous user"
        );
      }
    }

    logger.info({ deletedCount }, "Anonymous user cleanup completed");

    return { output: { deletedCount } };
  },
} as TaskConfig<"cleanupAnonymousUsers">;
