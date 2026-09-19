import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_notification_deliveries_status" ADD VALUE 'opened' BEFORE 'failed';
  ALTER TABLE "notification_deliveries" ADD COLUMN "device_token_id" uuid;
  ALTER TABLE "notification_deliveries" ADD COLUMN "opened_at" timestamp(3) with time zone;
  ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_token_id_push_tokens_id_fk" FOREIGN KEY ("device_token_id") REFERENCES "public"."push_tokens"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notification_deliveries_device_token_idx" ON "notification_deliveries" USING btree ("device_token_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notification_deliveries" DROP CONSTRAINT "notification_deliveries_device_token_id_push_tokens_id_fk";

  ALTER TABLE "notification_deliveries" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "notification_deliveries" ALTER COLUMN "status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_notification_deliveries_status";
  CREATE TYPE "public"."enum_notification_deliveries_status" AS ENUM('pending', 'delivered', 'failed');
  ALTER TABLE "notification_deliveries" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."enum_notification_deliveries_status";
  ALTER TABLE "notification_deliveries" ALTER COLUMN "status" SET DATA TYPE "public"."enum_notification_deliveries_status" USING "status"::"public"."enum_notification_deliveries_status";
  DROP INDEX "notification_deliveries_device_token_idx";
  ALTER TABLE "notification_deliveries" DROP COLUMN "device_token_id";
  ALTER TABLE "notification_deliveries" DROP COLUMN "opened_at";`);
}
