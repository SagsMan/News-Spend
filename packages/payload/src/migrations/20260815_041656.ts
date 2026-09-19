import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_giveaway_account_flags_trust_status" AS ENUM('ok', 'suspicious', 'disqualified');
  CREATE TYPE "public"."enum_giveaway_draw_attempts_kind" AS ENUM('initial', 'resumption');
  CREATE TYPE "public"."enum_giveaway_draw_attempts_outcome" AS ENUM('running', 'completed', 'interrupted', 'failed');
  CREATE TYPE "public"."enum_giveaway_draw_attempts_last_checkpoint" AS ENUM('config_validated', 'pool_generated', 'pool_locked', 'tier1_winners_selected', 'tier1_prizes_allocated', 'tier2_winners_selected', 'tier2_prizes_allocated', 'tier3_winners_selected', 'tier3_prizes_allocated', 'final_validation', 'result_confirmed', 'audit_completed', 'winner_report_generated');
  CREATE TYPE "public"."enum_giveaway_fulfilment_attempts_provider" AS ENUM('reloadly');
  CREATE TYPE "public"."enum_giveaway_fulfilment_attempts_environment" AS ENUM('sandbox', 'live');
  CREATE TYPE "public"."enum_giveaway_fulfilment_attempts_outcome" AS ENUM('sent', 'already_sent', 'retryable_failure', 'permanent_failure', 'skipped');
  CREATE TYPE "public"."enum_giveaway_pool_snapshots_tier" AS ENUM('tier1', 'tier2', 'tier3');
  CREATE TYPE "public"."enum_giveaway_report_deliveries_kind" AS ENUM('original', 'resend');
  CREATE TYPE "public"."enum_giveaway_report_deliveries_status" AS ENUM('pending', 'sent', 'failed');
  CREATE TYPE "public"."enum_giveaways_last_checkpoint" AS ENUM('config_validated', 'pool_generated', 'pool_locked', 'tier1_winners_selected', 'tier1_prizes_allocated', 'tier2_winners_selected', 'tier2_prizes_allocated', 'tier3_winners_selected', 'tier3_prizes_allocated', 'final_validation', 'result_confirmed', 'audit_completed', 'winner_report_generated');
  CREATE TYPE "public"."enum_prize_catalogue_reloadly_data_plans_network" AS ENUM('mtn', 'airtel', 'glo', 't2');
  CREATE TYPE "public"."enum_prize_catalogue_fulfilment_type" AS ENUM('points', 'airtime', 'data', 'gift_card', 'physical', 'experience');
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'candidate_pool_locked' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'checkpoint_reached' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'draw_interrupted' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'resumption_authorized' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'giveaway_cancelled' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'winner_disqualified' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'replacement_selected' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'winner_held_ticket_invalid' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'account_excluded' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'fairness_exclusion' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'loyalty_waiver_applied' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'winner_held_for_review' BEFORE 'winner_selected';
  ALTER TYPE "public"."enum_giveaway_audit_log_event_type" ADD VALUE 'budget_limit_reached' BEFORE 'tier_completed';
  ALTER TYPE "public"."enum_giveaway_winners_claim_status" ADD VALUE 'disqualified';
  ALTER TYPE "public"."enum_giveaway_winners_fulfilment_status" ADD VALUE 'awaiting_verification' BEFORE 'in_progress';
  ALTER TYPE "public"."enum_giveaway_winners_fulfilment_status" ADD VALUE 'on_hold' BEFORE 'in_progress';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'processGiveaway' BEFORE 'cleanupAnonymousUsers';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'processGiveaway' BEFORE 'cleanupAnonymousUsers';
  CREATE TABLE "giveaway_account_flags" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"trust_status" "enum_giveaway_account_flags_trust_status" DEFAULT 'suspicious' NOT NULL,
  	"duplicate_account_group" varchar,
  	"reason" varchar,
  	"flagged_at" timestamp(3) with time zone NOT NULL,
  	"reviewed_by_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_account_flags_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_draw_attempts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"execution_id" varchar NOT NULL,
  	"attempt_number" numeric NOT NULL,
  	"kind" "enum_giveaway_draw_attempts_kind" NOT NULL,
  	"resumes_id" uuid,
  	"seed" varchar NOT NULL,
  	"outcome" "enum_giveaway_draw_attempts_outcome" DEFAULT 'running' NOT NULL,
  	"last_checkpoint" "enum_giveaway_draw_attempts_last_checkpoint",
  	"authorized_by" varchar,
  	"error" varchar,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"ended_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_draw_attempts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_fulfilment_attempts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"winner_id" uuid NOT NULL,
  	"provider" "enum_giveaway_fulfilment_attempts_provider" DEFAULT 'reloadly' NOT NULL,
  	"environment" "enum_giveaway_fulfilment_attempts_environment" NOT NULL,
  	"outcome" "enum_giveaway_fulfilment_attempts_outcome" NOT NULL,
  	"provider_reference" varchar,
  	"provider_transaction_id" varchar,
  	"operator_id" numeric,
  	"operator_name" varchar,
  	"local_amount" numeric,
  	"recipient_phone" varchar,
  	"error" varchar,
  	"attempted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_fulfilment_attempts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_pool_snapshots" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"tier" "enum_giveaway_pool_snapshots_tier" NOT NULL,
  	"candidate_count" numeric NOT NULL,
  	"entries" jsonb NOT NULL,
  	"locked_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_pool_snapshots_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "giveaway_report_deliveries" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"giveaway_id" uuid NOT NULL,
  	"kind" "enum_giveaway_report_deliveries_kind" NOT NULL,
  	"status" "enum_giveaway_report_deliveries_status" DEFAULT 'pending' NOT NULL,
  	"recipient" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"attachment_file_name" varchar,
  	"winner_count" numeric,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"provider_message_id" varchar,
  	"error" varchar,
  	"requested_by" varchar,
  	"sent_at" timestamp(3) with time zone,
  	"created_at_iso" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "giveaway_report_deliveries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "prize_catalogue_reloadly_data_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"network" "enum_prize_catalogue_reloadly_data_plans_network",
  	"reloadly_operator_id" numeric,
  	"reloadly_local_amount" numeric
  );

  CREATE TABLE "user_blocks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"blocker_id" uuid NOT NULL,
  	"blocked_id" uuid NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "user_blocks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "users_rels" DROP CONSTRAINT "users_rels_users_fk";

  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_giveaways_status";
  CREATE TYPE "public"."enum_giveaways_status" AS ENUM('draft', 'active', 'ready', 'pool_building', 'pool_locked', 'draw_in_progress', 'interrupted', 'resumption_authorized', 'completed', 'failed', 'cancelled');
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_giveaways_status";
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DATA TYPE "public"."enum_giveaways_status" USING "status"::"public"."enum_giveaways_status";
  DROP INDEX "users_rels_users_id_idx";
  ALTER TABLE "giveaways" ADD COLUMN "min_tickets_required" numeric DEFAULT 1 NOT NULL;
  ALTER TABLE "giveaways" ADD COLUMN "budget_utilization_pct" numeric DEFAULT 100 NOT NULL;
  ALTER TABLE "giveaways" ADD COLUMN "max_budget_cap_naira" numeric;
  ALTER TABLE "giveaways" ADD COLUMN "draw_execution_id" varchar;
  ALTER TABLE "giveaways" ADD COLUMN "last_checkpoint" "enum_giveaways_last_checkpoint";
  ALTER TABLE "giveaways" ADD COLUMN "current_attempt_id" uuid;
  ALTER TABLE "giveaways" ADD COLUMN "resumption_authorized_by" varchar;
  ALTER TABLE "giveaways" ADD COLUMN "resumption_authorized_at" timestamp(3) with time zone;
  ALTER TABLE "giveaway_winners" ADD COLUMN "claim_phone" varchar;
  ALTER TABLE "giveaway_winners" ADD COLUMN "claim_recipient_name" varchar;
  ALTER TABLE "giveaway_winners" ADD COLUMN "claim_address" varchar;
  ALTER TABLE "giveaway_winners" ADD COLUMN "review_note" varchar;
  ALTER TABLE "giveaway_winners" ADD COLUMN "replaces_id" uuid;
  ALTER TABLE "giveaway_winners" ADD COLUMN "disqualified_at" timestamp(3) with time zone;
  ALTER TABLE "giveaway_winners" ADD COLUMN "disqualification_reason" varchar;
  ALTER TABLE "prize_catalogue" ADD COLUMN "fulfilment_type" "enum_prize_catalogue_fulfilment_type" DEFAULT 'physical' NOT NULL;
  ALTER TABLE "prize_catalogue" ADD COLUMN "points_amount" numeric;
  ALTER TABLE "prize_catalogue" ADD COLUMN "value_naira" numeric;
  ALTER TABLE "prize_catalogue" ADD COLUMN "requires_verification" boolean DEFAULT false;
  ALTER TABLE "prize_catalogue" ADD COLUMN "reloadly_local_amount" numeric;
  ALTER TABLE "users" ADD COLUMN "date_of_birth" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "country" varchar;
  ALTER TABLE "users" ADD COLUMN "verified_country" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_account_flags_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_draw_attempts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_fulfilment_attempts_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_pool_snapshots_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "giveaway_report_deliveries_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_blocks_id" uuid;
  ALTER TABLE "giveaway_account_flags" ADD CONSTRAINT "giveaway_account_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_account_flags" ADD CONSTRAINT "giveaway_account_flags_reviewed_by_id_admins_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_account_flags_rels" ADD CONSTRAINT "giveaway_account_flags_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_account_flags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_account_flags_rels" ADD CONSTRAINT "giveaway_account_flags_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_draw_attempts" ADD CONSTRAINT "giveaway_draw_attempts_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_draw_attempts" ADD CONSTRAINT "giveaway_draw_attempts_resumes_id_giveaway_draw_attempts_id_fk" FOREIGN KEY ("resumes_id") REFERENCES "public"."giveaway_draw_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_draw_attempts_rels" ADD CONSTRAINT "giveaway_draw_attempts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_draw_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_draw_attempts_rels" ADD CONSTRAINT "giveaway_draw_attempts_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_fulfilment_attempts" ADD CONSTRAINT "giveaway_fulfilment_attempts_winner_id_giveaway_winners_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."giveaway_winners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_fulfilment_attempts_rels" ADD CONSTRAINT "giveaway_fulfilment_attempts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_fulfilment_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_fulfilment_attempts_rels" ADD CONSTRAINT "giveaway_fulfilment_attempts_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_pool_snapshots" ADD CONSTRAINT "giveaway_pool_snapshots_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_pool_snapshots_rels" ADD CONSTRAINT "giveaway_pool_snapshots_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_pool_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_pool_snapshots_rels" ADD CONSTRAINT "giveaway_pool_snapshots_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_report_deliveries" ADD CONSTRAINT "giveaway_report_deliveries_giveaway_id_giveaways_id_fk" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_report_deliveries_rels" ADD CONSTRAINT "giveaway_report_deliveries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."giveaway_report_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "giveaway_report_deliveries_rels" ADD CONSTRAINT "giveaway_report_deliveries_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "prize_catalogue_reloadly_data_plans" ADD CONSTRAINT "prize_catalogue_reloadly_data_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."prize_catalogue"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_blocks_rels" ADD CONSTRAINT "user_blocks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user_blocks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_blocks_rels" ADD CONSTRAINT "user_blocks_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "giveaway_account_flags_user_idx" ON "giveaway_account_flags" USING btree ("user_id");
  CREATE INDEX "giveaway_account_flags_trust_status_idx" ON "giveaway_account_flags" USING btree ("trust_status");
  CREATE INDEX "giveaway_account_flags_duplicate_account_group_idx" ON "giveaway_account_flags" USING btree ("duplicate_account_group");
  CREATE INDEX "giveaway_account_flags_reviewed_by_idx" ON "giveaway_account_flags" USING btree ("reviewed_by_id");
  CREATE INDEX "giveaway_account_flags_updated_at_idx" ON "giveaway_account_flags" USING btree ("updated_at");
  CREATE INDEX "giveaway_account_flags_created_at_idx" ON "giveaway_account_flags" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_idx" ON "giveaway_account_flags" USING btree ("user_id");
  CREATE INDEX "giveaway_account_flags_rels_order_idx" ON "giveaway_account_flags_rels" USING btree ("order");
  CREATE INDEX "giveaway_account_flags_rels_parent_idx" ON "giveaway_account_flags_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_account_flags_rels_path_idx" ON "giveaway_account_flags_rels" USING btree ("path");
  CREATE INDEX "giveaway_account_flags_rels_admins_id_idx" ON "giveaway_account_flags_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_draw_attempts_giveaway_idx" ON "giveaway_draw_attempts" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_draw_attempts_execution_id_idx" ON "giveaway_draw_attempts" USING btree ("execution_id");
  CREATE INDEX "giveaway_draw_attempts_kind_idx" ON "giveaway_draw_attempts" USING btree ("kind");
  CREATE INDEX "giveaway_draw_attempts_resumes_idx" ON "giveaway_draw_attempts" USING btree ("resumes_id");
  CREATE INDEX "giveaway_draw_attempts_outcome_idx" ON "giveaway_draw_attempts" USING btree ("outcome");
  CREATE INDEX "giveaway_draw_attempts_updated_at_idx" ON "giveaway_draw_attempts" USING btree ("updated_at");
  CREATE INDEX "giveaway_draw_attempts_created_at_idx" ON "giveaway_draw_attempts" USING btree ("created_at");
  CREATE INDEX "giveaway_draw_attempts_rels_order_idx" ON "giveaway_draw_attempts_rels" USING btree ("order");
  CREATE INDEX "giveaway_draw_attempts_rels_parent_idx" ON "giveaway_draw_attempts_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_draw_attempts_rels_path_idx" ON "giveaway_draw_attempts_rels" USING btree ("path");
  CREATE INDEX "giveaway_draw_attempts_rels_admins_id_idx" ON "giveaway_draw_attempts_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_fulfilment_attempts_winner_idx" ON "giveaway_fulfilment_attempts" USING btree ("winner_id");
  CREATE INDEX "giveaway_fulfilment_attempts_provider_idx" ON "giveaway_fulfilment_attempts" USING btree ("provider");
  CREATE INDEX "giveaway_fulfilment_attempts_outcome_idx" ON "giveaway_fulfilment_attempts" USING btree ("outcome");
  CREATE INDEX "giveaway_fulfilment_attempts_provider_reference_idx" ON "giveaway_fulfilment_attempts" USING btree ("provider_reference");
  CREATE INDEX "giveaway_fulfilment_attempts_provider_transaction_id_idx" ON "giveaway_fulfilment_attempts" USING btree ("provider_transaction_id");
  CREATE INDEX "giveaway_fulfilment_attempts_updated_at_idx" ON "giveaway_fulfilment_attempts" USING btree ("updated_at");
  CREATE INDEX "giveaway_fulfilment_attempts_created_at_idx" ON "giveaway_fulfilment_attempts" USING btree ("created_at");
  CREATE INDEX "giveaway_fulfilment_attempts_rels_order_idx" ON "giveaway_fulfilment_attempts_rels" USING btree ("order");
  CREATE INDEX "giveaway_fulfilment_attempts_rels_parent_idx" ON "giveaway_fulfilment_attempts_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_fulfilment_attempts_rels_path_idx" ON "giveaway_fulfilment_attempts_rels" USING btree ("path");
  CREATE INDEX "giveaway_fulfilment_attempts_rels_admins_id_idx" ON "giveaway_fulfilment_attempts_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_pool_snapshots_giveaway_idx" ON "giveaway_pool_snapshots" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_pool_snapshots_tier_idx" ON "giveaway_pool_snapshots" USING btree ("tier");
  CREATE INDEX "giveaway_pool_snapshots_updated_at_idx" ON "giveaway_pool_snapshots" USING btree ("updated_at");
  CREATE INDEX "giveaway_pool_snapshots_created_at_idx" ON "giveaway_pool_snapshots" USING btree ("created_at");
  CREATE UNIQUE INDEX "giveaway_tier_idx" ON "giveaway_pool_snapshots" USING btree ("giveaway_id","tier");
  CREATE INDEX "giveaway_pool_snapshots_rels_order_idx" ON "giveaway_pool_snapshots_rels" USING btree ("order");
  CREATE INDEX "giveaway_pool_snapshots_rels_parent_idx" ON "giveaway_pool_snapshots_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_pool_snapshots_rels_path_idx" ON "giveaway_pool_snapshots_rels" USING btree ("path");
  CREATE INDEX "giveaway_pool_snapshots_rels_admins_id_idx" ON "giveaway_pool_snapshots_rels" USING btree ("admins_id");
  CREATE INDEX "giveaway_report_deliveries_giveaway_idx" ON "giveaway_report_deliveries" USING btree ("giveaway_id");
  CREATE INDEX "giveaway_report_deliveries_kind_idx" ON "giveaway_report_deliveries" USING btree ("kind");
  CREATE INDEX "giveaway_report_deliveries_status_idx" ON "giveaway_report_deliveries" USING btree ("status");
  CREATE INDEX "giveaway_report_deliveries_provider_message_id_idx" ON "giveaway_report_deliveries" USING btree ("provider_message_id");
  CREATE INDEX "giveaway_report_deliveries_updated_at_idx" ON "giveaway_report_deliveries" USING btree ("updated_at");
  CREATE INDEX "giveaway_report_deliveries_created_at_idx" ON "giveaway_report_deliveries" USING btree ("created_at");
  CREATE INDEX "giveaway_report_deliveries_rels_order_idx" ON "giveaway_report_deliveries_rels" USING btree ("order");
  CREATE INDEX "giveaway_report_deliveries_rels_parent_idx" ON "giveaway_report_deliveries_rels" USING btree ("parent_id");
  CREATE INDEX "giveaway_report_deliveries_rels_path_idx" ON "giveaway_report_deliveries_rels" USING btree ("path");
  CREATE INDEX "giveaway_report_deliveries_rels_admins_id_idx" ON "giveaway_report_deliveries_rels" USING btree ("admins_id");
  CREATE INDEX "prize_catalogue_reloadly_data_plans_order_idx" ON "prize_catalogue_reloadly_data_plans" USING btree ("_order");
  CREATE INDEX "prize_catalogue_reloadly_data_plans_parent_id_idx" ON "prize_catalogue_reloadly_data_plans" USING btree ("_parent_id");
  CREATE INDEX "user_blocks_blocker_idx" ON "user_blocks" USING btree ("blocker_id");
  CREATE INDEX "user_blocks_blocked_idx" ON "user_blocks" USING btree ("blocked_id");
  CREATE INDEX "user_blocks_updated_at_idx" ON "user_blocks" USING btree ("updated_at");
  CREATE INDEX "user_blocks_created_at_idx" ON "user_blocks" USING btree ("created_at");
  CREATE UNIQUE INDEX "blocker_blocked_idx" ON "user_blocks" USING btree ("blocker_id","blocked_id");
  CREATE INDEX "user_blocks_rels_order_idx" ON "user_blocks_rels" USING btree ("order");
  CREATE INDEX "user_blocks_rels_parent_idx" ON "user_blocks_rels" USING btree ("parent_id");
  CREATE INDEX "user_blocks_rels_path_idx" ON "user_blocks_rels" USING btree ("path");
  CREATE INDEX "user_blocks_rels_admins_id_idx" ON "user_blocks_rels" USING btree ("admins_id");
  ALTER TABLE "giveaways" ADD CONSTRAINT "giveaways_current_attempt_id_giveaway_draw_attempts_id_fk" FOREIGN KEY ("current_attempt_id") REFERENCES "public"."giveaway_draw_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "giveaway_winners" ADD CONSTRAINT "giveaway_winners_replaces_id_giveaway_winners_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "public"."giveaway_winners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_account_flags_fk" FOREIGN KEY ("giveaway_account_flags_id") REFERENCES "public"."giveaway_account_flags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_draw_attempts_fk" FOREIGN KEY ("giveaway_draw_attempts_id") REFERENCES "public"."giveaway_draw_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_fulfilment_attempt_fk" FOREIGN KEY ("giveaway_fulfilment_attempts_id") REFERENCES "public"."giveaway_fulfilment_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_pool_snapshots_fk" FOREIGN KEY ("giveaway_pool_snapshots_id") REFERENCES "public"."giveaway_pool_snapshots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giveaway_report_deliveries_fk" FOREIGN KEY ("giveaway_report_deliveries_id") REFERENCES "public"."giveaway_report_deliveries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_blocks_fk" FOREIGN KEY ("user_blocks_id") REFERENCES "public"."user_blocks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "giveaways_draw_execution_id_idx" ON "giveaways" USING btree ("draw_execution_id");
  CREATE INDEX "giveaways_current_attempt_idx" ON "giveaways" USING btree ("current_attempt_id");
  CREATE INDEX "giveaway_winners_replaces_idx" ON "giveaway_winners" USING btree ("replaces_id");
  CREATE INDEX "prize_catalogue_fulfilment_type_idx" ON "prize_catalogue" USING btree ("fulfilment_type");
  CREATE INDEX "prize_catalogue_requires_verification_idx" ON "prize_catalogue" USING btree ("requires_verification");
  CREATE INDEX "users_date_of_birth_idx" ON "users" USING btree ("date_of_birth");
  CREATE INDEX "users_country_idx" ON "users" USING btree ("country");
  CREATE INDEX "users_verified_country_idx" ON "users" USING btree ("verified_country");
  CREATE INDEX "payload_locked_documents_rels_giveaway_account_flags_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_account_flags_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_draw_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_draw_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_fulfilment_attemp_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_fulfilment_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_pool_snapshots_id_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_pool_snapshots_id");
  CREATE INDEX "payload_locked_documents_rels_giveaway_report_deliveries_idx" ON "payload_locked_documents_rels" USING btree ("giveaway_report_deliveries_id");
  CREATE INDEX "payload_locked_documents_rels_user_blocks_id_idx" ON "payload_locked_documents_rels" USING btree ("user_blocks_id");
  ALTER TABLE "users" DROP COLUMN "reported_comments";
  ALTER TABLE "users_rels" DROP COLUMN "users_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "giveaway_account_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_account_flags_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_draw_attempts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_draw_attempts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_fulfilment_attempts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_fulfilment_attempts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_pool_snapshots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_pool_snapshots_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_report_deliveries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "giveaway_report_deliveries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "prize_catalogue_reloadly_data_plans" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_blocks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "user_blocks_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "giveaway_account_flags" CASCADE;
  DROP TABLE "giveaway_account_flags_rels" CASCADE;
  DROP TABLE "giveaway_draw_attempts" CASCADE;
  DROP TABLE "giveaway_draw_attempts_rels" CASCADE;
  DROP TABLE "giveaway_fulfilment_attempts" CASCADE;
  DROP TABLE "giveaway_fulfilment_attempts_rels" CASCADE;
  DROP TABLE "giveaway_pool_snapshots" CASCADE;
  DROP TABLE "giveaway_pool_snapshots_rels" CASCADE;
  DROP TABLE "giveaway_report_deliveries" CASCADE;
  DROP TABLE "giveaway_report_deliveries_rels" CASCADE;
  DROP TABLE "prize_catalogue_reloadly_data_plans" CASCADE;
  DROP TABLE "user_blocks" CASCADE;
  DROP TABLE "user_blocks_rels" CASCADE;
  ALTER TABLE "giveaways" DROP CONSTRAINT "giveaways_current_attempt_id_giveaway_draw_attempts_id_fk";

  ALTER TABLE "giveaway_winners" DROP CONSTRAINT "giveaway_winners_replaces_id_giveaway_winners_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_account_flags_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_draw_attempts_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_fulfilment_attempt_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_pool_snapshots_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_giveaway_report_deliveries_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_user_blocks_fk";

  ALTER TABLE "giveaway_audit_log" ALTER COLUMN "event_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_giveaway_audit_log_event_type";
  CREATE TYPE "public"."enum_giveaway_audit_log_event_type" AS ENUM('ticket_purchase', 'ticket_status_change', 'boost_completion', 'featured_offer_completion', 'participants_snapshot', 'candidate_pool_built', 'winner_selected', 'prize_allocated', 'prize_exhausted', 'tier_completed', 'draw_started', 'draw_resumed', 'draw_completed', 'draw_error', 'winner_report_sent', 'claim_status_change');
  ALTER TABLE "giveaway_audit_log" ALTER COLUMN "event_type" SET DATA TYPE "public"."enum_giveaway_audit_log_event_type" USING "event_type"::"public"."enum_giveaway_audit_log_event_type";
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_giveaways_status";
  CREATE TYPE "public"."enum_giveaways_status" AS ENUM('draft', 'active', 'drawing', 'completed', 'failed');
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_giveaways_status";
  ALTER TABLE "giveaways" ALTER COLUMN "status" SET DATA TYPE "public"."enum_giveaways_status" USING "status"::"public"."enum_giveaways_status";
  ALTER TABLE "giveaway_winners" ALTER COLUMN "claim_status" SET DATA TYPE text;
  ALTER TABLE "giveaway_winners" ALTER COLUMN "claim_status" SET DEFAULT 'unclaimed'::text;
  DROP TYPE "public"."enum_giveaway_winners_claim_status";
  CREATE TYPE "public"."enum_giveaway_winners_claim_status" AS ENUM('unclaimed', 'claimed', 'expired', 'forfeited');
  ALTER TABLE "giveaway_winners" ALTER COLUMN "claim_status" SET DEFAULT 'unclaimed'::"public"."enum_giveaway_winners_claim_status";
  ALTER TABLE "giveaway_winners" ALTER COLUMN "claim_status" SET DATA TYPE "public"."enum_giveaway_winners_claim_status" USING "claim_status"::"public"."enum_giveaway_winners_claim_status";
  ALTER TABLE "giveaway_winners" ALTER COLUMN "fulfilment_status" SET DATA TYPE text;
  ALTER TABLE "giveaway_winners" ALTER COLUMN "fulfilment_status" SET DEFAULT 'pending'::text;
  DROP TYPE "public"."enum_giveaway_winners_fulfilment_status";
  CREATE TYPE "public"."enum_giveaway_winners_fulfilment_status" AS ENUM('pending', 'in_progress', 'fulfilled', 'cancelled');
  ALTER TABLE "giveaway_winners" ALTER COLUMN "fulfilment_status" SET DEFAULT 'pending'::"public"."enum_giveaway_winners_fulfilment_status";
  ALTER TABLE "giveaway_winners" ALTER COLUMN "fulfilment_status" SET DATA TYPE "public"."enum_giveaway_winners_fulfilment_status" USING "fulfilment_status"::"public"."enum_giveaway_winners_fulfilment_status";
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'sendModerationDigest', 'sendUrgentModerationAlert', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'sendScheduledNotification', 'sendCommentLikeNotification', 'sendModerationDigest', 'sendUrgentModerationAlert', 'checkPushReceipts', 'processLottery', 'cleanupAnonymousUsers', 'generateVideoThumbnail', 'deleteVideoThumbTemp', 'cleanupAuditLogs');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  DROP INDEX "giveaways_draw_execution_id_idx";
  DROP INDEX "giveaways_current_attempt_idx";
  DROP INDEX "giveaway_winners_replaces_idx";
  DROP INDEX "prize_catalogue_fulfilment_type_idx";
  DROP INDEX "prize_catalogue_requires_verification_idx";
  DROP INDEX "users_date_of_birth_idx";
  DROP INDEX "users_country_idx";
  DROP INDEX "users_verified_country_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_account_flags_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_draw_attempts_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_fulfilment_attemp_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_pool_snapshots_id_idx";
  DROP INDEX "payload_locked_documents_rels_giveaway_report_deliveries_idx";
  DROP INDEX "payload_locked_documents_rels_user_blocks_id_idx";
  ALTER TABLE "users" ADD COLUMN "reported_comments" jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE "users_rels" ADD COLUMN "users_id" uuid;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_users_id_idx" ON "users_rels" USING btree ("users_id");
  ALTER TABLE "giveaways" DROP COLUMN "min_tickets_required";
  ALTER TABLE "giveaways" DROP COLUMN "budget_utilization_pct";
  ALTER TABLE "giveaways" DROP COLUMN "max_budget_cap_naira";
  ALTER TABLE "giveaways" DROP COLUMN "draw_execution_id";
  ALTER TABLE "giveaways" DROP COLUMN "last_checkpoint";
  ALTER TABLE "giveaways" DROP COLUMN "current_attempt_id";
  ALTER TABLE "giveaways" DROP COLUMN "resumption_authorized_by";
  ALTER TABLE "giveaways" DROP COLUMN "resumption_authorized_at";
  ALTER TABLE "giveaway_winners" DROP COLUMN "claim_phone";
  ALTER TABLE "giveaway_winners" DROP COLUMN "claim_recipient_name";
  ALTER TABLE "giveaway_winners" DROP COLUMN "claim_address";
  ALTER TABLE "giveaway_winners" DROP COLUMN "review_note";
  ALTER TABLE "giveaway_winners" DROP COLUMN "replaces_id";
  ALTER TABLE "giveaway_winners" DROP COLUMN "disqualified_at";
  ALTER TABLE "giveaway_winners" DROP COLUMN "disqualification_reason";
  ALTER TABLE "prize_catalogue" DROP COLUMN "fulfilment_type";
  ALTER TABLE "prize_catalogue" DROP COLUMN "points_amount";
  ALTER TABLE "prize_catalogue" DROP COLUMN "value_naira";
  ALTER TABLE "prize_catalogue" DROP COLUMN "requires_verification";
  ALTER TABLE "prize_catalogue" DROP COLUMN "reloadly_local_amount";
  ALTER TABLE "users" DROP COLUMN "date_of_birth";
  ALTER TABLE "users" DROP COLUMN "country";
  ALTER TABLE "users" DROP COLUMN "verified_country";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_account_flags_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_draw_attempts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_fulfilment_attempts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_pool_snapshots_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "giveaway_report_deliveries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "user_blocks_id";
  DROP TYPE "public"."enum_giveaway_account_flags_trust_status";
  DROP TYPE "public"."enum_giveaway_draw_attempts_kind";
  DROP TYPE "public"."enum_giveaway_draw_attempts_outcome";
  DROP TYPE "public"."enum_giveaway_draw_attempts_last_checkpoint";
  DROP TYPE "public"."enum_giveaway_fulfilment_attempts_provider";
  DROP TYPE "public"."enum_giveaway_fulfilment_attempts_environment";
  DROP TYPE "public"."enum_giveaway_fulfilment_attempts_outcome";
  DROP TYPE "public"."enum_giveaway_pool_snapshots_tier";
  DROP TYPE "public"."enum_giveaway_report_deliveries_kind";
  DROP TYPE "public"."enum_giveaway_report_deliveries_status";
  DROP TYPE "public"."enum_giveaways_last_checkpoint";
  DROP TYPE "public"."enum_prize_catalogue_reloadly_data_plans_network";
  DROP TYPE "public"."enum_prize_catalogue_fulfilment_type";`)
}
