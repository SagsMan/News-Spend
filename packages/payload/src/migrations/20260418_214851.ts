import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partner_content_items" DROP CONSTRAINT "partner_content_items_thumbnail_id_media_id_fk";

  DROP INDEX "partner_content_items_thumbnail_idx";
  ALTER TABLE "partner_content_blocks_promo_video_source" ADD COLUMN "thumbnail_id" uuid;
  ALTER TABLE "partner_content_blocks_promo_video_source" ADD COLUMN "thumbnail_source" varchar;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ADD COLUMN "thumbnail_id" uuid;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ADD COLUMN "thumbnail_source" varchar;
  ALTER TABLE "partner_content_blocks_promo_video_source" ADD CONSTRAINT "partner_content_blocks_promo_video_source_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promotion_media_blocks_promo_video_source" ADD CONSTRAINT "promotion_media_blocks_promo_video_source_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "partner_content_blocks_promo_video_source_thumbnail_idx" ON "partner_content_blocks_promo_video_source" USING btree ("thumbnail_id");
  CREATE INDEX "promotion_media_blocks_promo_video_source_thumbnail_idx" ON "promotion_media_blocks_promo_video_source" USING btree ("thumbnail_id");
  ALTER TABLE "partner_content_items" DROP COLUMN "thumbnail_id";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partner_content_blocks_promo_video_source" DROP CONSTRAINT "partner_content_blocks_promo_video_source_thumbnail_id_media_id_fk";

  ALTER TABLE "promotion_media_blocks_promo_video_source" DROP CONSTRAINT "promotion_media_blocks_promo_video_source_thumbnail_id_media_id_fk";

  DROP INDEX "partner_content_blocks_promo_video_source_thumbnail_idx";
  DROP INDEX "promotion_media_blocks_promo_video_source_thumbnail_idx";
  ALTER TABLE "partner_content_items" ADD COLUMN "thumbnail_id" uuid;
  ALTER TABLE "partner_content_items" ADD CONSTRAINT "partner_content_items_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "partner_content_items_thumbnail_idx" ON "partner_content_items" USING btree ("thumbnail_id");
  ALTER TABLE "partner_content_blocks_promo_video_source" DROP COLUMN "thumbnail_id";
  ALTER TABLE "partner_content_blocks_promo_video_source" DROP COLUMN "thumbnail_source";
  ALTER TABLE "promotion_media_blocks_promo_video_source" DROP COLUMN "thumbnail_id";
  ALTER TABLE "promotion_media_blocks_promo_video_source" DROP COLUMN "thumbnail_source";`);
}
