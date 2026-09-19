import type {
  MigrateDownArgs,
  MigrateUpArgs,
} from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * `IF EXISTS` on every drop below is a correction to what `migrate:create`
 * emitted, not defensive noise.
 *
 * The generated block was self-contradictory: it drops the lottery tables with
 * CASCADE, which already removes the foreign keys on
 * `payload_locked_documents_rels` that point at them, and then tries to drop
 * those same constraints by name. The second drop finds nothing, the whole
 * block is one statement so it rolls back, and Payload's `connect` throws —
 * which in production means every service that touches Payload crashloops on
 * boot. It failed that way on 23 Aug 2026 and had to be reverted.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  -- Job history for a task that no longer exists. The enum below is recreated
  -- without "processLottery", and the cast back fails on any surviving row
  -- that still holds it. Payload deletes jobs that succeed and keeps the ones
  -- that fail, so every row here is a failed run of the lottery cron that can
  -- never be retried. The log table goes first; it references payload_jobs.
  DELETE FROM "payload_jobs_log" WHERE "task_slug" = 'processLottery';
  DELETE FROM "payload_jobs" WHERE "task_slug" = 'processLottery';
   ALTER TABLE "identity_verification" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "identity_verification_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lottery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lottery_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lottery_tickets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lottery_tickets_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lottery_winners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "lottery_winners_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ticket_purchase_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ticket_purchase_log_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "identity_verification" CASCADE;
  DROP TABLE "identity_verification_rels" CASCADE;
  DROP TABLE "lottery" CASCADE;
  DROP TABLE "lottery_rels" CASCADE;
  DROP TABLE "lottery_tickets" CASCADE;
  DROP TABLE "lottery_tickets_rels" CASCADE;
  DROP TABLE "lottery_winners" CASCADE;
  DROP TABLE "lottery_winners_rels" CASCADE;
  DROP TABLE "ticket_purchase_log" CASCADE;
  DROP TABLE "ticket_purchase_log_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_identity_verification_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lottery_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lottery_tickets_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_lottery_winners_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ticket_purchase_log_fk";
  
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE IF EXISTS "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'sendModerationDigest', 'sendUrgentModerationAlert', 'checkPushReceipts', 'processGiveaway', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE IF EXISTS "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'sendModerationDigest', 'sendUrgentModerationAlert', 'checkPushReceipts', 'processGiveaway', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_identity_verification_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lottery_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lottery_tickets_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_lottery_winners_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_ticket_purchase_log_id_idx";
  ALTER TABLE "news" DROP COLUMN "is_live";
  ALTER TABLE "_news_v" DROP COLUMN "version_is_live";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "identity_verification_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lottery_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lottery_tickets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "lottery_winners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ticket_purchase_log_id";
  DROP TYPE IF EXISTS "public"."enum_lottery_winners_prize_tier";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_lottery_winners_prize_tier" AS ENUM('HIGH', 'MID', 'LOW', 'NONE');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'processLottery' BEFORE 'processGiveaway';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'processLottery' BEFORE 'processGiveaway';
  CREATE TABLE "identity_verification" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"phone_number" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"shipping_address" varchar NOT NULL,
  	"government_id_front_id" uuid NOT NULL,
  	"government_id_back_id" uuid NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "identity_verification_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );
  
  CREATE TABLE "lottery" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"is_active" boolean DEFAULT false,
  	"processing" boolean DEFAULT false,
  	"processed_at" timestamp(3) with time zone,
  	"draw_seed" varchar,
  	"ticket_price" numeric DEFAULT 50 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lottery_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"admins_id" uuid
  );
  
  CREATE TABLE "lottery_tickets" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"lottery_id" uuid NOT NULL,
  	"count" numeric NOT NULL,
  	"boost_luck" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lottery_tickets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );
  
  CREATE TABLE "lottery_winners" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"lottery_id" uuid NOT NULL,
  	"user_id" uuid NOT NULL,
  	"prize_tier" "enum_lottery_winners_prize_tier" NOT NULL,
  	"prize" varchar,
  	"claimed" boolean DEFAULT false,
  	"claimed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "lottery_winners_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );
  
  CREATE TABLE "ticket_purchase_log" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"lottery_id" uuid NOT NULL,
  	"ticket_quantity" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ticket_purchase_log_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );
  
  ALTER TABLE "news" ADD COLUMN "is_live" boolean DEFAULT false;
  ALTER TABLE "_news_v" ADD COLUMN "version_is_live" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "identity_verification_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lottery_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lottery_tickets_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "lottery_winners_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ticket_purchase_log_id" uuid;
  ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_government_id_front_id_media_id_fk" FOREIGN KEY ("government_id_front_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "identity_verification" ADD CONSTRAINT "identity_verification_government_id_back_id_media_id_fk" FOREIGN KEY ("government_id_back_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "identity_verification_rels" ADD CONSTRAINT "identity_verification_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."identity_verification"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "identity_verification_rels" ADD CONSTRAINT "identity_verification_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_rels" ADD CONSTRAINT "lottery_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lottery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_rels" ADD CONSTRAINT "lottery_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_rels" ADD CONSTRAINT "lottery_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_tickets" ADD CONSTRAINT "lottery_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lottery_tickets" ADD CONSTRAINT "lottery_tickets_lottery_id_lottery_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lottery"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lottery_tickets_rels" ADD CONSTRAINT "lottery_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lottery_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_tickets_rels" ADD CONSTRAINT "lottery_tickets_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_lottery_id_lottery_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lottery"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lottery_winners" ADD CONSTRAINT "lottery_winners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lottery_winners_rels" ADD CONSTRAINT "lottery_winners_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lottery_winners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lottery_winners_rels" ADD CONSTRAINT "lottery_winners_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log" ADD CONSTRAINT "ticket_purchase_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log" ADD CONSTRAINT "ticket_purchase_log_lottery_id_lottery_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lottery"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log_rels" ADD CONSTRAINT "ticket_purchase_log_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ticket_purchase_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log_rels" ADD CONSTRAINT "ticket_purchase_log_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "identity_verification_user_idx" ON "identity_verification" USING btree ("user_id");
  CREATE INDEX "identity_verification_government_id_government_id_front_idx" ON "identity_verification" USING btree ("government_id_front_id");
  CREATE INDEX "identity_verification_government_id_government_id_back_idx" ON "identity_verification" USING btree ("government_id_back_id");
  CREATE INDEX "identity_verification_updated_at_idx" ON "identity_verification" USING btree ("updated_at");
  CREATE INDEX "identity_verification_created_at_idx" ON "identity_verification" USING btree ("created_at");
  CREATE INDEX "identity_verification_rels_order_idx" ON "identity_verification_rels" USING btree ("order");
  CREATE INDEX "identity_verification_rels_parent_idx" ON "identity_verification_rels" USING btree ("parent_id");
  CREATE INDEX "identity_verification_rels_path_idx" ON "identity_verification_rels" USING btree ("path");
  CREATE INDEX "identity_verification_rels_admins_id_idx" ON "identity_verification_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "lottery_name_idx" ON "lottery" USING btree ("name");
  CREATE INDEX "lottery_updated_at_idx" ON "lottery" USING btree ("updated_at");
  CREATE INDEX "lottery_created_at_idx" ON "lottery" USING btree ("created_at");
  CREATE INDEX "lottery_rels_order_idx" ON "lottery_rels" USING btree ("order");
  CREATE INDEX "lottery_rels_parent_idx" ON "lottery_rels" USING btree ("parent_id");
  CREATE INDEX "lottery_rels_path_idx" ON "lottery_rels" USING btree ("path");
  CREATE INDEX "lottery_rels_users_id_idx" ON "lottery_rels" USING btree ("users_id");
  CREATE INDEX "lottery_rels_admins_id_idx" ON "lottery_rels" USING btree ("admins_id");
  CREATE INDEX "lottery_tickets_user_idx" ON "lottery_tickets" USING btree ("user_id");
  CREATE INDEX "lottery_tickets_lottery_idx" ON "lottery_tickets" USING btree ("lottery_id");
  CREATE INDEX "lottery_tickets_updated_at_idx" ON "lottery_tickets" USING btree ("updated_at");
  CREATE INDEX "lottery_tickets_created_at_idx" ON "lottery_tickets" USING btree ("created_at");
  CREATE INDEX "lottery_tickets_rels_order_idx" ON "lottery_tickets_rels" USING btree ("order");
  CREATE INDEX "lottery_tickets_rels_parent_idx" ON "lottery_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "lottery_tickets_rels_path_idx" ON "lottery_tickets_rels" USING btree ("path");
  CREATE INDEX "lottery_tickets_rels_admins_id_idx" ON "lottery_tickets_rels" USING btree ("admins_id");
  CREATE INDEX "lottery_winners_lottery_idx" ON "lottery_winners" USING btree ("lottery_id");
  CREATE INDEX "lottery_winners_user_idx" ON "lottery_winners" USING btree ("user_id");
  CREATE INDEX "lottery_winners_updated_at_idx" ON "lottery_winners" USING btree ("updated_at");
  CREATE INDEX "lottery_winners_created_at_idx" ON "lottery_winners" USING btree ("created_at");
  CREATE INDEX "lottery_winners_rels_order_idx" ON "lottery_winners_rels" USING btree ("order");
  CREATE INDEX "lottery_winners_rels_parent_idx" ON "lottery_winners_rels" USING btree ("parent_id");
  CREATE INDEX "lottery_winners_rels_path_idx" ON "lottery_winners_rels" USING btree ("path");
  CREATE INDEX "lottery_winners_rels_admins_id_idx" ON "lottery_winners_rels" USING btree ("admins_id");
  CREATE INDEX "ticket_purchase_log_user_idx" ON "ticket_purchase_log" USING btree ("user_id");
  CREATE INDEX "ticket_purchase_log_lottery_idx" ON "ticket_purchase_log" USING btree ("lottery_id");
  CREATE INDEX "ticket_purchase_log_updated_at_idx" ON "ticket_purchase_log" USING btree ("updated_at");
  CREATE INDEX "ticket_purchase_log_created_at_idx" ON "ticket_purchase_log" USING btree ("created_at");
  CREATE INDEX "ticket_purchase_log_rels_order_idx" ON "ticket_purchase_log_rels" USING btree ("order");
  CREATE INDEX "ticket_purchase_log_rels_parent_idx" ON "ticket_purchase_log_rels" USING btree ("parent_id");
  CREATE INDEX "ticket_purchase_log_rels_path_idx" ON "ticket_purchase_log_rels" USING btree ("path");
  CREATE INDEX "ticket_purchase_log_rels_admins_id_idx" ON "ticket_purchase_log_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_identity_verification_fk" FOREIGN KEY ("identity_verification_id") REFERENCES "public"."identity_verification"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lottery_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lottery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lottery_tickets_fk" FOREIGN KEY ("lottery_tickets_id") REFERENCES "public"."lottery_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lottery_winners_fk" FOREIGN KEY ("lottery_winners_id") REFERENCES "public"."lottery_winners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ticket_purchase_log_fk" FOREIGN KEY ("ticket_purchase_log_id") REFERENCES "public"."ticket_purchase_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_identity_verification_id_idx" ON "payload_locked_documents_rels" USING btree ("identity_verification_id");
  CREATE INDEX "payload_locked_documents_rels_lottery_id_idx" ON "payload_locked_documents_rels" USING btree ("lottery_id");
  CREATE INDEX "payload_locked_documents_rels_lottery_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("lottery_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_lottery_winners_id_idx" ON "payload_locked_documents_rels" USING btree ("lottery_winners_id");
  CREATE INDEX "payload_locked_documents_rels_ticket_purchase_log_id_idx" ON "payload_locked_documents_rels" USING btree ("ticket_purchase_log_id");`)
}
