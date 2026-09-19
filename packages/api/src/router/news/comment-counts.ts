import type { Payload } from "payload";

/**
 * Counts comments for a single news doc live, rather than trusting the
 * denormalized news.total_comments column. news is a drafts-enabled
 * (versioned) collection, so admin edits/republishes can write the doc's
 * stale field value back over the raw-SQL counter maintained by the
 * Comments hooks, and this sidesteps that entirely for the article view.
 */
export async function getCommentCountForNews(
  payload: Payload,
  newsId: string
): Promise<number> {
  const result = await payload.count({
    collection: "comments",
    where: {
      news: { equals: newsId },
    },
  });
  return result.totalDocs;
}
