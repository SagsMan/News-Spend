import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "audit_logs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid,
  	"users_id" uuid
  );

  ALTER TABLE "audit_logs" RENAME COLUMN "original_data" TO "snapshot";
  ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_performed_by_id_admins_id_fk";

  DROP INDEX "audit_logs_performed_by_idx";
  ALTER TABLE "audit_logs" ADD COLUMN "diff" jsonb;
  ALTER TABLE "audit_logs_rels" ADD CONSTRAINT "audit_logs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "audit_logs_rels" ADD CONSTRAINT "audit_logs_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "audit_logs_rels" ADD CONSTRAINT "audit_logs_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "audit_logs_rels_order_idx" ON "audit_logs_rels" USING btree ("order");
  CREATE INDEX "audit_logs_rels_parent_idx" ON "audit_logs_rels" USING btree ("parent_id");
  CREATE INDEX "audit_logs_rels_path_idx" ON "audit_logs_rels" USING btree ("path");
  CREATE INDEX "audit_logs_rels_admins_id_idx" ON "audit_logs_rels" USING btree ("admins_id");
  CREATE INDEX "audit_logs_rels_users_id_idx" ON "audit_logs_rels" USING btree ("users_id");
  ALTER TABLE "audit_logs" DROP COLUMN "performed_by_id";
  ALTER TABLE "audit_logs" DROP COLUMN "new_data";`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_logs_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "audit_logs_rels" CASCADE;
  ALTER TABLE "audit_logs" RENAME COLUMN "snapshot" TO "original_data";
  ALTER TABLE "audit_logs" RENAME COLUMN "diff" TO "new_data";
  ALTER TABLE "audit_logs" ADD COLUMN "performed_by_id" uuid;
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_id_admins_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "audit_logs_performed_by_idx" ON "audit_logs" USING btree ("performed_by_id");`);
}
