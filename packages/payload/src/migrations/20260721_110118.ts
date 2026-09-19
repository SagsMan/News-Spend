import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendModerationDigest' BEFORE 'checkPushReceipts';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendModerationDigest' BEFORE 'checkPushReceipts';
  ALTER TABLE "users" ADD COLUMN "reported_comments" jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE "users_rels" ADD COLUMN "users_id" uuid;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_users_id_idx" ON "users_rels" USING btree ("users_id");
  ALTER TABLE "content_reports" DROP COLUMN "report_type";
  DROP TYPE "public"."enum_content_reports_report_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_content_reports_report_type" AS ENUM('comment', 'news');
  ALTER TABLE "users_rels" DROP CONSTRAINT "users_rels_users_fk";

  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "users_rels_users_id_idx";
  ALTER TABLE "content_reports" ADD COLUMN "report_type" "enum_content_reports_report_type";
  UPDATE "content_reports" AS cr
  SET "report_type" = COALESCE(
    (
      SELECT CASE
        WHEN crr."comments_id" IS NOT NULL THEN 'comment'::"enum_content_reports_report_type"
        WHEN crr."news_id" IS NOT NULL THEN 'news'::"enum_content_reports_report_type"
        ELSE NULL
      END
      FROM "content_reports_rels" AS crr
      WHERE crr."parent_id" = cr."id" AND crr."path" = 'reportedItem'
      ORDER BY crr."id" DESC
      LIMIT 1
    ),
    'news'::"enum_content_reports_report_type"
  );
  ALTER TABLE "content_reports" ALTER COLUMN "report_type" SET NOT NULL;
  ALTER TABLE "users" DROP COLUMN "reported_comments";
  ALTER TABLE "users_rels" DROP COLUMN "users_id";`)
}
