import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_partner_conversions_status" AS ENUM('clicked', 'converted', 'awarded', 'failed');
  CREATE TYPE "public"."enum_partners_integration_method" AS ENUM('manual', 'webhook', 'postback', 'csv');
  ALTER TYPE "public"."enum_activities_action" ADD VALUE 'partnerContentTask' BEFORE 'pointReversal';
  CREATE TABLE "partner_conversions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"partner_id" uuid NOT NULL,
  	"content_id" uuid NOT NULL,
  	"click_id" varchar NOT NULL,
  	"status" "enum_partner_conversions_status" DEFAULT 'clicked' NOT NULL,
  	"points_awarded" numeric DEFAULT 0,
  	"partner_order_id" varchar,
  	"metadata" jsonb,
  	"clicked_at" timestamp(3) with time zone NOT NULL,
  	"converted_at" timestamp(3) with time zone,
  	"awarded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "partner_conversions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "partners" ADD COLUMN "integration_method" "enum_partners_integration_method" DEFAULT 'manual' NOT NULL;
  ALTER TABLE "partners" ADD COLUMN "webhook_url" varchar;
  ALTER TABLE "partners" ADD COLUMN "webhook_secret" varchar;
  ALTER TABLE "partners" ADD COLUMN "api_key" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "partner_conversions_id" uuid;
  ALTER TABLE "partner_conversions" ADD CONSTRAINT "partner_conversions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_conversions" ADD CONSTRAINT "partner_conversions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_conversions" ADD CONSTRAINT "partner_conversions_content_id_partner_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."partner_content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_conversions_rels" ADD CONSTRAINT "partner_conversions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partner_conversions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_conversions_rels" ADD CONSTRAINT "partner_conversions_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "partner_conversions_user_idx" ON "partner_conversions" USING btree ("user_id");
  CREATE INDEX "partner_conversions_partner_idx" ON "partner_conversions" USING btree ("partner_id");
  CREATE INDEX "partner_conversions_content_idx" ON "partner_conversions" USING btree ("content_id");
  CREATE UNIQUE INDEX "partner_conversions_click_id_idx" ON "partner_conversions" USING btree ("click_id");
  CREATE INDEX "partner_conversions_status_idx" ON "partner_conversions" USING btree ("status");
  CREATE INDEX "partner_conversions_updated_at_idx" ON "partner_conversions" USING btree ("updated_at");
  CREATE INDEX "partner_conversions_created_at_idx" ON "partner_conversions" USING btree ("created_at");
  CREATE INDEX "partner_conversions_rels_order_idx" ON "partner_conversions_rels" USING btree ("order");
  CREATE INDEX "partner_conversions_rels_parent_idx" ON "partner_conversions_rels" USING btree ("parent_id");
  CREATE INDEX "partner_conversions_rels_path_idx" ON "partner_conversions_rels" USING btree ("path");
  CREATE INDEX "partner_conversions_rels_admins_id_idx" ON "partner_conversions_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partner_conversions_fk" FOREIGN KEY ("partner_conversions_id") REFERENCES "public"."partner_conversions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_partner_conversions_id_idx" ON "payload_locked_documents_rels" USING btree ("partner_conversions_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partner_conversions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partner_conversions_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "partner_conversions" CASCADE;
  DROP TABLE "partner_conversions_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_partner_conversions_fk";

  ALTER TABLE "activities" ALTER COLUMN "action" SET DATA TYPE text;
  DROP TYPE "public"."enum_activities_action";
  CREATE TYPE "public"."enum_activities_action" AS ENUM('signUp', 'watchLive', 'read', 'dailyLogin', 'share', 'connectBrandAd', 'referral', 'ticketPurchase', 'lottery', 'surveyTask', 'musicListeningTime', 'pointReversal');
  ALTER TABLE "activities" ALTER COLUMN "action" SET DATA TYPE "public"."enum_activities_action" USING "action"::"public"."enum_activities_action";
  DROP INDEX "payload_locked_documents_rels_partner_conversions_id_idx";
  ALTER TABLE "partners" DROP COLUMN "integration_method";
  ALTER TABLE "partners" DROP COLUMN "webhook_url";
  ALTER TABLE "partners" DROP COLUMN "webhook_secret";
  ALTER TABLE "partners" DROP COLUMN "api_key";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "partner_conversions_id";
  DROP TYPE "public"."enum_partner_conversions_status";
  DROP TYPE "public"."enum_partners_integration_method";`);
}
