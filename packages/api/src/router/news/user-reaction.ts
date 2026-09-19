import type { Payload } from "payload";

export type UserReaction = "like" | "dislike" | "none";

type ReactionRow = {
  target?: { relationTo?: string; value: { id: string } | string } | null;
  type: "like" | "dislike" | "none";
};

/**
 * Look up the current user's reaction (if any) to a single news doc.
 * Returns "none" when the user has not reacted, or when there is no user.
 */
export async function getUserReactionForNews(
  payload: Payload,
  userId: string | null | undefined,
  newsId: string
): Promise<UserReaction> {
  if (!userId) {
    return "none";
  }
  const result = await payload.find({
    collection: "reactions",
    where: {
      "target.relationTo": { equals: "news" },
      "target.value": { equals: newsId },
      user: { equals: userId },
    },
    limit: 1,
    depth: 0,
  });
  const first = result.docs[0] as ReactionRow | undefined;
  if (!first) {
    return "none";
  }
  if (first.type === "like" || first.type === "dislike") {
    return first.type;
  }
  return "none";
}

/**
 * Batched lookup: returns a Map<newsId, UserReaction> for the given user and
 * set of news ids. Single DB round-trip; one query total.
 */
export async function getUserReactionsForNews(
  payload: Payload,
  userId: string | null | undefined,
  newsIds: string[]
): Promise<Map<string, UserReaction>> {
  const out = new Map<string, UserReaction>();
  if (!userId || newsIds.length === 0) {
    return out;
  }
  const result = await payload.find({
    collection: "reactions",
    where: {
      "target.relationTo": { equals: "news" },
      "target.value": { in: newsIds },
      user: { equals: userId },
    },
    limit: newsIds.length,
    depth: 0,
  });
  for (const doc of result.docs as ReactionRow[]) {
    const newsId =
      typeof doc.target?.value === "string"
        ? doc.target.value
        : doc.target?.value?.id;
    if (!newsId) {
      continue;
    }
    if (doc.type === "like" || doc.type === "dislike") {
      out.set(newsId, doc.type);
    }
  }
  return out;
}

/**
 * Read the canonical likesCount / dislikesCount from a news doc after a
 * reaction write. The NewsReactions afterChange/afterDelete hooks keep these
 * in sync, so a fresh payload.findByID gives us the source of truth.
 */
export async function getNewsReactionCounts(
  payload: Payload,
  newsId: string
): Promise<{ likesCount: number; dislikesCount: number }> {
  const doc = await payload.findByID({
    collection: "news",
    id: newsId,
    depth: 0,
  });
  return {
    likesCount: doc?.likesCount ?? 0,
    dislikesCount: doc?.dislikesCount ?? 0,
  };
}
