import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_notifications_delivery_action" AS ENUM('send-now', 'schedule');
  CREATE TYPE "public"."enum__notifications_v_version_device_types" AS ENUM('all', 'ios', 'android');
  CREATE TYPE "public"."enum__notifications_v_version_type" AS ENUM('breaking_news', 'news', 'promo', 'misc');
  CREATE TYPE "public"."enum__notifications_v_version_delivery_action" AS ENUM('send-now', 'schedule');
  CREATE TYPE "public"."enum__notifications_v_version_target_type" AS ENUM('all', 'segment', 'specific');
  CREATE TYPE "public"."enum__notifications_v_version_segment" AS ENUM('active-users', 'inactive-users', 'new-users');
  CREATE TYPE "public"."enum__notifications_v_version_priority" AS ENUM('default', 'high', 'normal');
  CREATE TYPE "public"."enum__notifications_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "_notifications_v_version_device_types" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum__notifications_v_version_device_types",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "_notifications_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_body" varchar,
  	"version_type" "enum__notifications_v_version_type" DEFAULT 'misc',
  	"version_data" jsonb,
  	"version_delivery_action" "enum__notifications_v_version_delivery_action" DEFAULT 'send-now',
  	"version_scheduled_for" timestamp(3) with time zone,
  	"version_target_type" "enum__notifications_v_version_target_type" DEFAULT 'all',
  	"version_segment" "enum__notifications_v_version_segment",
  	"version_priority" "enum__notifications_v_version_priority" DEFAULT 'default',
  	"version_sound" boolean DEFAULT true,
  	"version_badge" numeric,
  	"version_sent_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version__status" "enum__notifications_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );

  CREATE TABLE "_notifications_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"admins_id" uuid
  );

  -- First drop the old columns that depend on the old enum (if they exist)
  ALTER TABLE "notifications" DROP COLUMN IF EXISTS "status";
  ALTER TABLE "notifications" DROP COLUMN IF EXISTS "is_scheduled";
  
  -- Create the new enum type
  DROP TYPE IF EXISTS "public"."enum_notifications_status";
  CREATE TYPE "public"."enum_notifications_status" AS ENUM('draft', 'published');
  
  -- Add new columns
  ALTER TABLE "notifications" ADD COLUMN "_status" "enum_notifications_status" DEFAULT 'draft';
  ALTER TABLE "notifications" ADD COLUMN "delivery_action" "enum_notifications_delivery_action" DEFAULT 'send-now';
  
  -- Drop NOT NULL constraints
  ALTER TABLE "notifications" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "notifications" ALTER COLUMN "body" DROP NOT NULL;
  ALTER TABLE "_notifications_v_version_device_types" ADD CONSTRAINT "_notifications_v_version_device_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_notifications_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_notifications_v" ADD CONSTRAINT "_notifications_v_parent_id_notifications_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_notifications_v_rels" ADD CONSTRAINT "_notifications_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_notifications_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_notifications_v_rels" ADD CONSTRAINT "_notifications_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_notifications_v_rels" ADD CONSTRAINT "_notifications_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_notifications_v_version_device_types_order_idx" ON "_notifications_v_version_device_types" USING btree ("order");
  CREATE INDEX "_notifications_v_version_device_types_parent_idx" ON "_notifications_v_version_device_types" USING btree ("parent_id");
  CREATE INDEX "_notifications_v_parent_idx" ON "_notifications_v" USING btree ("parent_id");
  CREATE INDEX "_notifications_v_version_version__status_idx" ON "_notifications_v" USING btree ("version__status");
  CREATE INDEX "_notifications_v_created_at_idx" ON "_notifications_v" USING btree ("created_at");
  CREATE INDEX "_notifications_v_updated_at_idx" ON "_notifications_v" USING btree ("updated_at");
  CREATE INDEX "_notifications_v_latest_idx" ON "_notifications_v" USING btree ("latest");
  CREATE INDEX "_notifications_v_rels_order_idx" ON "_notifications_v_rels" USING btree ("order");
  CREATE INDEX "_notifications_v_rels_parent_idx" ON "_notifications_v_rels" USING btree ("parent_id");
  CREATE INDEX "_notifications_v_rels_path_idx" ON "_notifications_v_rels" USING btree ("path");
  CREATE INDEX "_notifications_v_rels_users_id_idx" ON "_notifications_v_rels" USING btree ("users_id");
  CREATE INDEX "_notifications_v_rels_admins_id_idx" ON "_notifications_v_rels" USING btree ("admins_id");
  CREATE INDEX "notifications__status_idx" ON "notifications" USING btree ("_status");
`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_notifications_v_version_device_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_notifications_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_notifications_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_notifications_v_version_device_types" CASCADE;
  DROP TABLE "_notifications_v" CASCADE;
  DROP TABLE "_notifications_v_rels" CASCADE;
  ALTER TABLE "notifications" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "notifications" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_notifications_status";
  CREATE TYPE "public"."enum_notifications_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'canceled');
  ALTER TABLE "notifications" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_notifications_status";
  ALTER TABLE "notifications" ALTER COLUMN "status" SET DATA TYPE "public"."enum_notifications_status" USING "status"::"public"."enum_notifications_status";
  DROP INDEX "notifications__status_idx";
  ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "notifications" ALTER COLUMN "body" SET NOT NULL;
  ALTER TABLE "notifications" ADD COLUMN "status" "enum_notifications_status" DEFAULT 'draft';
  ALTER TABLE "notifications" ADD COLUMN "is_scheduled" boolean DEFAULT false;
  ALTER TABLE "notifications" DROP COLUMN "delivery_action";
  ALTER TABLE "notifications" DROP COLUMN "_status";
  DROP TYPE "public"."enum_notifications_delivery_action";
  DROP TYPE "public"."enum__notifications_v_version_device_types";
  DROP TYPE "public"."enum__notifications_v_version_type";
  DROP TYPE "public"."enum__notifications_v_version_delivery_action";
  DROP TYPE "public"."enum__notifications_v_version_target_type";
  DROP TYPE "public"."enum__notifications_v_version_segment";
  DROP TYPE "public"."enum__notifications_v_version_priority";
  DROP TYPE "public"."enum__notifications_v_version_status";`);
}
