import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_news_analytics_event" AS ENUM('impression', 'view', 'read', 'like', 'dislike', 'share', 'comment');
  CREATE TYPE "public"."enum_news_analytics_platform" AS ENUM('android', 'ios', 'web');
  CREATE TABLE "news_analytics" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"article_id" uuid NOT NULL,
  	"event" "enum_news_analytics_event" NOT NULL,
  	"user_id" varchar,
  	"session_id" varchar NOT NULL,
  	"device_id" varchar NOT NULL,
  	"platform" "enum_news_analytics_platform",
  	"metadata" jsonb,
  	"timestamp" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "news_analytics_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "news_analytics_id" uuid;
  ALTER TABLE "news_analytics" ADD CONSTRAINT "news_analytics_article_id_news_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_analytics_rels" ADD CONSTRAINT "news_analytics_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news_analytics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_analytics_rels" ADD CONSTRAINT "news_analytics_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "news_analytics_article_idx" ON "news_analytics" USING btree ("article_id");
  CREATE INDEX "news_analytics_event_idx" ON "news_analytics" USING btree ("event");
  CREATE INDEX "news_analytics_user_id_idx" ON "news_analytics" USING btree ("user_id");
  CREATE INDEX "news_analytics_timestamp_idx" ON "news_analytics" USING btree ("timestamp");
  CREATE INDEX "news_analytics_updated_at_idx" ON "news_analytics" USING btree ("updated_at");
  CREATE INDEX "news_analytics_created_at_idx" ON "news_analytics" USING btree ("created_at");
  CREATE INDEX "news_analytics_rels_order_idx" ON "news_analytics_rels" USING btree ("order");
  CREATE INDEX "news_analytics_rels_parent_idx" ON "news_analytics_rels" USING btree ("parent_id");
  CREATE INDEX "news_analytics_rels_path_idx" ON "news_analytics_rels" USING btree ("path");
  CREATE INDEX "news_analytics_rels_admins_id_idx" ON "news_analytics_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_analytics_fk" FOREIGN KEY ("news_analytics_id") REFERENCES "public"."news_analytics"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_news_analytics_id_idx" ON "payload_locked_documents_rels" USING btree ("news_analytics_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news_analytics" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "news_analytics_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "news_analytics" CASCADE;
  DROP TABLE "news_analytics_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_news_analytics_fk";

  DROP INDEX "payload_locked_documents_rels_news_analytics_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "news_analytics_id";
  DROP TYPE "public"."enum_news_analytics_event";
  DROP TYPE "public"."enum_news_analytics_platform";`);
}
