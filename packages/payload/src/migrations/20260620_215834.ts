import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reactions" ALTER COLUMN "news_id" DROP NOT NULL;
  ALTER TABLE "comments" ADD COLUMN "likes_count" numeric DEFAULT 0;
  ALTER TABLE "comments" ADD COLUMN "dislikes_count" numeric DEFAULT 0;
  ALTER TABLE "comments" ADD COLUMN "total_replies" numeric DEFAULT 0;
  ALTER TABLE "news" ADD COLUMN "total_comments" numeric DEFAULT 0;
  ALTER TABLE "_news_v" ADD COLUMN "version_total_comments" numeric DEFAULT 0;
  ALTER TABLE "reactions_rels" ADD COLUMN "news_id" uuid;
  ALTER TABLE "reactions_rels" ADD COLUMN "comments_id" uuid;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reactions_rels" ADD CONSTRAINT "reactions_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "reactions_rels_news_id_idx" ON "reactions_rels" USING btree ("news_id");
  CREATE INDEX "reactions_rels_comments_id_idx" ON "reactions_rels" USING btree ("comments_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "reactions_rels" DROP CONSTRAINT "reactions_rels_news_fk";

  ALTER TABLE "reactions_rels" DROP CONSTRAINT "reactions_rels_comments_fk";

  DROP INDEX "reactions_rels_news_id_idx";
  DROP INDEX "reactions_rels_comments_id_idx";
  ALTER TABLE "reactions" ALTER COLUMN "news_id" SET NOT NULL;
  ALTER TABLE "comments" DROP COLUMN "likes_count";
  ALTER TABLE "comments" DROP COLUMN "dislikes_count";
  ALTER TABLE "comments" DROP COLUMN "total_replies";
  ALTER TABLE "news" DROP COLUMN "total_comments";
  ALTER TABLE "_news_v" DROP COLUMN "version_total_comments";
  ALTER TABLE "reactions_rels" DROP COLUMN "news_id";
  ALTER TABLE "reactions_rels" DROP COLUMN "comments_id";`);
}
