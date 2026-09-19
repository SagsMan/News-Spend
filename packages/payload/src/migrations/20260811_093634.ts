import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_admins_moderation_alerts" AS ENUM('all', 'urgent', 'digest', 'none');
  CREATE TYPE "public"."enum_comments_moderation_status" AS ENUM('visible', 'hidden', 'removed');
  CREATE TYPE "public"."enum_content_reports_type" AS ENUM('report', 'block', 'filterRejection');
  CREATE TYPE "public"."enum_giveaway_audit_log_event_type" AS ENUM('ticket_purchase', 'ticket_status_change', 'boost_completion', 'featured_offer_completion', 'participants_snapshot', 'candidate_pool_built', 'winner_selected', 'prize_allocated', 'prize_exhausted', 'tier_completed', 'draw_started', 'draw_resumed', 'draw_completed', 'draw_error', 'winner_report_sent', 'claim_status_change');
  CREATE TYPE "public"."enum_giveaway_engagements_type" AS ENUM('boost', 'featured_offer');
  CREATE TYPE "public"."enum_giveaway_engagements_completion_status" AS ENUM('completed', 'incomplete', 'abandoned', 'failed');
  CREATE TYPE "public"."enum_giveaway_prizes_tier" AS ENUM('tier1', 'tier2', 'tier3');
  CREATE TYPE "public"."enum_giveaways_status" AS ENUM('draft', 'active', 'drawing', 'completed', 'failed');
  CREATE TYPE "public"."enum_giveaway_streaks_tier" AS ENUM('tier1', 'tier2', 'tier3');
  CREATE TYPE "public"."enum_giveaway_tickets_status" AS ENUM('valid', 'cancelled', 'refunded', 'reversed', 'unpaid', 'fraudulent');
  CREATE TYPE "public"."enum_giveaway_winners_tier" AS ENUM('tier1', 'tier2', 'tier3');
  CREATE TYPE "public"."enum_giveaway_winners_claim_status" AS ENUM('unclaimed', 'claimed', 'expired', 'forfeited');
  CREATE TYPE "public"."enum_giveaway_winners_fulfilment_status" AS ENUM('pending', 'in_progress', 'fulfilled', 'cancelled');
  CREATE TYPE "public"."enum_prize_catalogue_tier" AS ENUM('tier1', 'tier2', 'tier3');
  CREATE TYPE "public"."enum_moderation_settings_alert_roles" AS ENUM('super-admin', 'content-manager', 'editor', 'viewer');
  CREATE TYPE "public"."enum_moderation_settings_additional_recipients_tier" AS ENUM('all', 'urgent', 'digest');
  CREATE TYPE "public"."enum_moderation_settings_hide_on_first_report_reasons" AS ENUM('spam', 'harassment', 'hate-speech', 'misinformation', 'personal-info', 'inappropriate', 'off-topic', 'trolling', 'illegal', 'other');
  CREATE TYPE "public"."enum_moderation_settings_urgent_reasons" AS ENUM('spam', 'harassment', 'hate-speech', 'misinformation', 'personal-info', 'inappropriate', 'off-topic', 'trolling', 'illegal', 'other');
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'sendUrgentModerationAlert' BEFORE 'checkPushReceipts';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'sendUrgentModerationAlert' BEFORE 'checkPushReceipts';
  CREATE TABLE "giveaway_audit_log" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"event_type" "enum_giveaway_audit_log_event_type" NOT NULL,
  	"user_id" uuid,
  	"tier" varchar,
  	"message" varchar NOT NULL,
  	"detail" jsonb,
  	"occurred_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_audit_log_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_engagements" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"user_id" uuid NOT NULL,
  	"type" "enum_giveaway_engagements_type" NOT NULL,
  	"content_id" uuid,
  	"conversion_id" uuid,
  	"completion_status" "enum_giveaway_engagements_completion_status" DEFAULT 'completed' NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_engagements_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_prizes" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"prize_id" uuid NOT NULL,
  	"tier" "enum_giveaway_prizes_tier" NOT NULL,
  	"max_units" numeric NOT NULL,
  	"units_awarded" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_prizes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaways" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"ticket_price" numeric DEFAULT 50 NOT NULL,
  	"tier1_winner_percentage" numeric DEFAULT 0.1 NOT NULL,
  	"tier2_winner_percentage" numeric DEFAULT 0.5 NOT NULL,
  	"tier3_winner_percentage" numeric DEFAULT 5 NOT NULL,
  	"status" "enum_giveaways_status" DEFAULT 'draft' NOT NULL,
  	"total_valid_participants" numeric,
  	"draw_seed" varchar,
  	"draw_started_at" timestamp(3) with time zone,
  	"draw_completed_at" timestamp(3) with time zone,
  	"draw_error" varchar,
  	"winner_report_sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaways_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_streaks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"tier" "enum_giveaway_streaks_tier" NOT NULL,
  	"consecutive_count" numeric DEFAULT 0 NOT NULL,
  	"last_evaluated_giveaway_id" uuid,
  	"last_qualified_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_streaks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_tickets" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"user_id" uuid NOT NULL,
  	"quantity" numeric NOT NULL,
  	"status" "enum_giveaway_tickets_status" DEFAULT 'valid' NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"payment_reference" varchar,
  	"purchased_at" timestamp(3) with time zone NOT NULL,
  	"status_changed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_tickets_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_winners" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"user_id" uuid NOT NULL,
  	"tier" "enum_giveaway_winners_tier" NOT NULL,
  	"prize_id" uuid NOT NULL,
  	"prize_name" varchar NOT NULL,
  	"winning_ticket_id" uuid NOT NULL,
  	"valid_ticket_count" numeric NOT NULL,
  	"boost_count" numeric DEFAULT 0 NOT NULL,
  	"featured_offer_count" numeric DEFAULT 0 NOT NULL,
  	"selected_at" timestamp(3) with time zone NOT NULL,
  	"claim_status" "enum_giveaway_winners_claim_status" DEFAULT 'unclaimed' NOT NULL,
  	"claimed_at" timestamp(3) with time zone,
  	"claim_deadline" timestamp(3) with time zone,
  	"fulfilment_status" "enum_giveaway_winners_fulfilment_status" DEFAULT 'pending' NOT NULL,
  	"fulfilled_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_winners_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "prize_catalogue" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"tier" "enum_prize_catalogue_tier" NOT NULL,
  	"description" varchar,
  	"image_id" uuid,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "prize_catalogue_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "moderation_settings_alert_roles" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_moderation_settings_alert_roles",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "moderation_settings_additional_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"tier" "enum_moderation_settings_additional_recipients_tier" DEFAULT 'all'
  );

  CREATE TABLE "moderation_settings_hide_on_first_report_reasons" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_moderation_settings_hide_on_first_report_reasons",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "moderation_settings_urgent_reasons" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_moderation_settings_urgent_reasons",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "moderation_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"auto_hide_threshold" numeric,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE "moderation_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "admins" ADD COLUMN "moderation_alerts" "enum_admins_moderation_alerts";
  ALTER TABLE "comments" ADD COLUMN "moderation_status" "enum_comments_moderation_status" DEFAULT 'visible';
  ALTER TABLE "content_reports" ADD COLUMN "type" "enum_content_reports_type" DEFAULT 'report';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_audit_log_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_engagements_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_prizes_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaways_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_streaks_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_tickets_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_winners_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "prize_catalogue_id" uuid;
  ALTER TABLE "giveaway_audit_log" ADD CONSTRAINT "giveaway_audit_log_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_audit_log" ADD CONSTRAINT "giveaway_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_audit_log_rels" ADD CONSTRAINT "giveaway_audit_log_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_audit_log_rels" ADD CONSTRAINT "giveaway_audit_log_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_engagements" ADD CONSTRAINT "giveaway_engagements_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_engagements" ADD CONSTRAINT "giveaway_engagements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_engagements" ADD CONSTRAINT "giveaway_engagements_content_id_partner_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."partner_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_engagements" ADD CONSTRAINT "giveaway_engagements_conversion_id_partner_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."partner_conversions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_engagements_rels" ADD CONSTRAINT "giveaway_engagements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_engagements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_engagements_rels" ADD CONSTRAINT "giveaway_engagements_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_prizes" ADD CONSTRAINT "giveaway_prizes_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_prizes" ADD CONSTRAINT "giveaway_prizes_prize_id_prize_catalogue_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."prize_catalogue"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_prizes_rels" ADD CONSTRAINT "giveaway_prizes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_prizes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_prizes_rels" ADD CONSTRAINT "giveaway_prizes_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaways_rels" ADD CONSTRAINT "giveaways_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaways"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaways_rels" ADD CONSTRAINT "giveaways_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_streaks" ADD CONSTRAINT "giveaway_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_streaks" ADD CONSTRAINT "giveaway_streaks_last_evaluated_giveaway_id_giveaways_id_fk" FOREIGN KEY ("last_evaluated_giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_streaks_rels" ADD CONSTRAINT "giveaway_streaks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_streaks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_streaks_rels" ADD CONSTRAINT "giveaway_streaks_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_tickets" ADD CONSTRAINT "giveaway_tickets_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_tickets" ADD CONSTRAINT "giveaway_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_tickets_rels" ADD CONSTRAINT "giveaway_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_tickets_rels" ADD CONSTRAINT "giveaway_tickets_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_prize_id_prize_catalogue_id_fk" FOREIGN KEY ("prize_id") REFERENCES "public"."prize_catalogue"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_winning_ticket_id_giveaway_tickets_id_fk" FOREIGN KEY ("winning_ticket_id") REFERENCES "public"."giveaway_tickets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_winners_rels" ADD CONSTRAINT "giveaway_winners_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_winners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_winners_rels" ADD CONSTRAINT "giveaway_winners_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prize_catalogue" ADD CONSTRAINT "prize_catalogue_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "prize_catalogue_rels" ADD CONSTRAINT "prize_catalogue_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."prize_catalogue"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prize_catalogue_rels" ADD CONSTRAINT "prize_catalogue_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "moderation_settings_alert_roles" ADD CONSTRAINT "moderation_settings_alert_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."moderation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "moderation_settings_additional_recipients" ADD CONSTRAINT "moderation_settings_additional_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."moderation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "moderation_settings_hide_on_first_report_reasons" ADD CONSTRAINT "moderation_settings_hide_on_first_report_reasons_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."moderation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "moderation_settings_urgent_reasons" ADD CONSTRAINT "moderation_settings_urgent_reasons_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."moderation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "moderation_settings_rels" ADD CONSTRAINT "moderation_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."moderation_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "moderation_settings_rels" ADD CONSTRAINT "moderation_settings_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "giveaway_audit_log_giveaway_idx" ON "giveaway_audit_log" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_audit_log_event_type_idx" ON "giveaway_audit_log" USING btree ("event_type");
  CREATE INDEX "giveaway_audit_log_user_idx" ON "giveaway_audit_log" USING btree ("user_id");
  CREATE INDEX "giveaway_audit_log_tier_idx" ON "giveaway_audit_log" USING btree ("tier");
  CREATE INDEX "giveaway_audit_log_occurred_at_idx" ON "giveaway_audit_log" USING btree ("occurred_at");
  CREATE INDEX "giveaway_audit_log_updated_at_idx" ON "giveaway_audit_log" USING btree ("updated_at");
  CREATE INDEX "giveaway_audit_log_created_at_idx" ON "giveaway_audit_log" USING btree ("created_at");
  CREATE INDEX "giveaway_audit_log_rels_order_idx" ON "giveaway_audit_log_rels" USING btree ("order");
  CREATE INDEX "giveaway_audit_log_rels_parent_idx" ON "giveaway_audit_log_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_audit_log_rels_path_idx" ON "giveaway_audit_log_rels" USING btree ("path");
  CREATE INDEX "giveaway_audit_log_rels_admins_id_idx" ON "giveaway_audit_log_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_engagements_giveaway_idx" ON "giveaway_engagements" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_engagements_user_idx" ON "giveaway_engagements" USING btree ("user_id");
  CREATE INDEX "giveaway_engagements_type_idx" ON "giveaway_engagements" USING btree ("type");
  CREATE INDEX "giveaway_engagements_content_idx" ON "giveaway_engagements" USING btree ("content_id");
  CREATE INDEX "giveaway_engagements_conversion_idx" ON "giveaway_engagements" USING btree ("conversion_id");
  CREATE INDEX "giveaway_engagements_completion_status_idx" ON "giveaway_engagements" USING btree ("completion_status");
  CREATE INDEX "giveaway_engagements_completed_at_idx" ON "giveaway_engagements" USING btree ("completed_at");
  CREATE INDEX "giveaway_engagements_updated_at_idx" ON "giveaway_engagements" USING btree ("updated_at");
  CREATE INDEX "giveaway_engagements_created_at_idx" ON "giveaway_engagements" USING btree ("created_at");
  CREATE INDEX "giveaway_engagements_rels_order_idx" ON "giveaway_engagements_rels" USING btree ("order");
  CREATE INDEX "giveaway_engagements_rels_parent_idx" ON "giveaway_engagements_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_engagements_rels_path_idx" ON "giveaway_engagements_rels" USING btree ("path");
  CREATE INDEX "giveaway_engagements_rels_admins_id_idx" ON "giveaway_engagements_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_prizes_giveaway_idx" ON "giveaway_prizes" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_prizes_prize_idx" ON "giveaway_prizes" USING btree ("prize_id");
  CREATE INDEX "giveaway_prizes_tier_idx" ON "giveaway_prizes" USING btree ("tier");
  CREATE INDEX "giveaway_prizes_updated_at_idx" ON "giveaway_prizes" USING btree ("updated_at");
  CREATE INDEX "giveaway_prizes_created_at_idx" ON "giveaway_prizes" USING btree ("created_at");
  CREATE INDEX "giveaway_prizes_rels_order_idx" ON "giveaway_prizes_rels" USING btree ("order");
  CREATE INDEX "giveaway_prizes_rels_parent_idx" ON "giveaway_prizes_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_prizes_rels_path_idx" ON "giveaway_prizes_rels" USING btree ("path");
  CREATE INDEX "giveaway_prizes_rels_admins_id_idx" ON "giveaway_prizes_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "giveaways_name_idx" ON "giveaways" USING btree ("name");
  CREATE INDEX "giveaways_status_idx" ON "giveaways" USING btree ("status");
  CREATE INDEX "giveaways_updated_at_idx" ON "giveaways" USING btree ("updated_at");
  CREATE INDEX "giveaways_created_at_idx" ON "giveaways" USING btree ("created_at");
  CREATE INDEX "giveaways_rels_order_idx" ON "giveaways_rels" USING btree ("order");
  CREATE INDEX "giveaways_rels_parent_idx" ON "giveaways_rels" USING btree ("parent_id");
  CREATE INDEX "giveaways_rels_path_idx" ON "giveaways_rels" USING btree ("path");
  CREATE INDEX "giveaways_rels_admins_id_idx" ON "giveaways_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_streaks_user_idx" ON "giveaway_streaks" USING btree ("user_id");
  CREATE INDEX "giveaway_streaks_tier_idx" ON "giveaway_streaks" USING btree ("tier");
  CREATE INDEX "giveaway_streaks_last_evaluated_giveaway_idx" ON "giveaway_streaks" USING btree ("last_evaluated_giveaway_id");
  CREATE INDEX "giveaway_streaks_updated_at_idx" ON "giveaway_streaks" USING btree ("updated_at");
  CREATE INDEX "giveaway_streaks_created_at_idx" ON "giveaway_streaks" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_tier_idx" ON "giveaway_streaks" USING btree ("user_id","tier");
  CREATE INDEX "giveaway_streaks_rels_order_idx" ON "giveaway_streaks_rels" USING btree ("order");
  CREATE INDEX "giveaway_streaks_rels_parent_idx" ON "giveaway_streaks_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_streaks_rels_path_idx" ON "giveaway_streaks_rels" USING btree ("path");
  CREATE INDEX "giveaway_streaks_rels_admins_id_idx" ON "giveaway_streaks_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_tickets_giveaway_idx" ON "giveaway_tickets" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_tickets_user_idx" ON "giveaway_tickets" USING btree ("user_id");
  CREATE INDEX "giveaway_tickets_status_idx" ON "giveaway_tickets" USING btree ("status");
  CREATE INDEX "giveaway_tickets_payment_reference_idx" ON "giveaway_tickets" USING btree ("payment_reference");
  CREATE INDEX "giveaway_tickets_purchased_at_idx" ON "giveaway_tickets" USING btree ("purchased_at");
  CREATE INDEX "giveaway_tickets_updated_at_idx" ON "giveaway_tickets" USING btree ("updated_at");
  CREATE INDEX "giveaway_tickets_created_at_idx" ON "giveaway_tickets" USING btree ("created_at");
  CREATE INDEX "giveaway_tickets_rels_order_idx" ON "giveaway_tickets_rels" USING btree ("order");
  CREATE INDEX "giveaway_tickets_rels_parent_idx" ON "giveaway_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_tickets_rels_path_idx" ON "giveaway_tickets_rels" USING btree ("path");
  CREATE INDEX "giveaway_tickets_rels_admins_id_idx" ON "giveaway_tickets_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_winners_giveaway_idx" ON "giveaway_winners" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_winners_user_idx" ON "giveaway_winners" USING btree ("user_id");
  CREATE INDEX "giveaway_winners_tier_idx" ON "giveaway_winners" USING btree ("tier");
  CREATE INDEX "giveaway_winners_prize_idx" ON "giveaway_winners" USING btree ("prize_id");
  CREATE INDEX "giveaway_winners_winning_ticket_idx" ON "giveaway_winners" USING btree ("winning_ticket_id");
  CREATE INDEX "giveaway_winners_claim_status_idx" ON "giveaway_winners" USING btree ("claim_status");
  CREATE INDEX "giveaway_winners_fulfilment_status_idx" ON "giveaway_winners" USING btree ("fulfilment_status");
  CREATE INDEX "giveaway_winners_updated_at_idx" ON "giveaway_winners" USING btree ("updated_at");
  CREATE INDEX "giveaway_winners_created_at_idx" ON "giveaway_winners" USING btree ("created_at");
  CREATE INDEX "giveaway_winners_rels_order_idx" ON "giveaway_winners_rels" USING btree ("order");
  CREATE INDEX "giveaway_winners_rels_parent_idx" ON "giveaway_winners_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_winners_rels_path_idx" ON "giveaway_winners_rels" USING btree ("path");
  CREATE INDEX "giveaway_winners_rels_admins_id_idx" ON "giveaway_winners_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "prize_catalogue_name_idx" ON "prize_catalogue" USING btree ("name");
  CREATE INDEX "prize_catalogue_tier_idx" ON "prize_catalogue" USING btree ("tier");
  CREATE INDEX "prize_catalogue_image_idx" ON "prize_catalogue" USING btree ("image_id");
  CREATE INDEX "prize_catalogue_active_idx" ON "prize_catalogue" USING btree ("active");
  CREATE INDEX "prize_catalogue_updated_at_idx" ON "prize_catalogue" USING btree ("updated_at");
  CREATE INDEX "prize_catalogue_created_at_idx" ON "prize_catalogue" USING btree ("created_at");
  CREATE INDEX "prize_catalogue_rels_order_idx" ON "prize_catalogue_rels" USING btree ("order");
  CREATE INDEX "prize_catalogue_rels_parent_idx" ON "prize_catalogue_rels" USING btree ("parent_id");
  CREATE INDEX "prize_catalogue_rels_path_idx" ON "prize_catalogue_rels" USING btree ("path");
  CREATE INDEX "prize_catalogue_rels_admins_id_idx" ON "prize_catalogue_rels" USING btree ("admins_id");
  CREATE INDEX "moderation_settings_alert_roles_order_idx" ON "moderation_settings_alert_roles" USING btree ("order");
  CREATE INDEX "moderation_settings_alert_roles_parent_idx" ON "moderation_settings_alert_roles" USING btree ("parent_id");
  CREATE INDEX "moderation_settings_additional_recipients_order_idx" ON "moderation_settings_additional_recipients" USING btree ("_order");
  CREATE INDEX "moderation_settings_additional_recipients_parent_id_idx" ON "moderation_settings_additional_recipients" USING btree ("_parent_id");
  CREATE INDEX "moderation_settings_hide_on_first_report_reasons_order_idx" ON "moderation_settings_hide_on_first_report_reasons" USING btree ("order");
  CREATE INDEX "moderation_settings_hide_on_first_report_reasons_parent_idx" ON "moderation_settings_hide_on_first_report_reasons" USING btree ("parent_id");
  CREATE INDEX "moderation_settings_urgent_reasons_order_idx" ON "moderation_settings_urgent_reasons" USING btree ("order");
  CREATE INDEX "moderation_settings_urgent_reasons_parent_idx" ON "moderation_settings_urgent_reasons" USING btree ("parent_id");
  CREATE INDEX "moderation_settings_rels_order_idx" ON "moderation_settings_rels" USING btree ("order");
  CREATE INDEX "moderation_settings_rels_parent_idx" ON "moderation_settings_rels" USING btree ("parent_id");
  CREATE INDEX "moderation_settings_rels_path_idx" ON "moderation_settings_rels" USING btree ("path");
  CREATE INDEX "moderation_settings_rels_admins_id_idx" ON "moderation_settings_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_audit_log_fk" FOREIGN KEY ("giveaway_audit_log_id") REFERENCES "public"."giveaway_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_engagements_fk" FOREIGN KEY ("giveaway_engagements_id") REFERENCES "public"."giveaway_engagements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_prizes_fk" FOREIGN KEY ("giveaway_prizes_id") REFERENCES "public"."giveaway_prizes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaways_fk" FOREIGN KEY ("giveaways_id") REFERENCES "public"."giveaways"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_streaks_fk" FOREIGN KEY ("giveaway_streaks_id") REFERENCES "public"."giveaway_streaks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_tickets_fk" FOREIGN KEY ("giveaway_tickets_id") REFERENCES "public"."giveaway_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_winners_fk" FOREIGN KEY ("giveaway_winners_id") REFERENCES "public"."giveaway_winners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_prize_catalogue_fk" FOREIGN KEY ("prize_catalogue_id") REFERENCES "public"."prize_catalogue"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "comments_moderation_status_idx" ON "comments" USING btree ("moderation_status");
  CREATE INDEX "content_reports_type_idx" ON "content_reports" USING btree ("type");
  CREATE INDEX "payload_locked_documents_rels_giveaway_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_engagements_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_engagements_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_prizes_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_prizes_id");
  CREATE INDEX "payload_locked_documents_rels_giveaways_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaways_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_streaks_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_streaks_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_winners_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_winners_id");
  CREATE INDEX "payload_locked_documents_rels_prize_catalogue_id_idx" ON "payload_locked_documents_rels" USING btree ("prize_catalogue_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "giveaway_audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_audit_log_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_engagements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_engagements_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_prizes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_prizes_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaways" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaways_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_streaks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_streaks_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_tickets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_tickets_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_winners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_winners_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "prize_catalogue" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "prize_catalogue_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_settings_alert_roles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_settings_additional_recipients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_settings_hide_on_first_report_reasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_settings_urgent_reasons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "moderation_settings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "giveaway_audit_log" CASCADE;
  DROP TABLE "giveaway_audit_log_rels" CASCADE;
  DROP TABLE "giveaway_engagements" CASCADE;
  DROP TABLE "giveaway_engagements_rels" CASCADE;
  DROP TABLE "giveaway_prizes" CASCADE;
  DROP TABLE "giveaway_prizes_rels" CASCADE;
  DROP TABLE "giveaways" CASCADE;
  DROP TABLE "giveaways_rels" CASCADE;
  DROP TABLE "giveaway_streaks" CASCADE;
  DROP TABLE "giveaway_streaks_rels" CASCADE;
  DROP TABLE "giveaway_tickets" CASCADE;
  DROP TABLE "giveaway_tickets_rels" CASCADE;
  DROP TABLE "giveaway_winners" CASCADE;
  DROP TABLE "giveaway_winners_rels" CASCADE;
  DROP TABLE "prize_catalogue" CASCADE;
  DROP TABLE "prize_catalogue_rels" CASCADE;
  DROP TABLE "moderation_settings_alert_roles" CASCADE;
  DROP TABLE "moderation_settings_additional_recipients" CASCADE;
  DROP TABLE "moderation_settings_hide_on_first_report_reasons" CASCADE;
  DROP TABLE "moderation_settings_urgent_reasons" CASCADE;
  DROP TABLE "moderation_settings" CASCADE;
  DROP TABLE "moderation_settings_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_audit_log_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_engagements_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_prizes_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaways_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_streaks_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_tickets_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_winners_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_prize_catalogue_fk";

  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'sendModerationDigest', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'sendModerationDigest', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "comments_moderation_status_idx";
  DROP INDEX "content_reports_type_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_audit_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_engagements_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_prizes_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaways_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_streaks_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_tickets_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_winners_id_idx";
  DROP INDEX "payload_locked_documents_rels_prize_catalogue_id_idx";
  ALTER TABLE "admins" DROP COLUMN "moderation_alerts";
  ALTER TABLE "comments" DROP COLUMN "moderation_status";
  ALTER TABLE "content_reports" DROP COLUMN "type";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_engagements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_prizes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaways_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_streaks_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_tickets_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_winners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "prize_catalogue_id";
  DROP TYPE "public"."enum_admins_moderation_alerts";
  DROP TYPE "public"."enum_comments_moderation_status";
  DROP TYPE "public"."enum_content_reports_type";
  DROP TYPE "public"."enum_giveaway_audit_log_event_type";
  DROP TYPE "public"."enum_giveaway_engagements_type";
  DROP TYPE "public"."enum_giveaway_engagements_completion_status";
  DROP TYPE "public"."enum_giveaway_prizes_tier";
  DROP TYPE "public"."enum_giveaways_status";
  DROP TYPE "public"."enum_giveaway_streaks_tier";
  DROP TYPE "public"."enum_giveaway_tickets_status";
  DROP TYPE "public"."enum_giveaway_winners_tier";
  DROP TYPE "public"."enum_giveaway_winners_claim_status";
  DROP TYPE "public"."enum_giveaway_winners_fulfilment_status";
  DROP TYPE "public"."enum_prize_catalogue_tier";
  DROP TYPE "public"."enum_moderation_settings_alert_roles";
  DROP TYPE "public"."enum_moderation_settings_additional_recipients_tier";
  DROP TYPE "public"."enum_moderation_settings_hide_on_first_report_reasons";
  DROP TYPE "public"."enum_moderation_settings_urgent_reasons";`)
}
