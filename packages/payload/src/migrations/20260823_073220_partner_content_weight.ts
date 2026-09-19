import type {
  MigrateDownArgs,
  MigrateUpArgs,
} from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partner_content" ADD COLUMN "weight" numeric DEFAULT 1;
  ALTER TABLE "partner_content" DROP COLUMN "priority";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "partner_content" ADD COLUMN "priority" numeric DEFAULT 10;
  ALTER TABLE "partner_content" DROP COLUMN "weight";`)
}
