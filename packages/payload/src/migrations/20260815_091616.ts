import type { MigrateDownArgs, MigrateUpArgs } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_identity_checks_provider" AS ENUM('didit');
  CREATE TYPE "public"."enum_identity_checks_status" AS ENUM('Not Started', 'In Progress', 'In Review', 'Approved', 'Declined', 'Abandoned', 'Expired');
  CREATE TABLE "identity_checks" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"provider" "enum_identity_checks_provider" DEFAULT 'didit' NOT NULL,
  	"session_id" varchar NOT NULL,
  	"status" "enum_identity_checks_status" DEFAULT 'Not Started' NOT NULL,
  	"decided_at" timestamp(3) with time zone,
  	"last_webhook_at" timestamp(3) with time zone,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "identity_checks_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"admins_id" uuid
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "identity_checks_id" uuid;
  ALTER TABLE "identity_checks" ADD CONSTRAINT "identity_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "identity_checks_rels" ADD CONSTRAINT "identity_checks_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."identity_checks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "identity_checks_rels" ADD CONSTRAINT "identity_checks_rels_admins_fk" FOREIGN KEY ("admins_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "identity_checks_user_idx" ON "identity_checks" USING btree ("user_id");
  CREATE UNIQUE INDEX "identity_checks_session_id_idx" ON "identity_checks" USING btree ("session_id");
  CREATE INDEX "identity_checks_status_idx" ON "identity_checks" USING btree ("status");
  CREATE INDEX "identity_checks_updated_at_idx" ON "identity_checks" USING btree ("updated_at");
  CREATE INDEX "identity_checks_created_at_idx" ON "identity_checks" USING btree ("created_at");
  CREATE INDEX "identity_checks_rels_order_idx" ON "identity_checks_rels" USING btree ("order");
  CREATE INDEX "identity_checks_rels_parent_idx" ON "identity_checks_rels" USING btree ("parent_id");
  CREATE INDEX "identity_checks_rels_path_idx" ON "identity_checks_rels" USING btree ("path");
  CREATE INDEX "identity_checks_rels_admins_id_idx" ON "identity_checks_rels" USING btree ("admins_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_identity_checks_fk" FOREIGN KEY ("identity_checks_id") REFERENCES "public"."identity_checks"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_identity_checks_id_idx" ON "payload_locked_documents_rels" USING btree ("identity_checks_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "identity_checks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "identity_checks_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "identity_checks" CASCADE;
  DROP TABLE "identity_checks_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_identity_checks_fk";
  
  DROP INDEX "payload_locked_documents_rels_identity_checks_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "identity_checks_id";
  DROP TYPE "public"."enum_identity_checks_provider";
  DROP TYPE "public"."enum_identity_checks_status";`)
}
