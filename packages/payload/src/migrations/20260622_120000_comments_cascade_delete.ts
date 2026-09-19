import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Change comments.parent_id FK from ON DELETE SET NULL to ON DELETE CASCADE.
 *
 * Before this migration:
 *   - Deleting a comment left its replies (and their descendants) orphaned
 *     with parent_id pointing to a now-deleted row.
 *
 * After this migration:
 *   - Deleting a comment automatically cascades to all descendants via the FK.
 *     Payload's adapter issues a DELETE on the parent row, and the FK
 *     cascade handles the subtree in a single atomic operation.
 *
 * Why we want cascade (not set null) for comments:
 *   - A reply is a child of its parent. The parent's deletion semantically
 *     means the entire thread is gone; the children have no meaning without
 *     the parent. SET NULL preserved the child rows with no way to navigate
 *     to them, which was the worst of both worlds.
 *   - Counters (totalReplies, totalComments) are denormalized caches updated
 *     via bulk SQL in the Comments hooks, so losing the rows on parent
 *     delete is the right semantics.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "comments"
      DROP CONSTRAINT IF EXISTS "comments_parent_id_comments_id_fk",
      ADD CONSTRAINT "comments_parent_id_comments_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id")
      ON DELETE cascade ON UPDATE no action;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverting to SET NULL: this will fail if any rows would lose their
  // parent_id (e.g. mid-cascade). The down migration assumes no parent
  // has been deleted since this migration ran.
  await db.execute(sql`
    ALTER TABLE "comments"
      DROP CONSTRAINT IF EXISTS "comments_parent_id_comments_id_fk",
      ADD CONSTRAINT "comments_parent_id_comments_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id")
      ON DELETE set null ON UPDATE no action;
  `);
}
