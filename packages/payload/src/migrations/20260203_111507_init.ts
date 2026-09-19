import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activities_type" AS ENUM('point', 'badge', 'reward');
  CREATE TYPE "public"."enum_activities_action" AS ENUM('signUp', 'watchLive', 'read', 'dailyLogin', 'share', 'connectBrandAd', 'referral', 'ticketPurchase', 'lottery', 'surveyTask', 'musicListeningTime', 'pointReversal');
  CREATE TYPE "public"."enum_admins_role" AS ENUM('super-admin', 'content-manager', 'editor', 'viewer');
  CREATE TYPE "public"."enum_banners_type" AS ENUM('image', 'video');
  CREATE TYPE "public"."enum_banners_size" AS ENUM('BANNER', 'LARGE_BANNER', 'FULL_BANNER', 'LEADERBOARD', 'MEDIUM_RECTANGLE', 'SKYSCRAPER', 'WIDE_SKYSCRAPER');
  CREATE TYPE "public"."enum_content_reports_report_type" AS ENUM('comment', 'news');
  CREATE TYPE "public"."enum_content_reports_reason" AS ENUM('spam', 'harassment', 'hate-speech', 'misinformation', 'personal-info', 'inappropriate', 'off-topic', 'trolling', 'illegal', 'other');
  CREATE TYPE "public"."enum_content_reports_status" AS ENUM('pending', 'reviewing', 'resolved', 'dismissed');
  CREATE TYPE "public"."enum_content_reports_resolution" AS ENUM('noAction', 'warning', 'removed', 'suspended', 'banned');
  CREATE TYPE "public"."enum_feedback_type" AS ENUM('general', 'bug', 'feature', 'advertisement', 'other');
  CREATE TYPE "public"."enum_lottery_winners_prize_tier" AS ENUM('HIGH', 'MID', 'LOW', 'NONE');
  CREATE TYPE "public"."enum_news_type" AS ENUM('article', 'video');
  CREATE TYPE "public"."enum_news_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_version_type" AS ENUM('article', 'video');
  CREATE TYPE "public"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_notification_logs_status" AS ENUM('delivered', 'failed', 'opened');
  CREATE TYPE "public"."enum_notifications_device_types" AS ENUM('all', 'ios', 'android', 'web');
  CREATE TYPE "public"."enum_notifications_status" AS ENUM('draft', 'scheduled', 'sending', 'sent', 'failed', 'canceled');
  CREATE TYPE "public"."enum_notifications_target_type" AS ENUM('all', 'segment', 'specific');
  CREATE TYPE "public"."enum_notifications_segment" AS ENUM('active-users', 'inactive-users', 'new-users');
  CREATE TYPE "public"."enum_notifications_priority" AS ENUM('default', 'high', 'normal');
  CREATE TYPE "public"."enum_partner_content_placements" AS ENUM('homepage_trending_books', 'discover_tab', 'points_mall_books', 'points_mall_apps', 'connect_brand_video', 'connect_brands_tab', 'lucky_app_wall', 'shop_tab', 'homepage_ads_banner', 'news_click_ads', 'banner_news_post', 'news_post', 'product_display', 'push_notification', 'email_campaign', 'video_section');
  CREATE TYPE "public"."enum_partner_content_type" AS ENUM('book', 'app', 'game', 'survey', 'video', 'banner', 'product', 'custom');
  CREATE TYPE "public"."enum_partner_content_video_type" AS ENUM('Normal', 'YOUTUBE');
  CREATE TYPE "public"."enum_partner_content_cta" AS ENUM('APPLY_NOW', 'BOOK_NOW', 'BUY_NOW', 'CONTACT_US', 'DOWNLOAD', 'FIND_LOCATION', 'GET_DIRECTIONS', 'GET_OFFER', 'GET_QUOTE', 'GET_SHOWTIMES', 'GET_TICKETS', 'INSTALL_NOW', 'LEARN_MORE', 'SUBSCRIBE', 'WATCH_NOW');
  CREATE TYPE "public"."enum_partner_content_status" AS ENUM('draft', 'active', 'paused', 'archived');
  CREATE TYPE "public"."enum_partner_content_ad_size" AS ENUM('LARGE_BANNER', 'LEADERBOARD', 'FULL_BANNER', 'MEDIUM_RECTANGLE', 'BANNER', 'ANCHORED_ADAPTIVE_BANNER');
  CREATE TYPE "public"."enum_partners_status" AS ENUM('prospective', 'active', 'inactive');
  CREATE TYPE "public"."enum_partners_category" AS ENUM('books', 'ecommerce', 'education', 'food', 'digital', 'business', 'other');
  CREATE TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source" AS ENUM('normal', 'youtube');
  CREATE TYPE "public"."enum_push_tokens_device_type" AS ENUM('ios', 'android', 'web');
  CREATE TYPE "public"."enum_push_tokens_status" AS ENUM('active', 'inactive');
  CREATE TYPE "public"."enum_reactions_type" AS ENUM('like', 'dislike', 'none');
  CREATE TYPE "public"."enum_witness_reports_report_type" AS ENUM('shortMessage', 'video', 'picture');
  CREATE TABLE "accounts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" varchar NOT NULL,
  	"account_id" varchar NOT NULL,
  	"provider_id" varchar NOT NULL,
  	"password" varchar,
  	"access_token" varchar,
  	"refresh_token" varchar,
  	"access_token_expires_at" timestamp(3) with time zone,
  	"refresh_token_expires_at" timestamp(3) with time zone,
  	"scope" varchar,
  	"expires_at" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "accounts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "activities" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"type" "enum_activities_type" DEFAULT 'point',
  	"point" numeric DEFAULT 0 NOT NULL,
  	"reward" varchar,
  	"action" "enum_activities_action" NOT NULL,
  	"description" varchar,
  	"user_id" uuid NOT NULL,
  	"news_id" uuid,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "activities_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "admins_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "admins" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"role" "enum_admins_role" DEFAULT 'viewer' NOT NULL,
  	"full_name" varchar NOT NULL,
  	"image_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "admins_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

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

  CREATE TABLE "categories" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"slug_lock" boolean DEFAULT true,
  	"description" varchar,
  	"image_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "categories_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "comments" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"text" varchar NOT NULL,
  	"user_id" uuid NOT NULL,
  	"news_id" uuid NOT NULL,
  	"parent_id" uuid,
  	"replying_to_id" uuid,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "comments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"admins_id" uuid
  );

  CREATE TABLE "content_reports" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"report_type" "enum_content_reports_report_type" NOT NULL,
  	"reason" "enum_content_reports_reason" NOT NULL,
  	"additional_details" varchar,
  	"reported_by_id" uuid NOT NULL,
  	"status" "enum_content_reports_status" DEFAULT 'pending',
  	"moderator_notes" varchar,
  	"resolution" "enum_content_reports_resolution",
  	"resolved_by_id" uuid,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "content_reports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"comments_id" uuid,
  	"news_id" uuid,
  	"admins_id" uuid
  );

  CREATE TABLE "feedback" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"type" "enum_feedback_type" NOT NULL,
  	"message" varchar NOT NULL,
  	"rating" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "feedback_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

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

  CREATE TABLE "media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar,
  	"caption" jsonb,
  	"blurhash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );

  CREATE TABLE "media_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "news_key_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar
  );

  CREATE TABLE "news" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"type" "enum_news_type" DEFAULT 'article',
  	"is_live" boolean DEFAULT false,
  	"title" varchar,
  	"slug" varchar,
  	"slug_lock" boolean DEFAULT true,
  	"image_id" uuid,
  	"content" jsonb,
  	"url" varchar,
  	"word_count" numeric DEFAULT 0,
  	"read_time_minutes" numeric DEFAULT 0,
  	"views" numeric DEFAULT 0,
  	"excerpt" varchar,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"points" numeric DEFAULT 0,
  	"author_id" uuid,
  	"category_id" uuid,
  	"has_been_published" boolean DEFAULT false,
  	"likes_count" numeric DEFAULT 0,
  	"dislikes_count" numeric DEFAULT 0,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_news_status" DEFAULT 'draft'
  );

  CREATE TABLE "news_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "_news_v_version_key_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"point" varchar,
  	"_uuid" varchar
  );

  CREATE TABLE "_news_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_type" "enum__news_v_version_type" DEFAULT 'article',
  	"version_is_live" boolean DEFAULT false,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_slug_lock" boolean DEFAULT true,
  	"version_image_id" uuid,
  	"version_content" jsonb,
  	"version_url" varchar,
  	"version_word_count" numeric DEFAULT 0,
  	"version_read_time_minutes" numeric DEFAULT 0,
  	"version_views" numeric DEFAULT 0,
  	"version_excerpt" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_points" numeric DEFAULT 0,
  	"version_author_id" uuid,
  	"version_category_id" uuid,
  	"version_has_been_published" boolean DEFAULT false,
  	"version_likes_count" numeric DEFAULT 0,
  	"version_dislikes_count" numeric DEFAULT 0,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__news_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );

  CREATE TABLE "_news_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

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

  CREATE TABLE "notifications_device_types" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_notifications_device_types",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "notifications" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"data" jsonb,
  	"status" "enum_notifications_status" DEFAULT 'draft' NOT NULL,
  	"target_type" "enum_notifications_target_type" DEFAULT 'all' NOT NULL,
  	"segment" "enum_notifications_segment",
  	"priority" "enum_notifications_priority" DEFAULT 'default' NOT NULL,
  	"sound" boolean DEFAULT true,
  	"badge" numeric,
  	"is_scheduled" boolean DEFAULT false,
  	"scheduled_for" timestamp(3) with time zone,
  	"sent_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "notifications_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"admins_id" uuid
  );

  CREATE TABLE "partner_content_placements" (
  	"order" integer NOT NULL,
  	"parent_id" uuid NOT NULL,
  	"value" "enum_partner_content_placements",
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "partner_content" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"type" "enum_partner_content_type" NOT NULL,
  	"media_id" uuid,
  	"video_type" "enum_partner_content_video_type",
  	"video_id" uuid,
  	"video_url" varchar,
  	"cta" "enum_partner_content_cta",
  	"partner_id" uuid,
  	"links_website" varchar,
  	"links_ios_app_store" varchar,
  	"links_android_play_store" varchar,
  	"points" numeric NOT NULL,
  	"status" "enum_partner_content_status" DEFAULT 'draft' NOT NULL,
  	"schedule_start_date" timestamp(3) with time zone,
  	"schedule_end_date" timestamp(3) with time zone,
  	"ad_size" "enum_partner_content_ad_size",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "partner_content_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "partners" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"company_name" varchar NOT NULL,
  	"slug" varchar,
  	"slug_lock" boolean DEFAULT true,
  	"description" varchar,
  	"website_url" varchar,
  	"status" "enum_partners_status" DEFAULT 'prospective',
  	"contract_signed" boolean DEFAULT false,
  	"in_shop_tab" boolean DEFAULT true,
  	"cash_back" numeric DEFAULT 0,
  	"category" "enum_partners_category",
  	"logo_id" uuid,
  	"contact_info_contact_person" varchar,
  	"contact_info_email" varchar,
  	"contact_info_phone" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "partners_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"partner_content_id" uuid,
  	"admins_id" uuid
  );

  CREATE TABLE "promotion_media_blocks_promo_video_source" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL,
  	"video_source" "enum_promotion_media_blocks_promo_video_source_video_source" DEFAULT 'normal' NOT NULL,
  	"block_name" varchar
  );

  CREATE TABLE "promotion_media_blocks_promo_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" uuid NOT NULL,
  	"block_name" varchar
  );

  CREATE TABLE "promotion_media_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );

  CREATE TABLE "promotion_media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"points" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "promotion_media_rels" (
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

  CREATE TABLE "push_tokens" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"token" varchar NOT NULL,
  	"user_id" uuid NOT NULL,
  	"device_type" "enum_push_tokens_device_type",
  	"device_name" varchar,
  	"device_model" varchar,
  	"os_version" varchar,
  	"app_version" varchar,
  	"status" "enum_push_tokens_status" DEFAULT 'active' NOT NULL,
  	"last_used" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "push_tokens_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "reactions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"news_id" uuid NOT NULL,
  	"type" "enum_reactions_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "reactions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "sessions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"ip_address" varchar,
  	"token" varchar,
  	"user_agent" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "sessions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "survey" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"google_form_id" varchar NOT NULL,
  	"survey_link" varchar NOT NULL,
  	"points" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "survey_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
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

  CREATE TABLE "users" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" varchar,
  	"email" varchar,
  	"name" varchar NOT NULL,
  	"image" varchar,
  	"username" varchar NOT NULL,
  	"wish" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"_verified" boolean DEFAULT false NOT NULL,
  	"is_anonymous" boolean,
  	"daily_read" jsonb DEFAULT '{"count":0,"updatedAt":"2025-02-19T18:06:57.781Z"}'::jsonb NOT NULL,
  	"notification_preferences" jsonb DEFAULT '{"types":{"BREAKING_NEWS":true,"NEWS":true,"COMMENT":false,"EARNING_OPPORTUNITY":false,"MISC":false}}'::jsonb,
  	"last_active" timestamp(3) with time zone,
  	"custom_attributes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "verifications" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"identifier" varchar,
  	"value" varchar,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "verifications_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "witness_reports" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"report_type" "enum_witness_reports_report_type" DEFAULT 'shortMessage',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "witness_reports_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" uuid,
  	"admins_id" uuid
  );

  CREATE TABLE "payload_kv" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"accounts_id" uuid,
  	"activities_id" uuid,
  	"admins_id" uuid,
  	"banners_id" uuid,
  	"campaigns_id" uuid,
  	"categories_id" uuid,
  	"comments_id" uuid,
  	"content_reports_id" uuid,
  	"feedback_id" uuid,
  	"identity_verification_id" uuid,
  	"lottery_id" uuid,
  	"lottery_tickets_id" uuid,
  	"lottery_winners_id" uuid,
  	"media_id" uuid,
  	"news_id" uuid,
  	"notification_logs_id" uuid,
  	"notifications_id" uuid,
  	"partner_content_id" uuid,
  	"partners_id" uuid,
  	"promotion_media_id" uuid,
  	"push_tickets_id" uuid,
  	"push_tokens_id" uuid,
  	"reactions_id" uuid,
  	"sessions_id" uuid,
  	"survey_id" uuid,
  	"ticket_purchase_log_id" uuid,
  	"users_id" uuid,
  	"verifications_id" uuid,
  	"witness_reports_id" uuid
  );

  CREATE TABLE "payload_preferences" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  CREATE TABLE "payload_migrations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "news_category_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category_id" uuid NOT NULL
  );

  CREATE TABLE "news_category" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE "news_category_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );

  ALTER TABLE "accounts_rels" ADD CONSTRAINT "accounts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "accounts_rels" ADD CONSTRAINT "accounts_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activities" ADD CONSTRAINT "activities_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "activities_rels" ADD CONSTRAINT "activities_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "admins_sessions" ADD CONSTRAINT "admins_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "admins" ADD CONSTRAINT "admins_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "admins_rels" ADD CONSTRAINT "admins_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "admins_rels" ADD CONSTRAINT "admins_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_advertiser_id_partners_id_fk" FOREIGN KEY ("advertiser_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners_rels" ADD CONSTRAINT "banners_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "banners_rels" ADD CONSTRAINT "banners_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns_rels" ADD CONSTRAINT "campaigns_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "campaigns_rels" ADD CONSTRAINT "campaigns_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_rels" ADD CONSTRAINT "categories_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_replying_to_id_comments_id_fk" FOREIGN KEY ("replying_to_id") REFERENCES "public"."comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_id_admins_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content_reports_rels" ADD CONSTRAINT "content_reports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_reports_rels" ADD CONSTRAINT "content_reports_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_reports_rels" ADD CONSTRAINT "content_reports_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_reports_rels" ADD CONSTRAINT "content_reports_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "feedback_rels" ADD CONSTRAINT "feedback_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "feedback_rels" ADD CONSTRAINT "feedback_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
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
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_rels" ADD CONSTRAINT "media_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_key_points" ADD CONSTRAINT "news_key_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_author_id_admins_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_version_key_points" ADD CONSTRAINT "_news_v_version_key_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_author_id_admins_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_device_token_id_push_tokens_id_fk" FOREIGN KEY ("device_token_id") REFERENCES "public"."push_tokens"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "notification_logs_rels" ADD CONSTRAINT "notification_logs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notification_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notification_logs_rels" ADD CONSTRAINT "notification_logs_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications_device_types" ADD CONSTRAINT "notifications_device_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications_rels" ADD CONSTRAINT "notifications_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications_rels" ADD CONSTRAINT "notifications_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications_rels" ADD CONSTRAINT "notifications_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_content_placements" ADD CONSTRAINT "partner_content_placements_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_content" ADD CONSTRAINT "partner_content_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_content" ADD CONSTRAINT "partner_content_video_id_media_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_content" ADD CONSTRAINT "partner_content_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partner_content_rels" ADD CONSTRAINT "partner_content_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partner_content_rels" ADD CONSTRAINT "partner_content_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_partner_content_fk" FOREIGN KEY ("partner_content_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners_rels" ADD CONSTRAINT "partners_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ADD CONSTRAINT "promotion_media_blocks_promo_video_source_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promotion_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_media_blocks_promo_image" ADD CONSTRAINT "promotion_media_blocks_promo_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_media_blocks_promo_image" ADD CONSTRAINT "promotion_media_blocks_promo_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promotion_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_media_items" ADD CONSTRAINT "promotion_media_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."promotion_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_media_rels" ADD CONSTRAINT "promotion_media_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promotion_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promotion_media_rels" ADD CONSTRAINT "promotion_media_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_tickets_rels" ADD CONSTRAINT "push_tickets_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."push_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_tickets_rels" ADD CONSTRAINT "push_tickets_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "push_tokens_rels" ADD CONSTRAINT "push_tokens_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."push_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_tokens_rels" ADD CONSTRAINT "push_tokens_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions" ADD CONSTRAINT "reactions_news_id_news_id_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_rels" ADD CONSTRAINT "sessions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_rels" ADD CONSTRAINT "sessions_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "survey_rels" ADD CONSTRAINT "survey_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."survey"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "survey_rels" ADD CONSTRAINT "survey_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "survey_rels" ADD CONSTRAINT "survey_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log" ADD CONSTRAINT "ticket_purchase_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log" ADD CONSTRAINT "ticket_purchase_log_lottery_id_lottery_id_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lottery"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log_rels" ADD CONSTRAINT "ticket_purchase_log_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ticket_purchase_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ticket_purchase_log_rels" ADD CONSTRAINT "ticket_purchase_log_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "verifications_rels" ADD CONSTRAINT "verifications_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."verifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "verifications_rels" ADD CONSTRAINT "verifications_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "witness_reports_rels" ADD CONSTRAINT "witness_reports_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."witness_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "witness_reports_rels" ADD CONSTRAINT "witness_reports_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "witness_reports_rels" ADD CONSTRAINT "witness_reports_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activities_fk" FOREIGN KEY ("activities_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_reports_fk" FOREIGN KEY ("content_reports_id") REFERENCES "public"."content_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_feedback_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_identity_verification_fk" FOREIGN KEY ("identity_verification_id") REFERENCES "public"."identity_verification"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lottery_fk" FOREIGN KEY ("lottery_id") REFERENCES "public"."lottery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lottery_tickets_fk" FOREIGN KEY ("lottery_tickets_id") REFERENCES "public"."lottery_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lottery_winners_fk" FOREIGN KEY ("lottery_winners_id") REFERENCES "public"."lottery_winners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notification_logs_fk" FOREIGN KEY ("notification_logs_id") REFERENCES "public"."notification_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partner_content_fk" FOREIGN KEY ("partner_content_id") REFERENCES "public"."partner_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promotion_media_fk" FOREIGN KEY ("promotion_media_id") REFERENCES "public"."promotion_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_tickets_fk" FOREIGN KEY ("push_tickets_id") REFERENCES "public"."push_tickets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_tokens_fk" FOREIGN KEY ("push_tokens_id") REFERENCES "public"."push_tokens"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reactions_fk" FOREIGN KEY ("reactions_id") REFERENCES "public"."reactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_survey_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."survey"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ticket_purchase_log_fk" FOREIGN KEY ("ticket_purchase_log_id") REFERENCES "public"."ticket_purchase_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verifications_fk" FOREIGN KEY ("verifications_id") REFERENCES "public"."verifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_witness_reports_fk" FOREIGN KEY ("witness_reports_id") REFERENCES "public"."witness_reports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_category_items" ADD CONSTRAINT "news_category_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news_category_items" ADD CONSTRAINT "news_category_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news_category"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_category_rels" ADD CONSTRAINT "news_category_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news_category"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_category_rels" ADD CONSTRAINT "news_category_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
  CREATE INDEX "accounts_created_at_idx" ON "accounts" USING btree ("created_at");
  CREATE INDEX "accounts_rels_order_idx" ON "accounts_rels" USING btree ("order");
  CREATE INDEX "accounts_rels_parent_idx" ON "accounts_rels" USING btree ("parent_id");
  CREATE INDEX "accounts_rels_path_idx" ON "accounts_rels" USING btree ("path");
  CREATE INDEX "accounts_rels_admins_id_idx" ON "accounts_rels" USING btree ("admins_id");
  CREATE INDEX "activities_point_idx" ON "activities" USING btree ("point");
  CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id");
  CREATE INDEX "activities_news_idx" ON "activities" USING btree ("news_id");
  CREATE INDEX "activities_updated_at_idx" ON "activities" USING btree ("updated_at");
  CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");
  CREATE INDEX "activities_rels_order_idx" ON "activities_rels" USING btree ("order");
  CREATE INDEX "activities_rels_parent_idx" ON "activities_rels" USING btree ("parent_id");
  CREATE INDEX "activities_rels_path_idx" ON "activities_rels" USING btree ("path");
  CREATE INDEX "activities_rels_admins_id_idx" ON "activities_rels" USING btree ("admins_id");
  CREATE INDEX "admins_sessions_order_idx" ON "admins_sessions" USING btree ("_order");
  CREATE INDEX "admins_sessions_parent_id_idx" ON "admins_sessions" USING btree ("_parent_id");
  CREATE INDEX "admins_image_idx" ON "admins" USING btree ("image_id");
  CREATE INDEX "admins_updated_at_idx" ON "admins" USING btree ("updated_at");
  CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");
  CREATE UNIQUE INDEX "admins_email_idx" ON "admins" USING btree ("email");
  CREATE INDEX "admins_rels_order_idx" ON "admins_rels" USING btree ("order");
  CREATE INDEX "admins_rels_parent_idx" ON "admins_rels" USING btree ("parent_id");
  CREATE INDEX "admins_rels_path_idx" ON "admins_rels" USING btree ("path");
  CREATE INDEX "admins_rels_admins_id_idx" ON "admins_rels" USING btree ("admins_id");
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
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories_rels_order_idx" ON "categories_rels" USING btree ("order");
  CREATE INDEX "categories_rels_parent_idx" ON "categories_rels" USING btree ("parent_id");
  CREATE INDEX "categories_rels_path_idx" ON "categories_rels" USING btree ("path");
  CREATE INDEX "categories_rels_admins_id_idx" ON "categories_rels" USING btree ("admins_id");
  CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");
  CREATE INDEX "comments_news_idx" ON "comments" USING btree ("news_id");
  CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_id");
  CREATE INDEX "comments_replying_to_idx" ON "comments" USING btree ("replying_to_id");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "comments_rels_order_idx" ON "comments_rels" USING btree ("order");
  CREATE INDEX "comments_rels_parent_idx" ON "comments_rels" USING btree ("parent_id");
  CREATE INDEX "comments_rels_path_idx" ON "comments_rels" USING btree ("path");
  CREATE INDEX "comments_rels_users_id_idx" ON "comments_rels" USING btree ("users_id");
  CREATE INDEX "comments_rels_admins_id_idx" ON "comments_rels" USING btree ("admins_id");
  CREATE INDEX "content_reports_reported_by_idx" ON "content_reports" USING btree ("reported_by_id");
  CREATE INDEX "content_reports_resolved_by_idx" ON "content_reports" USING btree ("resolved_by_id");
  CREATE INDEX "content_reports_updated_at_idx" ON "content_reports" USING btree ("updated_at");
  CREATE INDEX "content_reports_created_at_idx" ON "content_reports" USING btree ("created_at");
  CREATE INDEX "content_reports_rels_order_idx" ON "content_reports_rels" USING btree ("order");
  CREATE INDEX "content_reports_rels_parent_idx" ON "content_reports_rels" USING btree ("parent_id");
  CREATE INDEX "content_reports_rels_path_idx" ON "content_reports_rels" USING btree ("path");
  CREATE INDEX "content_reports_rels_comments_id_idx" ON "content_reports_rels" USING btree ("comments_id");
  CREATE INDEX "content_reports_rels_news_id_idx" ON "content_reports_rels" USING btree ("news_id");
  CREATE INDEX "content_reports_rels_admins_id_idx" ON "content_reports_rels" USING btree ("admins_id");
  CREATE INDEX "feedback_updated_at_idx" ON "feedback" USING btree ("updated_at");
  CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");
  CREATE INDEX "feedback_rels_order_idx" ON "feedback_rels" USING btree ("order");
  CREATE INDEX "feedback_rels_parent_idx" ON "feedback_rels" USING btree ("parent_id");
  CREATE INDEX "feedback_rels_path_idx" ON "feedback_rels" USING btree ("path");
  CREATE INDEX "feedback_rels_admins_id_idx" ON "feedback_rels" USING btree ("admins_id");
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
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_rels_order_idx" ON "media_rels" USING btree ("order");
  CREATE INDEX "media_rels_parent_idx" ON "media_rels" USING btree ("parent_id");
  CREATE INDEX "media_rels_path_idx" ON "media_rels" USING btree ("path");
  CREATE INDEX "media_rels_admins_id_idx" ON "media_rels" USING btree ("admins_id");
  CREATE INDEX "news_key_points_order_idx" ON "news_key_points" USING btree ("_order");
  CREATE INDEX "news_key_points_parent_id_idx" ON "news_key_points" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "news_slug_idx" ON "news" USING btree ("slug");
  CREATE INDEX "news_image_idx" ON "news" USING btree ("image_id");
  CREATE INDEX "news_author_idx" ON "news" USING btree ("author_id");
  CREATE INDEX "news_category_idx" ON "news" USING btree ("category_id");
  CREATE INDEX "news_created_at_idx" ON "news" USING btree ("created_at");
  CREATE INDEX "news__status_idx" ON "news" USING btree ("_status");
  CREATE INDEX "news_rels_order_idx" ON "news_rels" USING btree ("order");
  CREATE INDEX "news_rels_parent_idx" ON "news_rels" USING btree ("parent_id");
  CREATE INDEX "news_rels_path_idx" ON "news_rels" USING btree ("path");
  CREATE INDEX "news_rels_admins_id_idx" ON "news_rels" USING btree ("admins_id");
  CREATE INDEX "_news_v_version_key_points_order_idx" ON "_news_v_version_key_points" USING btree ("_order");
  CREATE INDEX "_news_v_version_key_points_parent_id_idx" ON "_news_v_version_key_points" USING btree ("_parent_id");
  CREATE INDEX "_news_v_parent_idx" ON "_news_v" USING btree ("parent_id");
  CREATE INDEX "_news_v_version_version_slug_idx" ON "_news_v" USING btree ("version_slug");
  CREATE INDEX "_news_v_version_version_image_idx" ON "_news_v" USING btree ("version_image_id");
  CREATE INDEX "_news_v_version_version_author_idx" ON "_news_v" USING btree ("version_author_id");
  CREATE INDEX "_news_v_version_version_category_idx" ON "_news_v" USING btree ("version_category_id");
  CREATE INDEX "_news_v_version_version_created_at_idx" ON "_news_v" USING btree ("version_created_at");
  CREATE INDEX "_news_v_version_version__status_idx" ON "_news_v" USING btree ("version__status");
  CREATE INDEX "_news_v_created_at_idx" ON "_news_v" USING btree ("created_at");
  CREATE INDEX "_news_v_updated_at_idx" ON "_news_v" USING btree ("updated_at");
  CREATE INDEX "_news_v_latest_idx" ON "_news_v" USING btree ("latest");
  CREATE INDEX "_news_v_rels_order_idx" ON "_news_v_rels" USING btree ("order");
  CREATE INDEX "_news_v_rels_parent_idx" ON "_news_v_rels" USING btree ("parent_id");
  CREATE INDEX "_news_v_rels_path_idx" ON "_news_v_rels" USING btree ("path");
  CREATE INDEX "_news_v_rels_admins_id_idx" ON "_news_v_rels" USING btree ("admins_id");
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
  CREATE INDEX "notifications_device_types_order_idx" ON "notifications_device_types" USING btree ("order");
  CREATE INDEX "notifications_device_types_parent_idx" ON "notifications_device_types" USING btree ("parent_id");
  CREATE INDEX "notifications_rels_order_idx" ON "notifications_rels" USING btree ("order");
  CREATE INDEX "notifications_rels_parent_idx" ON "notifications_rels" USING btree ("parent_id");
  CREATE INDEX "notifications_rels_path_idx" ON "notifications_rels" USING btree ("path");
  CREATE INDEX "notifications_rels_users_id_idx" ON "notifications_rels" USING btree ("users_id");
  CREATE INDEX "notifications_rels_admins_id_idx" ON "notifications_rels" USING btree ("admins_id");
  CREATE INDEX "partner_content_placements_order_idx" ON "partner_content_placements" USING btree ("order");
  CREATE INDEX "partner_content_placements_parent_idx" ON "partner_content_placements" USING btree ("parent_id");
  CREATE INDEX "partner_content_media_idx" ON "partner_content" USING btree ("media_id");
  CREATE INDEX "partner_content_video_idx" ON "partner_content" USING btree ("video_id");
  CREATE INDEX "partner_content_partner_idx" ON "partner_content" USING btree ("partner_id");
  CREATE INDEX "partner_content_updated_at_idx" ON "partner_content" USING btree ("updated_at");
  CREATE INDEX "partner_content_created_at_idx" ON "partner_content" USING btree ("created_at");
  CREATE INDEX "partner_content_rels_order_idx" ON "partner_content_rels" USING btree ("order");
  CREATE INDEX "partner_content_rels_parent_idx" ON "partner_content_rels" USING btree ("parent_id");
  CREATE INDEX "partner_content_rels_path_idx" ON "partner_content_rels" USING btree ("path");
  CREATE INDEX "partner_content_rels_admins_id_idx" ON "partner_content_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "partners_slug_idx" ON "partners" USING btree ("slug");
  CREATE INDEX "partners_logo_idx" ON "partners" USING btree ("logo_id");
  CREATE INDEX "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
  CREATE INDEX "partners_created_at_idx" ON "partners" USING btree ("created_at");
  CREATE INDEX "partners_rels_order_idx" ON "partners_rels" USING btree ("order");
  CREATE INDEX "partners_rels_parent_idx" ON "partners_rels" USING btree ("parent_id");
  CREATE INDEX "partners_rels_path_idx" ON "partners_rels" USING btree ("path");
  CREATE INDEX "partners_rels_partner_content_id_idx" ON "partners_rels" USING btree ("partner_content_id");
  CREATE INDEX "partners_rels_admins_id_idx" ON "partners_rels" USING btree ("admins_id");
  CREATE INDEX "promotion_media_blocks_promo_video_source_order_idx" ON "promotion_media_blocks_promo_video_source" USING btree ("_order");
  CREATE INDEX "promotion_media_blocks_promo_video_source_parent_id_idx" ON "promotion_media_blocks_promo_video_source" USING btree ("_parent_id");
  CREATE INDEX "promotion_media_blocks_promo_video_source_path_idx" ON "promotion_media_blocks_promo_video_source" USING btree ("_path");
  CREATE INDEX "promotion_media_blocks_promo_image_order_idx" ON "promotion_media_blocks_promo_image" USING btree ("_order");
  CREATE INDEX "promotion_media_blocks_promo_image_parent_id_idx" ON "promotion_media_blocks_promo_image" USING btree ("_parent_id");
  CREATE INDEX "promotion_media_blocks_promo_image_path_idx" ON "promotion_media_blocks_promo_image" USING btree ("_path");
  CREATE INDEX "promotion_media_blocks_promo_image_image_idx" ON "promotion_media_blocks_promo_image" USING btree ("image_id");
  CREATE INDEX "promotion_media_items_order_idx" ON "promotion_media_items" USING btree ("_order");
  CREATE INDEX "promotion_media_items_parent_id_idx" ON "promotion_media_items" USING btree ("_parent_id");
  CREATE INDEX "promotion_media_updated_at_idx" ON "promotion_media" USING btree ("updated_at");
  CREATE INDEX "promotion_media_created_at_idx" ON "promotion_media" USING btree ("created_at");
  CREATE INDEX "promotion_media_rels_order_idx" ON "promotion_media_rels" USING btree ("order");
  CREATE INDEX "promotion_media_rels_parent_idx" ON "promotion_media_rels" USING btree ("parent_id");
  CREATE INDEX "promotion_media_rels_path_idx" ON "promotion_media_rels" USING btree ("path");
  CREATE INDEX "promotion_media_rels_admins_id_idx" ON "promotion_media_rels" USING btree ("admins_id");
  CREATE INDEX "push_tickets_updated_at_idx" ON "push_tickets" USING btree ("updated_at");
  CREATE INDEX "push_tickets_created_at_idx" ON "push_tickets" USING btree ("created_at");
  CREATE INDEX "push_tickets_rels_order_idx" ON "push_tickets_rels" USING btree ("order");
  CREATE INDEX "push_tickets_rels_parent_idx" ON "push_tickets_rels" USING btree ("parent_id");
  CREATE INDEX "push_tickets_rels_path_idx" ON "push_tickets_rels" USING btree ("path");
  CREATE INDEX "push_tickets_rels_admins_id_idx" ON "push_tickets_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "push_tokens_token_idx" ON "push_tokens" USING btree ("token");
  CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");
  CREATE INDEX "push_tokens_updated_at_idx" ON "push_tokens" USING btree ("updated_at");
  CREATE INDEX "push_tokens_created_at_idx" ON "push_tokens" USING btree ("created_at");
  CREATE INDEX "push_tokens_rels_order_idx" ON "push_tokens_rels" USING btree ("order");
  CREATE INDEX "push_tokens_rels_parent_idx" ON "push_tokens_rels" USING btree ("parent_id");
  CREATE INDEX "push_tokens_rels_path_idx" ON "push_tokens_rels" USING btree ("path");
  CREATE INDEX "push_tokens_rels_admins_id_idx" ON "push_tokens_rels" USING btree ("admins_id");
  CREATE INDEX "reactions_user_idx" ON "reactions" USING btree ("user_id");
  CREATE INDEX "reactions_news_idx" ON "reactions" USING btree ("news_id");
  CREATE INDEX "reactions_updated_at_idx" ON "reactions" USING btree ("updated_at");
  CREATE INDEX "reactions_created_at_idx" ON "reactions" USING btree ("created_at");
  CREATE INDEX "reactions_rels_order_idx" ON "reactions_rels" USING btree ("order");
  CREATE INDEX "reactions_rels_parent_idx" ON "reactions_rels" USING btree ("parent_id");
  CREATE INDEX "reactions_rels_path_idx" ON "reactions_rels" USING btree ("path");
  CREATE INDEX "reactions_rels_admins_id_idx" ON "reactions_rels" USING btree ("admins_id");
  CREATE INDEX "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE INDEX "sessions_rels_order_idx" ON "sessions_rels" USING btree ("order");
  CREATE INDEX "sessions_rels_parent_idx" ON "sessions_rels" USING btree ("parent_id");
  CREATE INDEX "sessions_rels_path_idx" ON "sessions_rels" USING btree ("path");
  CREATE INDEX "sessions_rels_admins_id_idx" ON "sessions_rels" USING btree ("admins_id");
  CREATE INDEX "survey_updated_at_idx" ON "survey" USING btree ("updated_at");
  CREATE INDEX "survey_created_at_idx" ON "survey" USING btree ("created_at");
  CREATE INDEX "survey_rels_order_idx" ON "survey_rels" USING btree ("order");
  CREATE INDEX "survey_rels_parent_idx" ON "survey_rels" USING btree ("parent_id");
  CREATE INDEX "survey_rels_path_idx" ON "survey_rels" USING btree ("path");
  CREATE INDEX "survey_rels_users_id_idx" ON "survey_rels" USING btree ("users_id");
  CREATE INDEX "survey_rels_admins_id_idx" ON "survey_rels" USING btree ("admins_id");
  CREATE INDEX "ticket_purchase_log_user_idx" ON "ticket_purchase_log" USING btree ("user_id");
  CREATE INDEX "ticket_purchase_log_lottery_idx" ON "ticket_purchase_log" USING btree ("lottery_id");
  CREATE INDEX "ticket_purchase_log_updated_at_idx" ON "ticket_purchase_log" USING btree ("updated_at");
  CREATE INDEX "ticket_purchase_log_created_at_idx" ON "ticket_purchase_log" USING btree ("created_at");
  CREATE INDEX "ticket_purchase_log_rels_order_idx" ON "ticket_purchase_log_rels" USING btree ("order");
  CREATE INDEX "ticket_purchase_log_rels_parent_idx" ON "ticket_purchase_log_rels" USING btree ("parent_id");
  CREATE INDEX "ticket_purchase_log_rels_path_idx" ON "ticket_purchase_log_rels" USING btree ("path");
  CREATE INDEX "ticket_purchase_log_rels_admins_id_idx" ON "ticket_purchase_log_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");
  CREATE INDEX "users_notification_preferences_idx" ON "users" USING btree ("notification_preferences");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_admins_id_idx" ON "users_rels" USING btree ("admins_id");
  CREATE INDEX "verifications_updated_at_idx" ON "verifications" USING btree ("updated_at");
  CREATE INDEX "verifications_created_at_idx" ON "verifications" USING btree ("created_at");
  CREATE INDEX "verifications_rels_order_idx" ON "verifications_rels" USING btree ("order");
  CREATE INDEX "verifications_rels_parent_idx" ON "verifications_rels" USING btree ("parent_id");
  CREATE INDEX "verifications_rels_path_idx" ON "verifications_rels" USING btree ("path");
  CREATE INDEX "verifications_rels_admins_id_idx" ON "verifications_rels" USING btree ("admins_id");
  CREATE INDEX "witness_reports_updated_at_idx" ON "witness_reports" USING btree ("updated_at");
  CREATE INDEX "witness_reports_created_at_idx" ON "witness_reports" USING btree ("created_at");
  CREATE INDEX "witness_reports_rels_order_idx" ON "witness_reports_rels" USING btree ("order");
  CREATE INDEX "witness_reports_rels_parent_idx" ON "witness_reports_rels" USING btree ("parent_id");
  CREATE INDEX "witness_reports_rels_path_idx" ON "witness_reports_rels" USING btree ("path");
  CREATE INDEX "witness_reports_rels_media_id_idx" ON "witness_reports_rels" USING btree ("media_id");
  CREATE INDEX "witness_reports_rels_admins_id_idx" ON "witness_reports_rels" USING btree ("admins_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX "payload_locked_documents_rels_activities_id_idx" ON "payload_locked_documents_rels" USING btree ("activities_id");
  CREATE INDEX "payload_locked_documents_rels_admins_id_idx" ON "payload_locked_documents_rels" USING btree ("admins_id");
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_content_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("content_reports_id");
  CREATE INDEX "payload_locked_documents_rels_feedback_id_idx" ON "payload_locked_documents_rels" USING btree ("feedback_id");
  CREATE INDEX "payload_locked_documents_rels_identity_verification_id_idx" ON "payload_locked_documents_rels" USING btree ("identity_verification_id");
  CREATE INDEX "payload_locked_documents_rels_lottery_id_idx" ON "payload_locked_documents_rels" USING btree ("lottery_id");
  CREATE INDEX "payload_locked_documents_rels_lottery_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("lottery_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_lottery_winners_id_idx" ON "payload_locked_documents_rels" USING btree ("lottery_winners_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_news_id_idx" ON "payload_locked_documents_rels" USING btree ("news_id");
  CREATE INDEX "payload_locked_documents_rels_notification_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("notification_logs_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_partner_content_id_idx" ON "payload_locked_documents_rels" USING btree ("partner_content_id");
  CREATE INDEX "payload_locked_documents_rels_partners_id_idx" ON "payload_locked_documents_rels" USING btree ("partners_id");
  CREATE INDEX "payload_locked_documents_rels_promotion_media_id_idx" ON "payload_locked_documents_rels" USING btree ("promotion_media_id");
  CREATE INDEX "payload_locked_documents_rels_push_tickets_id_idx" ON "payload_locked_documents_rels" USING btree ("push_tickets_id");
  CREATE INDEX "payload_locked_documents_rels_push_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("push_tokens_id");
  CREATE INDEX "payload_locked_documents_rels_reactions_id_idx" ON "payload_locked_documents_rels" USING btree ("reactions_id");
  CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");
  CREATE INDEX "payload_locked_documents_rels_survey_id_idx" ON "payload_locked_documents_rels" USING btree ("survey_id");
  CREATE INDEX "payload_locked_documents_rels_ticket_purchase_log_id_idx" ON "payload_locked_documents_rels" USING btree ("ticket_purchase_log_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_verifications_id_idx" ON "payload_locked_documents_rels" USING btree ("verifications_id");
  CREATE INDEX "payload_locked_documents_rels_witness_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("witness_reports_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_admins_id_idx" ON "payload_preferences_rels" USING btree ("admins_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "news_category_items_order_idx" ON "news_category_items" USING btree ("_order");
  CREATE INDEX "news_category_items_parent_id_idx" ON "news_category_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "news_category_items_category_idx" ON "news_category_items" USING btree ("category_id");
  CREATE INDEX "news_category_rels_order_idx" ON "news_category_rels" USING btree ("order");
  CREATE INDEX "news_category_rels_parent_idx" ON "news_category_rels" USING btree ("parent_id");
  CREATE INDEX "news_category_rels_path_idx" ON "news_category_rels" USING btree ("path");
  CREATE INDEX "news_category_rels_admins_id_idx" ON "news_category_rels" USING btree ("admins_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "accounts" CASCADE;
  DROP TABLE "accounts_rels" CASCADE;
  DROP TABLE "activities" CASCADE;
  DROP TABLE "activities_rels" CASCADE;
  DROP TABLE "admins_sessions" CASCADE;
  DROP TABLE "admins" CASCADE;
  DROP TABLE "admins_rels" CASCADE;
  DROP TABLE "banners" CASCADE;
  DROP TABLE "banners_rels" CASCADE;
  DROP TABLE "campaigns" CASCADE;
  DROP TABLE "campaigns_rels" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_rels" CASCADE;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "comments_rels" CASCADE;
  DROP TABLE "content_reports" CASCADE;
  DROP TABLE "content_reports_rels" CASCADE;
  DROP TABLE "feedback" CASCADE;
  DROP TABLE "feedback_rels" CASCADE;
  DROP TABLE "identity_verification" CASCADE;
  DROP TABLE "identity_verification_rels" CASCADE;
  DROP TABLE "lottery" CASCADE;
  DROP TABLE "lottery_rels" CASCADE;
  DROP TABLE "lottery_tickets" CASCADE;
  DROP TABLE "lottery_tickets_rels" CASCADE;
  DROP TABLE "lottery_winners" CASCADE;
  DROP TABLE "lottery_winners_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_rels" CASCADE;
  DROP TABLE "news_key_points" CASCADE;
  DROP TABLE "news" CASCADE;
  DROP TABLE "news_rels" CASCADE;
  DROP TABLE "_news_v_version_key_points" CASCADE;
  DROP TABLE "_news_v" CASCADE;
  DROP TABLE "_news_v_rels" CASCADE;
  DROP TABLE "notification_logs" CASCADE;
  DROP TABLE "notification_logs_rels" CASCADE;
  DROP TABLE "notifications_device_types" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "notifications_rels" CASCADE;
  DROP TABLE "partner_content_placements" CASCADE;
  DROP TABLE "partner_content" CASCADE;
  DROP TABLE "partner_content_rels" CASCADE;
  DROP TABLE "partners" CASCADE;
  DROP TABLE "partners_rels" CASCADE;
  DROP TABLE "promotion_media_blocks_promo_video_source" CASCADE;
  DROP TABLE "promotion_media_blocks_promo_image" CASCADE;
  DROP TABLE "promotion_media_items" CASCADE;
  DROP TABLE "promotion_media" CASCADE;
  DROP TABLE "promotion_media_rels" CASCADE;
  DROP TABLE "push_tickets" CASCADE;
  DROP TABLE "push_tickets_rels" CASCADE;
  DROP TABLE "push_tokens" CASCADE;
  DROP TABLE "push_tokens_rels" CASCADE;
  DROP TABLE "reactions" CASCADE;
  DROP TABLE "reactions_rels" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "sessions_rels" CASCADE;
  DROP TABLE "survey" CASCADE;
  DROP TABLE "survey_rels" CASCADE;
  DROP TABLE "ticket_purchase_log" CASCADE;
  DROP TABLE "ticket_purchase_log_rels" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "verifications" CASCADE;
  DROP TABLE "verifications_rels" CASCADE;
  DROP TABLE "witness_reports" CASCADE;
  DROP TABLE "witness_reports_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "news_category_items" CASCADE;
  DROP TABLE "news_category" CASCADE;
  DROP TABLE "news_category_rels" CASCADE;
  DROP TYPE "public"."enum_activities_type";
  DROP TYPE "public"."enum_activities_action";
  DROP TYPE "public"."enum_admins_role";
  DROP TYPE "public"."enum_banners_type";
  DROP TYPE "public"."enum_banners_size";
  DROP TYPE "public"."enum_content_reports_report_type";
  DROP TYPE "public"."enum_content_reports_reason";
  DROP TYPE "public"."enum_content_reports_status";
  DROP TYPE "public"."enum_content_reports_resolution";
  DROP TYPE "public"."enum_feedback_type";
  DROP TYPE "public"."enum_lottery_winners_prize_tier";
  DROP TYPE "public"."enum_news_type";
  DROP TYPE "public"."enum_news_status";
  DROP TYPE "public"."enum__news_v_version_type";
  DROP TYPE "public"."enum__news_v_version_status";
  DROP TYPE "public"."enum_notification_logs_status";
  DROP TYPE "public"."enum_notifications_device_types";
  DROP TYPE "public"."enum_notifications_status";
  DROP TYPE "public"."enum_notifications_target_type";
  DROP TYPE "public"."enum_notifications_segment";
  DROP TYPE "public"."enum_notifications_priority";
  DROP TYPE "public"."enum_partner_content_placements";
  DROP TYPE "public"."enum_partner_content_type";
  DROP TYPE "public"."enum_partner_content_video_type";
  DROP TYPE "public"."enum_partner_content_cta";
  DROP TYPE "public"."enum_partner_content_status";
  DROP TYPE "public"."enum_partner_content_ad_size";
  DROP TYPE "public"."enum_partners_status";
  DROP TYPE "public"."enum_partners_category";
  DROP TYPE "public"."enum_promotion_media_blocks_promo_video_source_video_source";
  DROP TYPE "public"."enum_push_tokens_device_type";
  DROP TYPE "public"."enum_push_tokens_status";
  DROP TYPE "public"."enum_reactions_type";
  DROP TYPE "public"."enum_witness_reports_report_type";`);
}
