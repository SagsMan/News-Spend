import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Change notification_deliveries FK to cascade delete
    ALTER TABLE "notification_deliveries" 
      DROP CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" 
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;

    -- Change notification_inbox FK to cascade delete
    ALTER TABLE "notification_inbox" 
      DROP CONSTRAINT "notification_inbox_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk" 
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  `);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Revert notification_deliveries FK to set null
    ALTER TABLE "notification_deliveries" 
      DROP CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" 
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;

    -- Revert notification_inbox FK to set null
    ALTER TABLE "notification_inbox" 
      DROP CONSTRAINT "notification_inbox_notification_id_notifications_id_fk",
      ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk" 
      FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  `);
}
