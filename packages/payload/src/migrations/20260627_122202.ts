import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_audit_logs_operation" AS ENUM('create', 'read', 'update', 'delete');
  CREATE TABLE "audit_logs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"collection" varchar NOT NULL,
  	"document_id" varchar NOT NULL,
  	"operation" "enum_audit_logs_operation" NOT NULL,
  	"performed_by_id" uuid,
  	"original_data" jsonb,
  	"new_data" jsonb,
  	"ip" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_logs_id" uuid;
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_id_admins_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "audit_logs_collection_idx" ON "audit_logs" USING btree ("collection");
  CREATE INDEX "audit_logs_document_id_idx" ON "audit_logs" USING btree ("document_id");
  CREATE INDEX "audit_logs_operation_idx" ON "audit_logs" USING btree ("operation");
  CREATE INDEX "audit_logs_performed_by_idx" ON "audit_logs" USING btree ("performed_by_id");
  CREATE INDEX "audit_logs_updated_at_idx" ON "audit_logs" USING btree ("updated_at");
  CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk" FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_audit_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_logs_id");`);
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "audit_logs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_logs_fk";

  DROP INDEX "payload_locked_documents_rels_audit_logs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_logs_id";
  DROP TYPE "public"."enum_audit_logs_operation";`);
}
