import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from "@payloadcms/db-postgres";

/**
 * Data migration for the reactions consolidation.
 *
 * Before this migration:
 *   - reactions.news_id → news.id (flat FK)
 *   - comments.likes[] / comments.dislikes[] → inline relationship arrays
 *
 * After schema change (handled by 20260620_215834):
 *   - reactions_rels has polymorphic FK columns (news_id, comments_id) with
 *     path = "target" to store the polymorphic `target` relationship
 *   - comments has likes_count / dislikes_count / total_replies columns
 *   - news has total_comments column
 *
 * This script assumes the schema migration has already run, so:
 *   - reactions.news_id is now nullable (legacy, will be dropped later)
 *   - comments.likes[] and comments.dislikes[] still exist (legacy, will be dropped later)
 *   - reactions_rels.news_id and reactions_rels.comments_id are nullable
 *     (a polymorphic row sets exactly one of the two)
 *
 * Steps:
 *   1. Backfill reactions_rels (path="target", news_id) from reactions.news
 *   2. Create new reaction rows from comments.likes[] (target=comments, type=like)
 *   3. Create new reaction rows from comments.dislikes[] (target=comments, type=dislike)
 *   4. Recalculate news.likes_count / news.dislikes_count via bulk SQL
 *   5. Recalculate news.total_comments and comments.total_replies via bulk SQL
 *
 * Steps 2/3 use payload.create, which fires the afterChange hook and backfills
 * comment counts. Step 1 is a raw INSERT into reactions_rels (no hook fires),
 * so we recalculate the affected counters in steps 4/5 with bulk SQL. Bulk
 * SQL is one statement per table, doesn't write _news_v version rows, and
 * doesn't fight with any concurrent process touching the news or comments
 * tables. (Per-row payload.update was tried first and deadlocked.)
 *
 * After this migration completes successfully:
 *   - All reactions rows have a polymorphic target set
 *   - All news and comments have correct counter columns
 *   - Safe to remove the legacy `news` field from Reactions.ts
 *   - Safe to remove the legacy `likes`/`dislikes` fields from Comments.ts
 *   - Run a follow-up schema migration to drop the legacy columns
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Backfill reactions.target from reactions.news.
  // Polymorphic `target` lives in reactions_rels (path = "target", news_id or
  // comments_id set). The reactions.news_id column is legacy; the rels row
  // is the source of truth.
  await db.execute(sql`
    INSERT INTO "reactions_rels" ("parent_id", "path", "news_id", "order")
    SELECT r.id, 'target', r.news_id, 0
    FROM "reactions" r
    WHERE r.news_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "reactions_rels" rel
        WHERE rel."parent_id" = r.id
          AND rel."path" = 'target'
      );
  `);

  payload.logger.info("Backfilled reactions.target from reactions.news");

  // 2 & 3. Iterate comments and create reaction rows from inline arrays.
  // Each create fires the afterChange hook, which recalculates the comment's
  // likesCount / dislikesCount automatically.
  let page = 1;
  const limit = 100;
  let processed = 0;

  while (true) {
    const comments = await payload.find({
      collection: "comments",
      limit,
      page,
      depth: 0,
      overrideAccess: true,
    });

    if (comments.docs.length === 0) {
      break;
    }

    for (const comment of comments.docs) {
      const commentId =
        typeof comment.id === "string" ? comment.id : String(comment.id);

      // Normalize likes/dislikes to string[] of user IDs
      const likeUserIds = (comment.likes ?? []).map((u: unknown) =>
        typeof u === "string" ? u : (u as { id: string }).id
      );
      const dislikeUserIds = (comment.dislikes ?? []).map((u: unknown) =>
        typeof u === "string" ? u : (u as { id: string }).id
      );

      for (const userId of likeUserIds) {
        // Check if a reaction row already exists for this user+target
        // (idempotency: if migration is re-run, skip existing rows)
        const existing = await payload.find({
          collection: "reactions",
          where: {
            "user.id": { equals: userId },
            "target.value": { equals: commentId },
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        if (existing.docs.length > 0) {
          continue;
        }

        await payload.create({
          collection: "reactions",
          // `target` is a polymorphic field added in this migration's
          // schema change; the generated Reaction type doesn't include
          // it yet. Cast to any until types are regenerated.
          data: {
            user: userId,
            target: { relationTo: "comments", value: commentId },
            type: "like",
          } as any,
          depth: 0,
          overrideAccess: true,
        });
      }

      for (const userId of dislikeUserIds) {
        const existing = await payload.find({
          collection: "reactions",
          where: {
            "user.id": { equals: userId },
            "target.value": { equals: commentId },
          } as any,
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        if (existing.docs.length > 0) {
          continue;
        }

        await payload.create({
          collection: "reactions",
          // `target` is a polymorphic field added in this migration's
          // schema change; the generated Reaction type doesn't include
          // it yet. Cast to any until types are regenerated.
          data: {
            user: userId,
            target: { relationTo: "comments", value: commentId },
            type: "dislike",
          } as any,
          depth: 0,
          overrideAccess: true,
        });
      }

      processed++;
    }

    payload.logger.info(
      `Processed ${processed} comments (page ${page}, ${comments.docs.length} docs)`
    );

    if (comments.docs.length < limit) {
      break;
    }
    page++;
  }

  payload.logger.info(
    `Created reaction rows for ${processed} comments' inline likes/dislikes`
  );

  // 4. Recalculate news.likes_count / news.dislikes_count.
  // We can't rely on the afterChange hook here because step 1 was an INSERT
  // into reactions_rels (not a Payload create), so the hook didn't fire.
  // We use bulk SQL instead of per-row payload.update because:
  //   - payload.update writes a row to _news_v (versions: { drafts: true }),
  //     which is slow and can deadlock against any other process touching news
  //   - bulk SQL is one statement per table, completes in milliseconds
  //   - bulk SQL is idempotent: the count is recomputed from source data
  await db.execute(sql`
    WITH counts AS (
      SELECT
        rel."news_id" AS id,
        COUNT(*) FILTER (WHERE r.type = 'like')    AS likes,
        COUNT(*) FILTER (WHERE r.type = 'dislike') AS dislikes
      FROM "reactions_rels" rel
      JOIN "reactions" r ON r.id = rel."parent_id"
      WHERE rel."path" = 'target'
        AND rel."news_id" IS NOT NULL
      GROUP BY rel."news_id"
    )
    UPDATE "news" n
    SET "likes_count" = COALESCE(c.likes, 0),
        "dislikes_count" = COALESCE(c.dislikes, 0)
    FROM counts c
    WHERE n.id = c.id;
  `);

  // Zero out counters on news rows that have no reactions, in case a prior
  // partial run left non-zero values. Combined with the UPDATE above, every
  // news row's likes_count and dislikes_count now reflects the truth.
  await db.execute(sql`
    UPDATE "news" n
    SET "likes_count" = 0, "dislikes_count" = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM "reactions_rels" rel
      JOIN "reactions" r ON r.id = rel."parent_id"
      WHERE rel."path" = 'target'
        AND rel."news_id" = n.id
    );
  `);

  payload.logger.info("Recalculated news.likes_count and news.dislikes_count");

  // 5. Backfill news.total_comments and comments.total_replies.
  await db.execute(sql`
    WITH counts AS (
      SELECT "news_id" AS id, COUNT(*)::numeric AS cnt
      FROM "comments"
      WHERE "news_id" IS NOT NULL
      GROUP BY "news_id"
    )
    UPDATE "news" n
    SET "total_comments" = COALESCE(c.cnt, 0)
    FROM counts c
    WHERE n.id = c.id;
  `);

  await db.execute(sql`
    UPDATE "news" n
    SET "total_comments" = 0
    WHERE NOT EXISTS (
      SELECT 1 FROM "comments" c WHERE c."news_id" = n.id
    );
  `);

  await db.execute(sql`
    WITH counts AS (
      SELECT "parent_id" AS id, COUNT(*)::numeric AS cnt
      FROM "comments"
      WHERE "parent_id" IS NOT NULL
      GROUP BY "parent_id"
    )
    UPDATE "comments" c
    SET "total_replies" = COALESCE(cnt.cnt, 0)
    FROM counts cnt
    WHERE c.id = cnt.id;
  `);

  await db.execute(sql`
    UPDATE "comments" c
    SET "total_replies" = 0
    WHERE "parent_id" IS NULL;
  `);

  payload.logger.info(
    "Recalculated news.total_comments and comments.total_replies"
  );

  payload.logger.info("Migration complete");
}

export async function down({
  db,
  payload,
  req,
}: MigrateDownArgs): Promise<void> {
  payload.logger.warn(
    "down() does not restore inline comment.likes/dislikes arrays. " +
      "Re-run the forward migration or restore from backup if you need to roll back."
  );
}
