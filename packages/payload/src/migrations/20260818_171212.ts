import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partners" ADD COLUMN "award_on_click" boolean DEFAULT false;
  CREATE INDEX "partners_award_on_click_idx" ON "partners" USING btree ("award_on_click");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "partners_award_on_click_idx";
  ALTER TABLE "partners" DROP COLUMN "award_on_click";`)
}
