import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Re-apply the delete-cascade fixes from 20260621_220614_fix_user_news_cascade
 * and 20260622_120000_comments_cascade_delete.
 *
 * Both of those migrations are recorded in payload_migrations in production, but
 * the corresponding DDL is not present in the database: as of 2026-08-21 every
 * constraint they touch is still ON DELETE SET NULL. The most likely explanation
 * is that the production database was restored or rebuilt from a snapshot that
 * predated them while the migration ledger was carried over, so the ledger rows
 * exist with no schema change behind them.
 *
 * The practical effect is that the original bug is still live in production:
 * these columns are NOT NULL (declared `required: true` in the collection
 * config) but their FK is ON DELETE SET NULL. Postgres cannot SET NULL on a
 * NOT NULL column, so deleting the parent aborts the transaction with
 *   "null value in column X of relation Y violates not-null constraint"
 * and every later statement in that transaction fails with
 *   "current transaction is aborted, commands ignored until end of transaction"
 * which is how it surfaces in the logs.
 *
 * Confirmed broken paths:
 *   - Admin UI: deleting a News article with news_analytics rows
 *   - Admin UI / cleanupAnonymousUsersTask: deleting any user
 *
 * The statements below are the same ones those two migrations contain, and are
 * idempotent (DROP CONSTRAINT IF EXISTS then ADD), so this is safe to run
 * whether or not the earlier DDL is present.
 *
 * Scope note: production has ~44 FKs with the NOT NULL + SET NULL shape. This
 * migration deliberately re-applies only the set that was reviewed and chosen
 * for cascade in June; the rest are left alone pending their own review.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- news: analytics rows require an article
    ALTER TABLE "news_analytics"
      DROP CONSTRAINT IF EXISTS "news_analytics_article_id_news_id_fk",
      ADD CONSTRAINT "news_analytics_article_id_news_id_fk"
      FOREIGN KEY ("article_id") REFERENCES "public"."news"("id")
      ON DELETE cascade ON UPDATE no action;

    -- users: rows with no meaning once the user is gone
    ALTER TABLE "comments"
      DROP CONSTRAINT IF EXISTS "comments_user_id_users_id_fk",
      ADD CONSTRAINT "comments_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "reactions"
      DROP CONSTRAINT IF EXISTS "reactions_user_id_users_id_fk",
      ADD CONSTRAINT "reactions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "content_reports"
      DROP CONSTRAINT IF EXISTS "content_reports_reported_by_id_users_id_fk",
      ADD CONSTRAINT "content_reports_reported_by_id_users_id_fk"
      FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "identity_verification"
      DROP CONSTRAINT IF EXISTS "identity_verification_user_id_users_id_fk",
      ADD CONSTRAINT "identity_verification_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "lottery_tickets"
      DROP CONSTRAINT IF EXISTS "lottery_tickets_user_id_users_id_fk",
      ADD CONSTRAINT "lottery_tickets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "lottery_winners"
      DROP CONSTRAINT IF EXISTS "lottery_winners_user_id_users_id_fk",
      ADD CONSTRAINT "lottery_winners_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "ticket_purchase_log"
      DROP CONSTRAINT IF EXISTS "ticket_purchase_log_user_id_users_id_fk",
      ADD CONSTRAINT "ticket_purchase_log_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "notification_inbox"
      DROP CONSTRAINT IF EXISTS "notification_inbox_user_id_users_id_fk",
      ADD CONSTRAINT "notification_inbox_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_user_id_users_id_fk",
      ADD CONSTRAINT "partner_conversions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- comments: deleting a comment takes its reply subtree with it
    ALTER TABLE "comments"
      DROP CONSTRAINT IF EXISTS "comments_parent_id_comments_id_fk",
      ADD CONSTRAINT "comments_parent_id_comments_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id")
      ON DELETE cascade ON UPDATE no action;
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentionally a no-op. Reverting would restore the NOT NULL + SET NULL
  // combination, which is the bug itself — the parent row simply becomes
  // undeletable again. The two original migrations still carry their own
  // down() if a revert is ever genuinely wanted.
}
