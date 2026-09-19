import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "banners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "banners_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaigns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaigns_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "banners" CASCADE;
  DROP TABLE "banners_rels" CASCADE;
  DROP TABLE "campaigns" CASCADE;
  DROP TABLE "campaigns_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_banners_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_campaigns_fk";

  DROP INDEX "payload_locked_documents_rels_banners_id_idx";
  DROP INDEX "payload_locked_documents_rels_campaigns_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "banners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaigns_id";
  DROP TYPE "public"."enum_banners_type";
  DROP TYPE "public"."enum_banners_size";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_banners_type" AS ENUM('image', 'video');
  CREATE TYPE "public"."enum_banners_size" AS ENUM('BANNER', 'LARGE_BANNER', 'FULL_BANNER', 'LEADERBOARD', 'MEDIUM_RECTANGLE', 'SKYSCRAPER', 'WIDE_SKYSCRAPER');
  CREATE TABLE "banners" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_banners_type" NOT NULL,
  	"media_id" uuid NOT NULL,
  	"icon_id" uuid,
  	"headline" varchar NOT NULL,
  	"body" varchar,
  	"advertiser_id" uuid NOT NULL,
  	"call_to_action" varchar,
  	"star_rating" numeric,
  	"price" varchar,
  	"redirect_url" varchar NOT NULL,
  	"size" "enum_banners_size",
  	"duration" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "banners_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "campaigns" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone NOT NULL,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "campaigns_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "banners_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaigns_id" uuid;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_advertiser_id_partners_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners_rels" ADD CONSTRAINT "banners_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "banners_rels" ADD CONSTRAINT "banners_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns_rels" ADD CONSTRAINT "campaigns_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns_rels" ADD CONSTRAINT "campaigns_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "banners_media_idx" ON "banners" USING btree ("media_id");
  CREATE INDEX "banners_icon_idx" ON "banners" USING btree ("icon_id");
  CREATE INDEX "banners_advertiser_idx" ON "banners" USING btree ("advertiser_id");
  CREATE INDEX "banners_updated_at_idx" ON "banners" USING btree ("updated_at");
  CREATE INDEX "banners_created_at_idx" ON "banners" USING btree ("created_at");
  CREATE INDEX "banners_rels_order_idx" ON "banners_rels" USING btree ("order");
  CREATE INDEX "banners_rels_parent_idx" ON "banners_rels" USING btree ("parent_id");
  CREATE INDEX "banners_rels_path_idx" ON "banners_rels" USING btree ("path");
  CREATE INDEX "banners_rels_admins_id_idx" ON "banners_rels" USING btree ("admins_id");
  CREATE INDEX "campaigns_updated_at_idx" ON "campaigns" USING btree ("updated_at");
  CREATE INDEX "campaigns_created_at_idx" ON "campaigns" USING btree ("created_at");
  CREATE INDEX "campaigns_rels_order_idx" ON "campaigns_rels" USING btree ("order");
  CREATE INDEX "campaigns_rels_parent_idx" ON "campaigns_rels" USING btree ("parent_id");
  CREATE INDEX "campaigns_rels_path_idx" ON "campaigns_rels" USING btree ("path");
  CREATE INDEX "campaigns_rels_admins_id_idx" ON "campaigns_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigns_id");`);
}
