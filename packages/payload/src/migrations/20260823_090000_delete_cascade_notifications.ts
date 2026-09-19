import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Continue the delete-cascade work from 20260821_010000_reapply_cascade_fixes,
 * which fixed the reviewed set and left the rest "pending their own review".
 *
 * The shape is always the same: the column is `required: true` in the
 * collection config, so Postgres has it NOT NULL, but Payload created the
 * foreign key ON DELETE SET NULL. Deleting the parent tries to write NULL into
 * a NOT NULL column, the delete aborts, and every later statement in the
 * transaction fails with "current transaction is aborted".
 *
 * Reported for notifications:
 *   delete from "notifications" where id = $1
 *   -> null value in column "notification_id" of relation "notification_inbox"
 *      violates not-null constraint
 *
 * With 307 notifications and ~4,600 child rows in production, no notification
 * could be deleted at all.
 *
 * This migration covers only the cases where cascade needs no product
 * judgement — the child row is meaningless once the parent is gone:
 *
 *   notification_inbox            an inbox entry for a deleted notification
 *   notification_deliveries       a delivery record for one
 *   identity_checks               a KYC check for a deleted user
 *   push_tokens                   a device token for a deleted user
 *   user_blocks                   a block by or against a deleted user
 *   promotion_media_blocks_promo_image   a block whose image is required
 *
 * identity_checks is included because it is not in the Users pre-delete hook
 * and would break account deletion — a user-facing feature — for anyone who
 * has completed verification. It holds 0 rows today, so fixing it now costs
 * nothing and stops it becoming a live bug the moment KYC is used.
 *
 * Deliberately NOT included, because each destroys records someone may need
 * and deserves a decision rather than a default:
 *
 *   giveaway_winners.{giveaway_id, prize_id, user_id, winning_ticket_id}
 *   partner_conversions.{partner_id, content_id}
 *   partner_content.partner_id
 *   shop_analytics.store_id
 *
 * Statements are idempotent (DROP CONSTRAINT IF EXISTS then ADD), matching the
 * earlier migration, so this is safe whether or not the DDL is already there.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- notifications: the reported failure
    ALTER TABLE "notification_inbox"
      DROP CONSTRAINT IF EXISTS "notification_inbox_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk"
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "notification_deliveries"
      DROP CONSTRAINT IF EXISTS "notification_deliveries_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk"
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id")
      ON DELETE cascade ON UPDATE no action;

    -- users: rows with no meaning once the user is gone
    ALTER TABLE "identity_checks"
      DROP CONSTRAINT IF EXISTS "identity_checks_user_id_users_id_fk",
      ADD CONSTRAINT "identity_checks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "push_tokens"
      DROP CONSTRAINT IF EXISTS "push_tokens_user_id_users_id_fk",
      ADD CONSTRAINT "push_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "user_blocks"
      DROP CONSTRAINT IF EXISTS "user_blocks_blocker_id_users_id_fk",
      ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk"
      FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "user_blocks"
      DROP CONSTRAINT IF EXISTS "user_blocks_blocked_id_users_id_fk",
      ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk"
      FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    -- media: the block requires its image
    ALTER TABLE "promotion_media_blocks_promo_image"
      DROP CONSTRAINT IF EXISTS "promotion_media_blocks_promo_image_image_id_media_id_fk",
      ADD CONSTRAINT "promotion_media_blocks_promo_image_image_id_media_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
      ON DELETE cascade ON UPDATE no action;
  `);
}

/**
 * Restores ON DELETE SET NULL, i.e. puts the failure back. Present for
 * symmetry with the migration runner; there is no reason to run it.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "notification_inbox"
      DROP CONSTRAINT IF EXISTS "notification_inbox_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk"
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "notification_deliveries"
      DROP CONSTRAINT IF EXISTS "notification_deliveries_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk"
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "identity_checks"
      DROP CONSTRAINT IF EXISTS "identity_checks_user_id_users_id_fk",
      ADD CONSTRAINT "identity_checks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "push_tokens"
      DROP CONSTRAINT IF EXISTS "push_tokens_user_id_users_id_fk",
      ADD CONSTRAINT "push_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "user_blocks"
      DROP CONSTRAINT IF EXISTS "user_blocks_blocker_id_users_id_fk",
      ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk"
      FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "user_blocks"
      DROP CONSTRAINT IF EXISTS "user_blocks_blocked_id_users_id_fk",
      ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk"
      FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "promotion_media_blocks_promo_image"
      DROP CONSTRAINT IF EXISTS "promotion_media_blocks_promo_image_image_id_media_id_fk",
      ADD CONSTRAINT "promotion_media_blocks_promo_image_image_id_media_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;
  `);
}
