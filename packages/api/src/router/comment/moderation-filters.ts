import { sql } from "@payloadcms/db-postgres";
import type { Payload } from "payload";

type IdRow = { id: string | null };

export async function getReportedCommentIdsForNews(
  payload: Payload,
  userId: string,
  newsId: string
): Promise<string[]> {
  const result = await payload.db.drizzle.execute(sql`
    SELECT DISTINCT rels.comments_id AS id
    FROM content_reports_rels rels
    JOIN content_reports cr ON cr.id = rels.parent_id
    JOIN comments c ON c.id = rels.comments_id
    WHERE rels.path = 'reportedItem'
      AND rels.comments_id IS NOT NULL
      AND cr.reported_by_id = ${userId}
      AND c.news_id = ${newsId}
  `);

  return extractIds(result);
}

/**
 * Users the viewer has blocked who have actually commented on this article.
 *
 * Bounded the same way: blocking five hundred people costs nothing here unless
 * those people commented on the article being read.
 */
export async function getBlockedUserIdsForNews(
  payload: Payload,
  userId: string,
  newsId: string
): Promise<string[]> {
  const result = await payload.db.drizzle.execute(sql`
    SELECT DISTINCT ub.blocked_id AS id
    FROM user_blocks ub
    JOIN comments c ON c.user_id = ub.blocked_id
    WHERE ub.blocker_id = ${userId}
      AND c.news_id = ${newsId}
  `);

  return extractIds(result);
}

/** Whether the viewer has reported one specific comment. */
export async function hasReportedComment(
  payload: Payload,
  userId: string,
  commentId: string
): Promise<boolean> {
  const result = await payload.db.drizzle.execute(sql`
    SELECT 1 AS id
    FROM content_reports_rels rels
    JOIN content_reports cr ON cr.id = rels.parent_id
    WHERE rels.path = 'reportedItem'
      AND rels.comments_id = ${commentId}
      AND cr.reported_by_id = ${userId}
    LIMIT 1
  `);

  return rowsOf(result).length > 0;
}

/** Whether the viewer has blocked one specific user. */
export async function hasBlockedUser(
  payload: Payload,
  userId: string,
  targetUserId: string
): Promise<boolean> {
  const result = await payload.db.drizzle.execute(sql`
    SELECT 1 AS id
    FROM user_blocks
    WHERE blocker_id = ${userId}
      AND blocked_id = ${targetUserId}
    LIMIT 1
  `);

  return rowsOf(result).length > 0;
}

/**
 * Drizzle's postgres driver returns either an array of rows or a pg Result
 * with a `rows` property, depending on adapter version.
 */
function rowsOf(result: unknown): IdRow[] {
  if (Array.isArray(result)) {
    return result as IdRow[];
  }
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as IdRow[]) : [];
}

function extractIds(result: unknown): string[] {
  return rowsOf(result)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string");
}
