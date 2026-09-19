import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'cleanupAnonymousUsers';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'cleanupAnonymousUsers';
  CREATE TABLE "payload_jobs_stats" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  ALTER TABLE "partner_content_items" ADD COLUMN "thumbnail_id" uuid;
  ALTER TABLE "payload_jobs" ADD COLUMN "meta" jsonb;
  ALTER TABLE "partner_content_items" ADD CONSTRAINT "partner_content_items_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "partner_content_items_thumbnail_idx" ON "partner_content_items" USING btree ("thumbnail_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_stats" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload_jobs_stats" CASCADE;
  ALTER TABLE "partner_content_items" DROP CONSTRAINT "partner_content_items_thumbnail_id_media_id_fk";

  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'checkPushReceipts', 'processLottery');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'checkPushReceipts', 'processLottery');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "partner_content_items_thumbnail_idx";
  ALTER TABLE "partner_content_items" DROP COLUMN "thumbnail_id";
  ALTER TABLE "payload_jobs" DROP COLUMN "meta";`);
}
