import type { TaskConfig } from "payload";
import { LIKE_NOTIFICATION_DEBOUNCE_MS } from "../hooks/reactions/commentLikeNotificationConfig";
import { getCommentThreadUrl } from "../lib/comment-notification-links";
import { getPayload } from "../lib/getPayload";

/**
 * Payload job task: sendCommentLikeNotification
 *
 * Debounced like-notification sender. Queued by the notifyOnCommentLike hook
 * (packages/payload/src/hooks/reactions/notifyOnCommentLike.ts) on
 * Reactions.afterChange, with a delay. The debounce is keyed by the comment
 * author, not by comment, so likes landing on several different comments
 * by the same author within the window are picked up by this one job too,
 * instead of firing a separate push per comment.
 *
 * When it fires, this re-queries which of the author's comments got a "like"
 * within the same debounce window (rather than trusting anything passed at
 * schedule time, so it reflects whatever actually happened by the time it
 * runs) and reports the most recent liker by name, not an exact "N new
 * likes" count, which avoids needing extra persisted state to track "likes
 * since last notified", at the cost of not naming every liker if several
 * liked within the same window.
 *
 * Usage:
 *   await payload.jobs.queue({
 *     task: 'sendCommentLikeNotification',
 *     input: { authorId },
 *     waitUntil: new Date(Date.now() + LIKE_NOTIFICATION_DEBOUNCE_MS),
 *   })
 */
export const sendCommentLikeNotificationTask = {
  slug: "sendCommentLikeNotification",
  inputSchema: [
    {
      name: "authorId",
      type: "text",
      required: true,
    },
  ],
  outputSchema: [
    {
      name: "sent",
      type: "checkbox",
      required: true,
    },
  ],
  retries: 2,
  handler: async ({ input, req }) => {
    const payload = await getPayload();
    const authorId = input.authorId;

    const author = await payload.findByID({
      collection: "users",
      id: authorId,
      depth: 0,
      req,
    });

    if (!author?.notificationPreferences?.types?.COMMENT) {
      return { output: { sent: false } };
    }

    const authoredComments = await payload.find({
      collection: "comments",
      where: { user: { equals: authorId } },
      pagination: false,
      depth: 0,
      req,
    });
    const commentIds = authoredComments.docs.map((comment) => comment.id);

    if (commentIds.length === 0) {
      return { output: { sent: false } };
    }

    const windowStart = new Date(
      Date.now() - LIKE_NOTIFICATION_DEBOUNCE_MS
    ).toISOString();

    const recentLikes = await payload.find({
      collection: "reactions",
      where: {
        "target.relationTo": { equals: "comments" },
        "target.value": { in: commentIds },
        type: { equals: "like" },
        createdAt: { greater_than_equal: windowStart },
      },
      sort: "-createdAt",
      limit: 200,
      depth: 1,
      req,
    });

    if (recentLikes.docs.length === 0) {
      return { output: { sent: false } };
    }

    const likedCommentIds = new Set<string>();
    for (const like of recentLikes.docs) {
      const targetId =
        typeof like.target?.value === "string"
          ? like.target.value
          : like.target?.value?.id;
      if (targetId) {
        likedCommentIds.add(targetId);
      }
    }

    const mostRecentLike = recentLikes.docs[0];
    if (!mostRecentLike) {
      return { output: { sent: false } };
    }

    const likerUser = mostRecentLike.user;
    const likerUsername =
      typeof likerUser === "object" ? likerUser?.username : undefined;

    if (!likerUsername) {
      return { output: { sent: false } };
    }

    const mostRecentCommentId =
      typeof mostRecentLike.target?.value === "string"
        ? mostRecentLike.target.value
        : mostRecentLike.target?.value?.id;

    if (!mostRecentCommentId) {
      return { output: { sent: false } };
    }

    const mostRecentComment = await payload.findByID({
      collection: "comments",
      id: mostRecentCommentId,
      depth: 0,
      req,
    });

    // Deep link opens the thread rooted at the liked comment's parent (or
    // itself when top-level), with the liked comment pinned/highlighted.
    // When multiple comments were liked, this links to the most recently
    // liked one, a real, relevant conversation, even though it's not the
    // only one that changed.
    const newsId =
      typeof mostRecentComment?.news === "string"
        ? mostRecentComment.news
        : mostRecentComment?.news?.id;
    const parentId =
      typeof mostRecentComment?.parent === "string"
        ? mostRecentComment.parent
        : mostRecentComment?.parent?.id;
    const url = newsId
      ? await getCommentThreadUrl({
          payload,
          req,
          newsId,
          rootCommentId: parentId ?? mostRecentCommentId,
          highlightCommentId: mostRecentCommentId,
        })
      : null;

    const distinctCount = likedCommentIds.size;
    const title =
      distinctCount > 1
        ? "New likes on your comments"
        : "New like on your comment";
    const body =
      distinctCount > 1
        ? `${likerUsername} and others liked ${distinctCount} of your comments`
        : `${likerUsername} liked your comment`;

    await payload.create({
      collection: "notifications",
      data: {
        title,
        body,
        type: "comment",
        deliveryAction: "send-now",
        targetType: "specific",
        specificUsers: [authorId],
        deviceTypes: ["all"],
        priority: "default",
        sound: true,
        _status: "published",
        data: {
          commentId: mostRecentCommentId,
          newsId,
          kind: "like",
          url,
          likedCommentCount: distinctCount,
        },
      },
      req,
    });

    return { output: { sent: true } };
  },
} as TaskConfig<"sendCommentLikeNotification">;
