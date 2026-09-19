import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_notification_inbox_type" ADD VALUE 'comment' BEFORE 'promo';
  ALTER TYPE "public"."enum_notifications_type" ADD VALUE 'comment' BEFORE 'promo';
  ALTER TYPE "public"."enum__notifications_v_version_type" ADD VALUE 'comment' BEFORE 'promo';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendCommentLikeNotification' BEFORE 'checkPushReceipts';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendCommentLikeNotification' BEFORE 'checkPushReceipts';`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notification_inbox" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "notification_inbox" ALTER COLUMN "type" SET DEFAULT 'misc'::text;
  UPDATE "notification_inbox" SET "type" = 'misc' WHERE "type" = 'comment';
  DROP TYPE "public"."enum_notification_inbox_type";
  CREATE TYPE "public"."enum_notification_inbox_type" AS ENUM('breaking_news', 'news', 'promo', 'misc');
  ALTER TABLE "notification_inbox" ALTER COLUMN "type" SET DEFAULT 'misc'::"public"."enum_notification_inbox_type";
  ALTER TABLE "notification_inbox" ALTER COLUMN "type" SET DATA TYPE "public"."enum_notification_inbox_type" USING "type"::"public"."enum_notification_inbox_type";
  ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'misc'::text;
  UPDATE "notifications" SET "type" = 'misc' WHERE "type" = 'comment';
  DROP TYPE "public"."enum_notifications_type";
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('breaking_news', 'news', 'promo', 'misc');
  ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'misc'::"public"."enum_notifications_type";
  ALTER TABLE "notifications" ALTER COLUMN "type" SET DATA TYPE "public"."enum_notifications_type" USING "type"::"public"."enum_notifications_type";
  ALTER TABLE "_notifications_v" ALTER COLUMN "version_type" SET DATA TYPE text;
  ALTER TABLE "_notifications_v" ALTER COLUMN "version_type" SET DEFAULT 'misc'::text;
  UPDATE "_notifications_v" SET "version_type" = 'misc' WHERE "version_type" = 'comment';
  DROP TYPE "public"."enum__notifications_v_version_type";
  CREATE TYPE "public"."enum__notifications_v_version_type" AS ENUM('breaking_news', 'news', 'promo', 'misc');
  ALTER TABLE "_notifications_v" ALTER COLUMN "version_type" SET DEFAULT 'misc'::"public"."enum__notifications_v_version_type";
  ALTER TABLE "_notifications_v" ALTER COLUMN "version_type" SET DATA TYPE "public"."enum__notifications_v_version_type" USING "version_type"::"public"."enum__notifications_v_version_type";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  UPDATE "payload_jobs_log" SET "task_slug" = 'inline' WHERE "task_slug" = 'sendCommentLikeNotification';
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  UPDATE "payload_jobs" SET "task_slug" = 'inline' WHERE "task_slug" = 'sendCommentLikeNotification';
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";`);
}
