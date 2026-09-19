import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "partners" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "categories" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "news" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "_news_v" ADD COLUMN "version_generate_slug" boolean DEFAULT true;
  ALTER TABLE "partners" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "categories" DROP COLUMN "slug_lock";
  ALTER TABLE "news" DROP COLUMN "slug_lock";
  ALTER TABLE "_news_v" DROP COLUMN "version_slug_lock";
  ALTER TABLE "partners" DROP COLUMN "slug_lock";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "partners" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "categories" ADD COLUMN "slug_lock" boolean DEFAULT true;
  ALTER TABLE "news" ADD COLUMN "slug_lock" boolean DEFAULT true;
  ALTER TABLE "_news_v" ADD COLUMN "version_slug_lock" boolean DEFAULT true;
  ALTER TABLE "partners" ADD COLUMN "slug_lock" boolean DEFAULT true;
  ALTER TABLE "categories" DROP COLUMN "generate_slug";
  ALTER TABLE "news" DROP COLUMN "generate_slug";
  ALTER TABLE "_news_v" DROP COLUMN "version_generate_slug";
  ALTER TABLE "partners" DROP COLUMN "generate_slug";`);
}
