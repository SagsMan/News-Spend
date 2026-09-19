import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_audit_logs_operation" ADD VALUE 'login';
  ALTER TYPE "public"."enum_audit_logs_operation" ADD VALUE 'logout';`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_logs" ALTER COLUMN "operation" SET DATA TYPE text;
  DROP TYPE "public"."enum_audit_logs_operation";
  CREATE TYPE "public"."enum_audit_logs_operation" AS ENUM('create', 'read', 'update', 'delete');
  ALTER TABLE "audit_logs" ALTER COLUMN "operation" SET DATA TYPE "public"."enum_audit_logs_operation" USING "operation"::"public"."enum_audit_logs_operation";`);
}
