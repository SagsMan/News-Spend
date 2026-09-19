import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Fix notification_deliveries FK: change ON DELETE set null to ON DELETE cascade
    ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_notification_id_notifications_id_fk";
    ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;

    -- Fix notification_inbox FK: change ON DELETE set null to ON DELETE cascade
    ALTER TABLE "notification_inbox" DROP CONSTRAINT IF EXISTS "notification_inbox_notification_id_notifications_id_fk";
    ALTER TABLE "notification_inbox" ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Revert to ON DELETE set null (original behavior)
    ALTER TABLE "notification_deliveries" DROP CONSTRAINT IF EXISTS "notification_deliveries_notification_id_notifications_id_fk";
    ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;

    ALTER TABLE "notification_inbox" DROP CONSTRAINT IF EXISTS "notification_inbox_notification_id_notifications_id_fk";
    ALTER TABLE "notification_inbox" ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  `);
}
