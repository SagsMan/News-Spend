import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partners_rels" DROP CONSTRAINT "partners_rels_partner_content_fk";

  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_placements";
  
  -- Create enum with BOTH old and new values temporarily
  CREATE TYPE "public"."enum_partner_content_placements" AS ENUM(
    -- Old snake_case values (to be removed after migration)
    'homepage_trending_books', 'discover_tab', 'points_mall_books', 'points_mall_apps', 
    'connect_brand_video', 'connect_brands_tab', 'lucky_app_wall', 'shop_tab', 'homepage_ads_banner', 
    'news_click_ads', 'banner_news_post', 'news_post', 'product_display', 'push_notification', 
    'email_campaign', 'video_section',
    -- New kebab-case values
    'homepage-trending-books', 'homepage-ads-banner', 'points-mall-books', 'points-mall-apps', 
    'connect-brands-tab', 'connect-brand-video', 'lucky-app-wall', 'news-click-ads', 'banner-between-news'
  );
  
  -- Convert column to use the new enum
  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE "public"."enum_partner_content_placements" USING "value"::"public"."enum_partner_content_placements";
  
  -- Now migrate data from old to new values
  UPDATE "partner_content_placements" SET "value" = 'homepage-trending-books' WHERE "value" = 'homepage_trending_books';
  UPDATE "partner_content_placements" SET "value" = 'homepage-ads-banner' WHERE "value" = 'homepage_ads_banner';
  UPDATE "partner_content_placements" SET "value" = 'points-mall-books' WHERE "value" = 'points_mall_books';
  UPDATE "partner_content_placements" SET "value" = 'points-mall-apps' WHERE "value" = 'points_mall_apps';
  UPDATE "partner_content_placements" SET "value" = 'connect-brands-tab' WHERE "value" = 'connect_brands_tab';
  UPDATE "partner_content_placements" SET "value" = 'connect-brand-video' WHERE "value" = 'connect_brand_video';
  UPDATE "partner_content_placements" SET "value" = 'lucky-app-wall' WHERE "value" = 'lucky_app_wall';
  UPDATE "partner_content_placements" SET "value" = 'news-click-ads' WHERE "value" = 'news_click_ads';
  UPDATE "partner_content_placements" SET "value" = 'banner-between-news' WHERE "value" = 'banner_news_post';
  
  -- Delete rows with deprecated placements that don't exist in new schema
  DELETE FROM "partner_content_placements" WHERE "value" IN ('discover_tab', 'shop_tab', 'news_post', 'product_display', 'push_notification', 'email_campaign', 'video_section');
  
  -- Finally, drop the old enum values (recreate enum with only new values)
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
  DROP INDEX "partners_rels_partner_content_id_idx";
  ALTER TABLE "partner_content" ALTER COLUMN "media_id" SET NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "cta" SET DATA TYPE varchar;
  ALTER TABLE "partner_content" ALTER COLUMN "partner_id" SET NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "status" DROP NOT NULL;
  ALTER TABLE "partners" ALTER COLUMN "website_url" SET NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "is_video" boolean DEFAULT false;
  ALTER TABLE "partner_content" ADD COLUMN "priority" numeric DEFAULT 10;
  ALTER TABLE "partner_content" ADD COLUMN "notes" varchar;
  ALTER TABLE "partner_content" DROP COLUMN "type";
  ALTER TABLE "partner_content" DROP COLUMN "ad_size";
  ALTER TABLE "partners_rels" DROP COLUMN "partner_content_id";
  DROP TYPE "public"."enum_partner_content_type";
  DROP TYPE "public"."enum_partner_content_cta";
  DROP TYPE "public"."enum_partner_content_ad_size";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_partner_content_type" AS ENUM('book', 'app', 'game', 'survey', 'video', 'banner', 'product', 'custom');
  CREATE TYPE "public"."enum_partner_content_cta" AS ENUM('APPLY_NOW', 'BOOK_NOW', 'BUY_NOW', 'CONTACT_US', 'DOWNLOAD', 'FIND_LOCATION', 'GET_DIRECTIONS', 'GET_OFFER', 'GET_QUOTE', 'GET_SHOWTIMES', 'GET_TICKETS', 'INSTALL_NOW', 'LEARN_MORE', 'SUBSCRIBE', 'WATCH_NOW');
  CREATE TYPE "public"."enum_partner_content_ad_size" AS ENUM('LARGE_BANNER', 'LEADERBOARD', 'FULL_BANNER', 'MEDIUM_RECTANGLE', 'BANNER', 'ANCHORED_ADAPTIVE_BANNER');
  ALTER TYPE "public"."enum_partner_content_status" ADD VALUE 'archived';
  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_placements";
  CREATE TYPE "public"."enum_partner_content_placements" AS ENUM('homepage_trending_books', 'discover_tab', 'points_mall_books', 'points_mall_apps', 'connect_brand_video', 'connect_brands_tab', 'lucky_app_wall', 'shop_tab', 'homepage_ads_banner', 'news_click_ads', 'banner_news_post', 'news_post', 'product_display', 'push_notification', 'email_campaign', 'video_section');
  ALTER TABLE "partner_content_placements" ALTER COLUMN "value" SET DATA TYPE "public"."enum_partner_content_placements" USING "value"::"public"."enum_partner_content_placements";
  ALTER TABLE "partner_content" ALTER COLUMN "video_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_partner_content_video_type";
  CREATE TYPE "public"."enum_partner_content_video_type" AS ENUM('Normal', 'YOUTUBE');
  ALTER TABLE "partner_content" ALTER COLUMN "video_type" SET DATA TYPE "public"."enum_partner_content_video_type" USING "video_type"::"public"."enum_partner_content_video_type";
  ALTER TABLE "partner_content" ALTER COLUMN "media_id" DROP NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "cta" SET DATA TYPE "public"."enum_partner_content_cta" USING "cta"::"public"."enum_partner_content_cta";
  ALTER TABLE "partner_content" ALTER COLUMN "partner_id" DROP NOT NULL;
  ALTER TABLE "partner_content" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "partners" ALTER COLUMN "website_url" DROP NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "type" "enum_partner_content_type" NOT NULL;
  ALTER TABLE "partner_content" ADD COLUMN "ad_size" "enum_partner_content_ad_size";
  ALTER TABLE "partners_rels" ADD COLUMN "partner_content_id" uuid;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_partner_content_fk" FOREIGN KEY ("partner_content_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "partners_rels_partner_content_id_idx" ON "partners_rels" USING btree ("partner_content_id");
  ALTER TABLE "partner_content" DROP COLUMN "is_video";
  ALTER TABLE "partner_content" DROP COLUMN "priority";
  ALTER TABLE "partner_content" DROP COLUMN "notes";`);
}
