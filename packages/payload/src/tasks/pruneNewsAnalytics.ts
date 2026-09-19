import { sql } from "@payloadcms/db-postgres";
import type { TaskConfig } from "payload";

/**
 * How long an analytics event is kept, in days.
 *
 * Must stay comfortably above the 90-day ceiling `newsAnalyticsRouter`'s
 * `articleStats` and `topArticles` accept, or the dashboards start reporting
 * a window the data no longer covers. 180 leaves a wide margin and still
 * bounds the table.
 */
const DEFAULT_RETENTION_DAYS = 180;

/** Rows removed per statement, so a large backlog never holds a long lock. */
const BATCH_SIZE = 10_000;

/** Stop after this many batches; the next run picks up where this left off. */
const MAX_BATCHES = 50;

/**
 * Payload job task: pruneNewsAnalytics
 *
 * Deletes news-analytics events past the retention window.
 *
 * news-analytics is the fastest-growing table in the schema — every article
 * impression writes a row — and nothing was removing any of it. Left alone it
 * grows without bound, which slows every aggregate built on it and inflates
 * backup and storage costs indefinitely.
 *
 * Deletes in batches rather than one statement: a single unbounded DELETE over
 * a table this size takes a long lock and a large amount of WAL.
 */
export const pruneNewsAnalyticsTask: TaskConfig<"pruneNewsAnalytics"> = {
  slug: "pruneNewsAnalytics",
  schedule: [
    {
      // Daily at 4 AM, after the anonymous-user cleanup at 3.
      cron: "0 4 * * *",
      queue: "maintenance",
    },
  ],
  outputSchema: [
    {
      name: "deletedCount",
      type: "number",
    },
    {
      name: "hasMore",
      type: "checkbox",
    },
  ],
  retries: 1,
  handler: async ({ req }) => {
    const { payload } = req;
    const logger = payload.logger;

    const retentionDays = Number(
      process.env.NEWS_ANALYTICS_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS
    );

    // A malformed env var must not be read as "delete everything".
    if (!Number.isFinite(retentionDays) || retentionDays < 1) {
      logger.error(
        `Invalid NEWS_ANALYTICS_RETENTION_DAYS, skipping prune: ${process.env.NEWS_ANALYTICS_RETENTION_DAYS}`
      );
      return { output: { deletedCount: 0, hasMore: false } };
    }

    const cutoff = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    ).toISOString();

    logger.info(
      `Pruning news-analytics events older than ${retentionDays} days (before ${cutoff})`
    );

    let deletedCount = 0;
    let hasMore = false;

    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const result = await payload.db.drizzle.execute(sql`
        DELETE FROM news_analytics
        WHERE id IN (
          SELECT id FROM news_analytics
          WHERE timestamp < ${cutoff}::timestamptz
          LIMIT ${BATCH_SIZE}
        )
        RETURNING id
      `);

      const removed = result.rows.length;
      deletedCount += removed;

      if (removed < BATCH_SIZE) {
        break;
      }

      // Hit the batch ceiling with rows still to go: leave the rest for the
      // next scheduled run rather than running long.
      if (batch === MAX_BATCHES - 1) {
        hasMore = true;
      }
    }

    logger.info(
      `Pruned ${deletedCount} news-analytics events${hasMore ? " (more remain)" : ""}`
    );

    return { output: { deletedCount, hasMore } };
  },
};
