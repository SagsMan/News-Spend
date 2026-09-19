import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

/**
 * Records which giveaway result a user has already been shown.
 *
 * Purely additive: one nullable column on `users`, plus its index and foreign
 * key. Existing rows read as NULL, which the reveal treats as "has seen
 * nothing", so the first draw after this ships is announced to everyone who
 * entered it, which is the intended behaviour rather than a backfill gap.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "last_giveaway_result_seen_id" uuid;
  ALTER TABLE "users" ADD CONSTRAINT "users_last_giveaway_result_seen_id_giveaways_id_fk" FOREIGN KEY ("last_giveaway_result_seen_id") REFERENCES "public"."giveaways"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_last_giveaway_result_seen_idx" ON "users" USING btree ("last_giveaway_result_seen_id");`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP CONSTRAINT "users_last_giveaway_result_seen_id_giveaways_id_fk";

  DROP INDEX "users_last_giveaway_result_seen_idx";
  ALTER TABLE "users" DROP COLUMN "last_giveaway_result_seen_id";`);
}
