import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_shop_analytics_type" AS ENUM('view', 'click');
  CREATE TYPE "public"."enum_shop_analytics_device" AS ENUM('mobile', 'tablet', 'desktop', 'unknown');
  CREATE TYPE "public"."enum_shop_analytics_platform" AS ENUM('android', 'ios', 'web');
  ALTER TYPE "public"."enum_admins_role" ADD VALUE 'partner';
  CREATE TABLE "shop_analytics" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"store_id" uuid NOT NULL,
  	"type" "enum_shop_analytics_type" NOT NULL,
  	"user_id" varchar,
  	"device" "enum_shop_analytics_device",
  	"platform" "enum_shop_analytics_platform",
  	"timestamp" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "shop_analytics_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "admins" ADD COLUMN "partner_id" uuid;
  ALTER TABLE "partners" ADD COLUMN "popularity_score" numeric DEFAULT 0;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "shop_analytics_id" uuid;
  ALTER TABLE "shop_analytics" ADD CONSTRAINT "shop_analytics_store_id_partners_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shop_analytics_rels" ADD CONSTRAINT "shop_analytics_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."shop_analytics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "shop_analytics_rels" ADD CONSTRAINT "shop_analytics_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "shop_analytics_store_idx" ON "shop_analytics" USING btree ("store_id");
  CREATE INDEX "shop_analytics_type_idx" ON "shop_analytics" USING btree ("type");
  CREATE INDEX "shop_analytics_timestamp_idx" ON "shop_analytics" USING btree ("timestamp");
  CREATE INDEX "shop_analytics_updated_at_idx" ON "shop_analytics" USING btree ("updated_at");
  CREATE INDEX "shop_analytics_created_at_idx" ON "shop_analytics" USING btree ("created_at");
  CREATE INDEX "shop_analytics_rels_order_idx" ON "shop_analytics_rels" USING btree ("order");
  CREATE INDEX "shop_analytics_rels_parent_idx" ON "shop_analytics_rels" USING btree ("parent_id");
  CREATE INDEX "shop_analytics_rels_path_idx" ON "shop_analytics_rels" USING btree ("path");
  CREATE INDEX "shop_analytics_rels_admins_id_idx" ON "shop_analytics_rels" USING btree ("admins_id");
  ALTER TABLE "admins" ADD CONSTRAINT "admins_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shop_analytics_fk" FOREIGN KEY ("shop_analytics_id") REFERENCES "public"."shop_analytics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "admins_partner_idx" ON "admins" USING btree ("partner_id");
  CREATE INDEX "partners_popularity_score_idx" ON "partners" USING btree ("popularity_score");
  CREATE INDEX "payload_locked_documents_rels_shop_analytics_id_idx" ON "payload_locked_documents_rels" USING btree ("shop_analytics_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "shop_analytics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "shop_analytics_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "shop_analytics" CASCADE;
  DROP TABLE "shop_analytics_rels" CASCADE;
  ALTER TABLE "admins" DROP CONSTRAINT "admins_partner_id_partners_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_shop_analytics_fk";

  ALTER TABLE "admins" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'viewer'::text;
  DROP TYPE "public"."enum_admins_role";
  CREATE TYPE "public"."enum_admins_role" AS ENUM('super-admin', 'content-manager', 'editor', 'viewer');
  ALTER TABLE "admins" ALTER COLUMN "role" SET DEFAULT 'viewer'::"public"."enum_admins_role";
  ALTER TABLE "admins" ALTER COLUMN "role" SET DATA TYPE "public"."enum_admins_role" USING "role"::"public"."enum_admins_role";
  DROP INDEX "admins_partner_idx";
  DROP INDEX "partners_popularity_score_idx";
  DROP INDEX "payload_locked_documents_rels_shop_analytics_id_idx";
  ALTER TABLE "admins" DROP COLUMN "partner_id";
  ALTER TABLE "partners" DROP COLUMN "popularity_score";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "shop_analytics_id";
  DROP TYPE "public"."enum_shop_analytics_type";
  DROP TYPE "public"."enum_shop_analytics_device";
  DROP TYPE "public"."enum_shop_analytics_platform";`);
}
