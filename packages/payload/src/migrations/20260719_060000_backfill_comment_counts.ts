import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Backfill all denormalized counters on News/Comments from the actual rows
 * they're derived from: total_comments, total_replies, likes_count, and
 * dislikes_count.
 *
 * Why they drifted:
 *   - These counters were maintained by writes that bypassed Payload's normal
 *     path in different ways over time: total_comments/total_replies via raw
 *     SQL in the Comments hooks (bypassing Payload writes entirely), and
 *     likes_count/dislikes_count via a full `payload.update()` call in the
 *     Reactions hook (recalculateCounts) that has since been switched to raw
 *     SQL for the same reason (see collections/Reactions.ts).
 *   - News is a drafts-enabled (versioned) collection, so any admin
 *     edit/republish/version-restore wrote the doc's stale in-memory field
 *     value back over whichever counter had most recently been updated
 *     out-of-band, silently resetting it.
 *   - Rows created before a counter's maintenance hook existed were never
 *     counted at all.
 *
 * Semantics: total_comments/likes_count/dislikes_count on news, and
 * total_replies/likes_count/dislikes_count on comments, all count direct
 * matching rows only (comments count both top-level and replies toward their
 * article; total_replies counts direct children of a comment only).
 *
 * A companion beforeChange guard on News now strips total_comments,
 * likes_count, and dislikes_count from incoming Payload writes so this drift
 * cannot recur through that path; the Reactions hook no longer writes these
 * via payload.update() either.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "news"
    SET "total_comments" = sub.cnt
    FROM (
      SELECT c."news_id" AS news_id, COUNT(*)::int AS cnt
      FROM "comments" c
      WHERE c."news_id" IS NOT NULL
      GROUP BY c."news_id"
    ) sub
    WHERE "news".id = sub.news_id
      AND COALESCE("news"."total_comments", 0) IS DISTINCT FROM sub.cnt
  `);

  await db.execute(sql`
    UPDATE "news"
    SET "total_comments" = 0
    WHERE COALESCE("total_comments", 0) <> 0
      AND NOT EXISTS (
        SELECT 1 FROM "comments" c WHERE c."news_id" = "news".id
      )
  `);

  await db.execute(sql`
    UPDATE "comments"
    SET "total_replies" = sub.cnt
    FROM (
      SELECT r."parent_id" AS parent_id, COUNT(*)::int AS cnt
      FROM "comments" r
      WHERE r."parent_id" IS NOT NULL
      GROUP BY r."parent_id"
    ) sub
    WHERE "comments".id = sub.parent_id
      AND COALESCE("comments"."total_replies", 0) IS DISTINCT FROM sub.cnt
  `);

  await db.execute(sql`
    UPDATE "comments"
    SET "total_replies" = 0
    WHERE COALESCE("total_replies", 0) <> 0
      AND NOT EXISTS (
        SELECT 1 FROM "comments" r WHERE r."parent_id" = "comments".id
      )
  `);

  // reactions targets are polymorphic: reactions_rels has one row per
  // reaction with path='target' and either news_id or comments_id set,
  // joined back to reactions for the like/dislike type.
  await db.execute(sql`
    UPDATE "news"
    SET "likes_count" = COALESCE(sub.likes, 0),
        "dislikes_count" = COALESCE(sub.dislikes, 0)
    FROM (
      SELECT
        rr."news_id" AS news_id,
        COUNT(*) FILTER (WHERE r."type" = 'like')::int AS likes,
        COUNT(*) FILTER (WHERE r."type" = 'dislike')::int AS dislikes
      FROM "reactions_rels" rr
      JOIN "reactions" r ON r.id = rr."parent_id"
      WHERE rr."path" = 'target' AND rr."news_id" IS NOT NULL
      GROUP BY rr."news_id"
    ) sub
    WHERE "news".id = sub.news_id
      AND (
        COALESCE("news"."likes_count", 0) IS DISTINCT FROM sub.likes
        OR COALESCE("news"."dislikes_count", 0) IS DISTINCT FROM sub.dislikes
      )
  `);

  await db.execute(sql`
    UPDATE "news"
    SET "likes_count" = 0, "dislikes_count" = 0
    WHERE (COALESCE("likes_count", 0) <> 0 OR COALESCE("dislikes_count", 0) <> 0)
      AND NOT EXISTS (
        SELECT 1 FROM "reactions_rels" rr
        WHERE rr."path" = 'target' AND rr."news_id" = "news".id
      )
  `);

  await db.execute(sql`
    UPDATE "comments"
    SET "likes_count" = COALESCE(sub.likes, 0),
        "dislikes_count" = COALESCE(sub.dislikes, 0)
    FROM (
      SELECT
        rr."comments_id" AS comments_id,
        COUNT(*) FILTER (WHERE r."type" = 'like')::int AS likes,
        COUNT(*) FILTER (WHERE r."type" = 'dislike')::int AS dislikes
      FROM "reactions_rels" rr
      JOIN "reactions" r ON r.id = rr."parent_id"
      WHERE rr."path" = 'target' AND rr."comments_id" IS NOT NULL
      GROUP BY rr."comments_id"
    ) sub
    WHERE "comments".id = sub.comments_id
      AND (
        COALESCE("comments"."likes_count", 0) IS DISTINCT FROM sub.likes
        OR COALESCE("comments"."dislikes_count", 0) IS DISTINCT FROM sub.dislikes
      )
  `);

  await db.execute(sql`
    UPDATE "comments"
    SET "likes_count" = 0, "dislikes_count" = 0
    WHERE (COALESCE("likes_count", 0) <> 0 OR COALESCE("dislikes_count", 0) <> 0)
      AND NOT EXISTS (
        SELECT 1 FROM "reactions_rels" rr
        WHERE rr."path" = 'target' AND rr."comments_id" = "comments".id
      )
  `);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Counters are derived data recomputed from comments rows; there is no
  // meaningful previous state to restore.
}
