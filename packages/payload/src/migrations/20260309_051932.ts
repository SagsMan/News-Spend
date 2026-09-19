import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "promotion_media_blocks_promo_video_source"
    ALTER COLUMN "video_source" DROP DEFAULT;

  ALTER TABLE "promotion_media_blocks_promo_video_source"
    ALTER COLUMN "video_source" SET DATA TYPE text
    USING "video_source"::text;

  DROP TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source";

  CREATE TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source"
    AS ENUM('upload', 'normal', 'youtube');

  ALTER TABLE "promotion_media_blocks_promo_video_source"
    ALTER COLUMN "video_source"
    SET DATA TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source"
    USING "video_source"::"public"."enum_promotion_media_blocks_promo_video_source_video_source";
`);

  await db.execute(sql`
   CREATE TYPE "public"."enum_notification_deliveries_status" AS ENUM('pending', 'delivered', 'failed');
  CREATE TYPE "public"."enum_notification_inbox_type" AS ENUM('breaking_news', 'news', 'promo', 'misc');
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('breaking_news', 'news', 'promo', 'misc');
  CREATE TYPE "public"."enum_partner_content_blocks_promo_video_source_video_source" AS ENUM('upload', 'normal', 'youtube');
  CREATE TYPE "public"."enum_partner_content_type" AS ENUM('book', 'app', 'game', 'survey', 'video', 'banner', 'promo-media', 'product', 'custom', '');
  CREATE TYPE "public"."enum_partner_content_ad_size" AS ENUM('BANNER', 'LARGE_BANNER', 'FULL_BANNER', 'LEADERBOARD', 'INLINE_RECTANGLE', 'MEDIUM_RECTANGLE', 'LARGE_RECTANGLE', 'HALF_PAGE', 'WIDE_SKYSCRAPER', 'BILLBOARD', 'ANCHORED_ADAPTIVE');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'checkPushReceipts');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'checkPushReceipts');
  -- ALTER TYPE "public"."enum_partner_content_status" ADD VALUE 'archived';
  -- ALTER TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source" ADD VALUE 'upload' BEFORE 'normal';
  CREATE TABLE "notification_deliveries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"notification_id" uuid NOT NULL,
  	"user_id" uuid,
  	"push_token" varchar NOT NULL,
  	"status" "enum_notification_deliveries_status" DEFAULT 'pending' NOT NULL,
  	"error_message" varchar,
  	"expo_ticket_id" varchar,
  	"delivered_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "notification_deliveries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "notification_inbox" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"notification_id" uuid NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"image_url" varchar,
  	"data" jsonb,
  	"type" "enum_notification_inbox_type" DEFAULT 'misc',
  	"click_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "notification_inbox_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "partner_content_blocks_promo_video_source" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"video_source" "enum_partner_content_blocks_promo_video_source_video_source" DEFAULT 'upload',
  	"video_id" uuid,
  	"url" varchar,
  	"block_name" varchar
  );

  CREATE TABLE "partner_content_blocks_promo_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" uuid,
  	"block_name" varchar
  );

  CREATE TABLE "partner_content_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );

  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );

  CREATE TABLE "payload_jobs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "notification_logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_logs_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_tickets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "push_tickets_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notification_logs" CASCADE;
  DROP TABLE "notification_logs_rels" CASCADE;
  DROP TABLE "push_tickets" CASCADE;
  DROP TABLE "push_tickets_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_notification_logs_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_push_tickets_fk";

  ALTER TABLE "notifications_device_types" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_device_types";
  CREATE TYPE "public"."enum_notifications_device_types" AS ENUM('all', 'ios', 'android');
  ALTER TABLE "notifications_device_types" ALTER COLUMN "value" SET DATA TYPE "public"."enum_notifications_device_types" USING "value"::"public"."enum_notifications_device_types";
  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_placements";
  CREATE TYPE "public"."enum_partner_content_placements" AS ENUM('homepage-trending-books', 'homepage-ads-banner', 'discover-tab', 'points-mall-books', 'points-mall-apps', 'connect-brand-video', 'connect-brands-tab', 'lucky-app-wall', 'shop-tab', 'news-click-ads', 'banner-news-post', 'news-post', 'product-display', 'push-notification', 'email-campaign', 'video-section');
  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE "public"."enum_partner_content_placements" USING "value"::"public"."enum_partner_content_placements";
  ALTER TABLE "partner_content" ALTER COLUMN "video_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_video_type";
  CREATE TYPE "public"."enum_partner_content_video_type" AS ENUM('UPLOAD', 'YOUTUBE', 'EXTERNAL');
  ALTER TABLE "partner_content" ALTER COLUMN "video_type" SET DATA TYPE "public"."enum_partner_content_video_type" USING "video_type"::"public"."enum_partner_content_video_type";
  DROP INDEX "payload_locked_documents_rels_notification_logs_id_idx";
  DROP INDEX "payload_locked_documents_rels_push_tickets_id_idx";
  ALTER TABLE "partner_content" ALTER COLUMN "description" DROP NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "media_id" DROP NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "url" DROP NOT NULL;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "video_source" SET DEFAULT 'upload';
  ALTER TABLE "notifications" ADD COLUMN "type" "enum_notifications_type" DEFAULT 'misc' NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "condition" varchar DEFAULT '' NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "type" "enum_partner_content_type" DEFAULT '' NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "ad_size" "enum_partner_content_ad_size";
  ALTER TABLE "partner_content" ADD COLUMN "display_notes" varchar;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ADD COLUMN "video_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_deliveries_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_inbox_id" uuid;
  ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_deliveries_rels" ADD CONSTRAINT "notification_deliveries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_deliveries_rels" ADD CONSTRAINT "notification_deliveries_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_inbox" ADD CONSTRAINT "notification_inbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_inbox" ADD CONSTRAINT "notification_inbox_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_inbox_rels" ADD CONSTRAINT "notification_inbox_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notification_inbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_inbox_rels" ADD CONSTRAINT "notification_inbox_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_content_blocks_promo_video_source" ADD CONSTRAINT "partner_content_blocks_promo_video_source_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_content_blocks_promo_video_source" ADD CONSTRAINT "partner_content_blocks_promo_video_source_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_content_blocks_promo_image" ADD CONSTRAINT "partner_content_blocks_promo_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_content_blocks_promo_image" ADD CONSTRAINT "partner_content_blocks_promo_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_content_items" ADD CONSTRAINT "partner_content_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notification_deliveries_notification_idx" ON "notification_deliveries" USING btree ("notification_id");
  CREATE INDEX "notification_deliveries_user_idx" ON "notification_deliveries" USING btree ("user_id");
  CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status");
  CREATE INDEX "notification_deliveries_updated_at_idx" ON "notification_deliveries" USING btree ("updated_at");
  CREATE INDEX "notification_deliveries_created_at_idx" ON "notification_deliveries" USING btree ("created_at");
  CREATE INDEX "notification_user_idx" ON "notification_deliveries" USING btree ("notification_id","user_id");
  CREATE INDEX "status_idx" ON "notification_deliveries" USING btree ("status");
  CREATE INDEX "expoTicketId_idx" ON "notification_deliveries" USING btree ("expo_ticket_id");
  CREATE INDEX "notification_deliveries_rels_order_idx" ON "notification_deliveries_rels" USING btree ("order");
  CREATE INDEX "notification_deliveries_rels_parent_idx" ON "notification_deliveries_rels" USING btree ("parent_id");
  CREATE INDEX "notification_deliveries_rels_path_idx" ON "notification_deliveries_rels" USING btree ("path");
  CREATE INDEX "notification_deliveries_rels_admins_id_idx" ON "notification_deliveries_rels" USING btree ("admins_id");
  CREATE INDEX "notification_inbox_user_idx" ON "notification_inbox" USING btree ("user_id");
  CREATE INDEX "notification_inbox_notification_idx" ON "notification_inbox" USING btree ("notification_id");
  CREATE INDEX "notification_inbox_type_idx" ON "notification_inbox" USING btree ("type");
  CREATE INDEX "notification_inbox_updated_at_idx" ON "notification_inbox" USING btree ("updated_at");
  CREATE INDEX "notification_inbox_created_at_idx" ON "notification_inbox" USING btree ("created_at");
  CREATE INDEX "user_notification_idx" ON "notification_inbox" USING btree ("user_id","notification_id");
  CREATE INDEX "user_type_idx" ON "notification_inbox" USING btree ("user_id","type");
  CREATE INDEX "notification_inbox_rels_order_idx" ON "notification_inbox_rels" USING btree ("order");
  CREATE INDEX "notification_inbox_rels_parent_idx" ON "notification_inbox_rels" USING btree ("parent_id");
  CREATE INDEX "notification_inbox_rels_path_idx" ON "notification_inbox_rels" USING btree ("path");
  CREATE INDEX "notification_inbox_rels_admins_id_idx" ON "notification_inbox_rels" USING btree ("admins_id");
  CREATE INDEX "partner_content_blocks_promo_video_source_order_idx" ON "partner_content_blocks_promo_video_source" USING btree ("_order");
  CREATE INDEX "partner_content_blocks_promo_video_source_parent_id_idx" ON "partner_content_blocks_promo_video_source" USING btree ("_parent_id");
  CREATE INDEX "partner_content_blocks_promo_video_source_path_idx" ON "partner_content_blocks_promo_video_source" USING btree ("_path");
  CREATE INDEX "partner_content_blocks_promo_video_source_video_idx" ON "partner_content_blocks_promo_video_source" USING btree ("video_id");
  CREATE INDEX "partner_content_blocks_promo_image_order_idx" ON "partner_content_blocks_promo_image" USING btree ("_order");
  CREATE INDEX "partner_content_blocks_promo_image_parent_id_idx" ON "partner_content_blocks_promo_image" USING btree ("_parent_id");
  CREATE INDEX "partner_content_blocks_promo_image_path_idx" ON "partner_content_blocks_promo_image" USING btree ("_path");
  CREATE INDEX "partner_content_blocks_promo_image_image_idx" ON "partner_content_blocks_promo_image" USING btree ("image_id");
  CREATE INDEX "partner_content_items_order_idx" ON "partner_content_items" USING btree ("_order");
  CREATE INDEX "partner_content_items_parent_id_idx" ON "partner_content_items" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  ALTER TABLE "promotion_media_blocks_promo_video_source" ADD CONSTRAINT "promotion_media_blocks_promo_video_source_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_deliveries_fk" FOREIGN KEY ("notification_deliveries_id") REFERENCES "public"."notification_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_inbox_fk" FOREIGN KEY ("notification_inbox_id") REFERENCES "public"."notification_inbox"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "promotion_media_blocks_promo_video_source_video_idx" ON "promotion_media_blocks_promo_video_source" USING btree ("video_id");
  CREATE INDEX "payload_locked_documents_rels_notification_deliveries_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_deliveries_id");
  CREATE INDEX "payload_locked_documents_rels_notification_inbox_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_inbox_id");
  ALTER TABLE "partner_content" DROP COLUMN "is_video";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_logs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_tickets_id";
  DROP TYPE "public"."enum_notification_logs_status";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notification_logs_status" AS ENUM('delivered', 'failed', 'opened');
  ALTER TYPE "public"."enum_notifications_device_types" ADD VALUE 'web';
  CREATE TABLE "notification_logs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"notification_id" uuid NOT NULL,
  	"user_id" uuid,
  	"device_token_id" uuid,
  	"status" "enum_notification_logs_status" NOT NULL,
  	"error" varchar,
  	"delivered_at" timestamp(3) with time zone,
  	"opened_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "notification_logs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "push_tickets" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"push_token" varchar NOT NULL,
  	"ticket_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "push_tickets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "notification_deliveries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_deliveries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_inbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "notification_inbox_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partner_content_blocks_promo_video_source" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partner_content_blocks_promo_image" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partner_content_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "notification_deliveries" CASCADE;
  DROP TABLE "notification_deliveries_rels" CASCADE;
  DROP TABLE "notification_inbox" CASCADE;
  DROP TABLE "notification_inbox_rels" CASCADE;
  DROP TABLE "partner_content_blocks_promo_video_source" CASCADE;
  DROP TABLE "partner_content_blocks_promo_image" CASCADE;
  DROP TABLE "partner_content_items" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  ALTER TABLE "promotion_media_blocks_promo_video_source" DROP CONSTRAINT "promotion_media_blocks_promo_video_source_video_id_media_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notification_deliveries_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_notification_inbox_fk";

  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_placements";
  CREATE TYPE "public"."enum_partner_content_placements" AS ENUM('homepage-trending-books', 'homepage-ads-banner', 'points-mall-books', 'points-mall-apps', 'connect-brands-tab', 'connect-brand-video', 'lucky-app-wall', 'news-click-ads', 'banner-between-news');
  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE "public"."enum_partner_content_placements" USING "value"::"public"."enum_partner_content_placements";
  ALTER TABLE "partner_content" ALTER COLUMN "video_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_video_type";
  CREATE TYPE "public"."enum_partner_content_video_type" AS ENUM('upload', 'youtube', 'external');
  ALTER TABLE "partner_content" ALTER COLUMN "video_type" SET DATA TYPE "public"."enum_partner_content_video_type" USING "video_type"::"public"."enum_partner_content_video_type";
  ALTER TABLE "partner_content" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "partner_content" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_partner_content_status";
  CREATE TYPE "public"."enum_partner_content_status" AS ENUM('draft', 'active', 'paused');
  ALTER TABLE "partner_content" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_partner_content_status";
  ALTER TABLE "partner_content" ALTER COLUMN "status" SET DATA TYPE "public"."enum_partner_content_status" USING "status"::"public"."enum_partner_content_status";
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "video_source" SET DATA TYPE text;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "video_source" SET DEFAULT 'normal'::text;
  DROP TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source";
  CREATE TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source" AS ENUM('normal', 'youtube');
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "video_source" SET DEFAULT 'normal'::"public"."enum_promotion_media_blocks_promo_video_source_video_source";
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "video_source" SET DATA TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source" USING "video_source"::"public"."enum_promotion_media_blocks_promo_video_source_video_source";
  DROP INDEX "promotion_media_blocks_promo_video_source_video_idx";
  DROP INDEX "payload_locked_documents_rels_notification_deliveries_id_idx";
  DROP INDEX "payload_locked_documents_rels_notification_inbox_id_idx";
  ALTER TABLE "partner_content" ALTER COLUMN "description" SET NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "media_id" SET NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ALTER COLUMN "url" SET NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "is_video" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "notification_logs_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_tickets_id" uuid;
  ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_device_token_id_push_tokens_id_fk" FOREIGN KEY ("device_token_id") REFERENCES "public"."push_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_logs_rels" ADD CONSTRAINT "notification_logs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notification_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_logs_rels" ADD CONSTRAINT "notification_logs_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_tickets_rels" ADD CONSTRAINT "push_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."push_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_tickets_rels" ADD CONSTRAINT "push_tickets_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "notification_logs_notification_idx" ON "notification_logs" USING btree ("notification_id");
  CREATE INDEX "notification_logs_user_idx" ON "notification_logs" USING btree ("user_id");
  CREATE INDEX "notification_logs_device_token_idx" ON "notification_logs" USING btree ("device_token_id");
  CREATE INDEX "notification_logs_updated_at_idx" ON "notification_logs" USING btree ("updated_at");
  CREATE INDEX "notification_user_deviceToken_idx" ON "notification_logs" USING btree ("notification_id","user_id","device_token_id");
  CREATE INDEX "status_idx" ON "notification_logs" USING btree ("status");
  CREATE INDEX "createdAt_idx" ON "notification_logs" USING btree ("created_at");
  CREATE INDEX "notification_logs_rels_order_idx" ON "notification_logs_rels" USING btree ("order");
  CREATE INDEX "notification_logs_rels_parent_idx" ON "notification_logs_rels" USING btree ("parent_id");
  CREATE INDEX "notification_logs_rels_path_idx" ON "notification_logs_rels" USING btree ("path");
  CREATE INDEX "notification_logs_rels_admins_id_idx" ON "notification_logs_rels" USING btree ("admins_id");
  CREATE INDEX "push_tickets_updated_at_idx" ON "push_tickets" USING btree ("updated_at");
  CREATE INDEX "push_tickets_created_at_idx" ON "push_tickets" USING btree ("created_at");
  CREATE INDEX "push_tickets_rels_order_idx" ON "push_tickets_rels" USING btree ("order");
  CREATE INDEX "push_tickets_rels_parent_idx" ON "push_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "push_tickets_rels_path_idx" ON "push_tickets_rels" USING btree ("path");
  CREATE INDEX "push_tickets_rels_admins_id_idx" ON "push_tickets_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_logs_fk" FOREIGN KEY ("notification_logs_id") REFERENCES "public"."notification_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_tickets_fk" FOREIGN KEY ("push_tickets_id") REFERENCES "public"."push_tickets"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_notification_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_logs_id");
  CREATE INDEX "payload_locked_documents_rels_push_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("push_tickets_id");
  ALTER TABLE "notifications" DROP COLUMN "type";
  ALTER TABLE "partner_content" DROP COLUMN "condition";
  ALTER TABLE "partner_content" DROP COLUMN "type";
  ALTER TABLE "partner_content" DROP COLUMN "ad_size";
  ALTER TABLE "partner_content" DROP COLUMN "display_notes";
  ALTER TABLE "promotion_media_blocks_promo_video_source" DROP COLUMN "video_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_deliveries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "notification_inbox_id";
  DROP TYPE "public"."enum_notification_deliveries_status";
  DROP TYPE "public"."enum_notification_inbox_type";
  DROP TYPE "public"."enum_notifications_type";
  DROP TYPE "public"."enum_partner_content_blocks_promo_video_source_video_source";
  DROP TYPE "public"."enum_partner_content_type";
  DROP TYPE "public"."enum_partner_content_ad_size";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`);
}
