import type { Payload } from "payload";

export type UserReaction = "like" | "dislike" | "none";

type ReactionRow = {
  target?: {
    relationTo?: string;
    value?: string | { id?: string } | null;
  } | null;
  type: "like" | "dislike" | "none";
};

/**
 * Look up the current user's reaction (if any) to a single comment.
 * Returns "none" when the user has not reacted, or when there is no user.
 */
export async function getUserReactionForComment(
  payload: Payload,
  userId: string | null | undefined,
  commentId: string
): Promise<UserReaction> {
  if (!userId) {
    return "none";
  }
  const result = await payload.find({
    collection: "reactions",
    where: {
      and: [
        { "target.relationTo": { equals: "comments" } },
        { "target.value": { equals: commentId } },
        { user: { equals: userId } },
      ],
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
 * Batched lookup: returns a Map<commentId, UserReaction> for the given user and
 * set of comment ids. Single DB round-trip; one query total.
 */
export async function getUserReactionsForComments(
  payload: Payload,
  userId: string | null | undefined,
  commentIds: string[]
): Promise<Map<string, UserReaction>> {
  const out = new Map<string, UserReaction>();
  if (!userId || commentIds.length === 0) {
    return out;
  }
  const result = await payload.find({
    collection: "reactions",
    where: {
      and: [
        { "target.relationTo": { equals: "comments" } },
        { "target.value": { in: commentIds } },
        { user: { equals: userId } },
      ],
    },
    limit: commentIds.length,
    depth: 0,
  });
  for (const doc of result.docs as ReactionRow[]) {
    const raw = doc.target?.value;
    const commentId = typeof raw === "string" ? raw : raw?.id;
    if (!commentId) {
      continue;
    }
    if (doc.type === "like" || doc.type === "dislike") {
      out.set(commentId, doc.type);
    }
  }
  return out;
}

/**
 * Read the canonical likesCount / dislikesCount from a comment doc after a
 * reaction write. The Reactions afterChange/afterDelete hooks keep these
 * in sync, so a fresh payload.findByID gives us the source of truth.
 */
export async function getCommentReactionCounts(
  payload: Payload,
  commentId: string
): Promise<{ likesCount: number; dislikesCount: number }> {
  const doc = await payload.findByID({
    collection: "comments",
    id: commentId,
    depth: 0,
  });
  return {
    likesCount: doc?.likesCount ?? 0,
    dislikesCount: doc?.dislikesCount ?? 0,
  };
}

export type MinimalUser = { id: string; username: string };

/**
 * Batch-fetch minimal user data (id + username) for a set of user IDs.
 * Used to enrich comment.user fields after fetching with depth: 0.
 */
export async function getUsersMinimal(
  payload: Payload,
  userIds: string[]
): Promise<Map<string, MinimalUser>> {
  const out = new Map<string, MinimalUser>();
  if (userIds.length === 0) {
    return out;
  }
  const result = await payload.find({
    collection: "users",
    where: { id: { in: userIds } },
    limit: userIds.length,
    depth: 0,
  });
  for (const u of result.docs as Array<{ id: string; username: string }>) {
    out.set(u.id, { id: u.id, username: u.username });
  }
  return out;
}
