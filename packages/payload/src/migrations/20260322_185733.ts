import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories_breadcrumbs" (
      "_order" integer NOT NULL,
      "_parent_id" uuid NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "doc_id" uuid,
      "url" varchar,
      "label" varchar
    );

    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" uuid;
    ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "pathname" varchar;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_breadcrumbs_doc_id_categories_id_fk') THEN
        ALTER TABLE "categories_breadcrumbs" ADD CONSTRAINT "categories_breadcrumbs_doc_id_categories_id_fk"
          FOREIGN KEY ("doc_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_breadcrumbs_parent_id_fk') THEN
        ALTER TABLE "categories_breadcrumbs" ADD CONSTRAINT "categories_breadcrumbs_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_categories_id_fk') THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk"
          FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS "categories_breadcrumbs_order_idx" ON "categories_breadcrumbs" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "categories_breadcrumbs_parent_id_idx" ON "categories_breadcrumbs" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "categories_breadcrumbs_doc_idx" ON "categories_breadcrumbs" USING btree ("doc_id");
    CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "categories" USING btree ("parent_id");
  `);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "categories_breadcrumbs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "categories_breadcrumbs" CASCADE;
  ALTER TABLE "categories" DROP CONSTRAINT "categories_parent_id_categories_id_fk";

  DROP INDEX "categories_parent_idx";
  ALTER TABLE "categories" DROP COLUMN "parent_id";
  ALTER TABLE "categories" DROP COLUMN "pathname";`);
}
