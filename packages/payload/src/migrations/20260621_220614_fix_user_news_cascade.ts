import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Fix delete cascade for News and Users.
 *
 * Bug: several Payload relationship fields are declared `required: true` (NOT NULL)
 * in the collection config, but the underlying Postgres FK was generated with
 * `ON DELETE SET NULL`. Postgres cannot SET NULL on a NOT NULL column, so deleting
 * the parent row fails with:
 *   "null value in column X of relation Y violates not-null constraint"
 *
 * Repro paths:
 *   - Admin UI: deleting a News article that has news_analytics rows
 *   - cleanupAnonymousUsersTask cron: deleting any anonymous user
 *   - Admin UI: deleting a user with comments / reactions / notification_inbox etc.
 *
 * Fix: change every NOT NULL + SET NULL FK to ON DELETE CASCADE.
 *
 * The Users.beforeDelete hook (collections/Users.ts) is also extended to wipe the
 * dependents explicitly, so cascading works even on databases where the FK has
 * already been created and dependent rows exist.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- news: cascade news_analytics (article is required on every analytics row)
    ALTER TABLE "news_analytics"
      DROP CONSTRAINT IF EXISTS "news_analytics_article_id_news_id_fk",
      ADD CONSTRAINT "news_analytics_article_id_news_id_fk"
      FOREIGN KEY ("article_id") REFERENCES "public"."news"("id")
      ON DELETE cascade ON UPDATE no action;

    -- users: cascade rows that have no meaning without the user
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

    -- content_reports: reporter identity is meaningless once reporter is gone
    ALTER TABLE "content_reports"
      DROP CONSTRAINT IF EXISTS "content_reports_reported_by_id_users_id_fk",
      ADD CONSTRAINT "content_reports_reported_by_id_users_id_fk"
      FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- identity_verification: PII row only exists to verify that user
    ALTER TABLE "identity_verification"
      DROP CONSTRAINT IF EXISTS "identity_verification_user_id_users_id_fk",
      ADD CONSTRAINT "identity_verification_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- lottery_tickets: anonymous users have no claim; remove with user
    ALTER TABLE "lottery_tickets"
      DROP CONSTRAINT IF EXISTS "lottery_tickets_user_id_users_id_fk",
      ADD CONSTRAINT "lottery_tickets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- lottery_winners: same as above
    ALTER TABLE "lottery_winners"
      DROP CONSTRAINT IF EXISTS "lottery_winners_user_id_users_id_fk",
      ADD CONSTRAINT "lottery_winners_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- ticket_purchase_log: same
    ALTER TABLE "ticket_purchase_log"
      DROP CONSTRAINT IF EXISTS "ticket_purchase_log_user_id_users_id_fk",
      ADD CONSTRAINT "ticket_purchase_log_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- notification_inbox: per-user inbox entry
    ALTER TABLE "notification_inbox"
      DROP CONSTRAINT IF EXISTS "notification_inbox_user_id_users_id_fk",
      ADD CONSTRAINT "notification_inbox_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- partner_conversions: belongs to user, no meaning if user is gone
    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_user_id_users_id_fk",
      ADD CONSTRAINT "partner_conversions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Revert to ON DELETE SET NULL (the buggy original behavior).
    -- Note: this will fail if any of these columns contain non-null values
    -- without a matching parent row. The collection declares the columns as
    -- NOT NULL via the required: true Payload field, so reverting requires the
    -- parent row to exist. The down migration assumes no orphan rows exist.

    ALTER TABLE "news_analytics"
      DROP CONSTRAINT IF EXISTS "news_analytics_article_id_news_id_fk",
      ADD CONSTRAINT "news_analytics_article_id_news_id_fk"
      FOREIGN KEY ("article_id") REFERENCES "public"."news"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "comments"
      DROP CONSTRAINT IF EXISTS "comments_user_id_users_id_fk",
      ADD CONSTRAINT "comments_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "reactions"
      DROP CONSTRAINT IF EXISTS "reactions_user_id_users_id_fk",
      ADD CONSTRAINT "reactions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "content_reports"
      DROP CONSTRAINT IF EXISTS "content_reports_reported_by_id_users_id_fk",
      ADD CONSTRAINT "content_reports_reported_by_id_users_id_fk"
      FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "identity_verification"
      DROP CONSTRAINT IF EXISTS "identity_verification_user_id_users_id_fk",
      ADD CONSTRAINT "identity_verification_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "lottery_tickets"
      DROP CONSTRAINT IF EXISTS "lottery_tickets_user_id_users_id_fk",
      ADD CONSTRAINT "lottery_tickets_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "lottery_winners"
      DROP CONSTRAINT IF EXISTS "lottery_winners_user_id_users_id_fk",
      ADD CONSTRAINT "lottery_winners_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "ticket_purchase_log"
      DROP CONSTRAINT IF EXISTS "ticket_purchase_log_user_id_users_id_fk",
      ADD CONSTRAINT "ticket_purchase_log_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "notification_inbox"
      DROP CONSTRAINT IF EXISTS "notification_inbox_user_id_users_id_fk",
      ADD CONSTRAINT "notification_inbox_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "partner_conversions"
      DROP CONSTRAINT IF EXISTS "partner_conversions_user_id_users_id_fk",
      ADD CONSTRAINT "partner_conversions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
  `);
}
