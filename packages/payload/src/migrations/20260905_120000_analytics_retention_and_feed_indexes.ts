import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * Two changes that ship together:
 *
 * 1. Registers the `pruneNewsAnalytics` task slug on the jobs enums. Payload
 *    stores a job's task as an enum value, so a task the enum does not know
 *    about cannot be queued. Adding a value is transaction-safe as long as
 *    nothing uses it in the same transaction, which nothing here does.
 *
 * 2. Adds the composite indexes the hot read paths actually want. The feed
 *    query is `_status = 'published' ORDER BY created_at DESC`, which had only
 *    two separate single-column indexes to work with; partner-content is
 *    filtered by type and status on every feed request with neither column
 *    indexed; and the analytics aggregates scan news_analytics by article or
 *    event against a timestamp range.
 */

/**
 * Index builds that must not lock out writers.
 *
 * `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, and
 * Payload wraps every migration in one — so these go through the adapter's
 * raw pool, on their own connections, rather than the transaction-bound `db`.
 *
 * The trade-off is that they are not rolled back if a later step fails.
 * `IF NOT EXISTS` keeps a re-run safe, and a half-built index from an
 * interrupted CONCURRENTLY build is dropped by the `down` below.
 */
const INDEXES: { name: string; create: string }[] = [
  {
    name: "news_status_created_at_idx",
    create: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "news_status_created_at_idx"
             ON "news" USING btree ("_status", "created_at" DESC)`,
  },
  {
    name: "partner_content_type_status_idx",
    create: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "partner_content_type_status_idx"
             ON "partner_content" USING btree ("type", "status")`,
  },
  {
    name: "news_analytics_article_timestamp_idx",
    create: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "news_analytics_article_timestamp_idx"
             ON "news_analytics" USING btree ("article_id", "timestamp")`,
  },
  {
    name: "news_analytics_event_timestamp_idx",
    create: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "news_analytics_event_timestamp_idx"
             ON "news_analytics" USING btree ("event", "timestamp")`,
  },
];

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_payload_jobs_task_slug"
      ADD VALUE IF NOT EXISTS 'pruneNewsAnalytics';
    ALTER TYPE "public"."enum_payload_jobs_log_task_slug"
      ADD VALUE IF NOT EXISTS 'pruneNewsAnalytics';
  `);

  const pool = (payload.db as { pool?: { query: (q: string) => Promise<unknown> } })
    .pool;

  if (!pool) {
    payload.logger.warn(
      "No raw pool available; skipping concurrent index creation. Create the indexes named in this migration by hand."
    );
    return;
  }

  for (const index of INDEXES) {
    await pool.query(index.create);
  }
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  // Postgres cannot remove a value from an enum type, so the task slugs added
  // above stay. An unused enum value is harmless.
  const pool = (payload.db as { pool?: { query: (q: string) => Promise<unknown> } })
    .pool;

  if (!pool) {
    return;
  }

  for (const index of [...INDEXES].reverse()) {
    await pool.query(`DROP INDEX CONCURRENTLY IF EXISTS "${index.name}"`);
  }
}
