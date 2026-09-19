import type { CollectionAfterChangeHook } from "payload";

import { getCommentThreadUrl } from "../../lib/comment-notification-links";

/**
 * Sends an immediate push notification to the author of the comment being
 * replied to, when a new reply is created. No-ops for top-level comments
 * (no parent/replyingTo), self-replies, or when the recipient has comment
 * notifications disabled.
 */
const notifyOnReply: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== "create") {
    return doc;
  }

  const replyingTo =
    typeof doc.replyingTo === "string" ? doc.replyingTo : doc.replyingTo?.id;
  const parent = typeof doc.parent === "string" ? doc.parent : doc.parent?.id;
  const replyTargetId = replyingTo ?? parent;

  if (!replyTargetId) {
    return doc;
  }

  const actorId = typeof doc.user === "string" ? doc.user : doc.user?.id;
  if (!actorId) {
    return doc;
  }

  try {
    const targetComment = await req.payload.findByID({
      collection: "comments",
      id: replyTargetId,
      depth: 0,
      req,
    });

    const recipientId =
      typeof targetComment?.user === "string"
        ? targetComment.user
        : targetComment?.user?.id;

    if (!recipientId || recipientId === actorId) {
      return doc;
    }

    const recipient = await req.payload.findByID({
      collection: "users",
      id: recipientId,
      depth: 0,
      req,
    });

    if (!recipient?.notificationPreferences?.types?.COMMENT) {
      return doc;
    }

    const actor = await req.payload.findByID({
      collection: "users",
      id: actorId,
      depth: 0,
      req,
    });

    const actorUsername = actor?.username || "Someone";
    const text = (doc.text as string) ?? "";
    const preview = text.length > 140 ? `${text.slice(0, 140)}...` : text;
    const newsId = typeof doc.news === "string" ? doc.news : doc.news?.id;

    // Deep link opens the thread rooted at the parent, with the new reply
    // itself pinned/highlighted. `parent` is always the thread root here.
    const rootCommentId = parent ?? doc.id;
    const url = newsId
      ? await getCommentThreadUrl({
          payload: req.payload,
          req,
          newsId,
          rootCommentId,
          highlightCommentId: doc.id,
        })
      : null;

    await req.payload.create({
      collection: "notifications",
      data: {
        title: `${actorUsername} replied to your comment`,
        body: preview,
        type: "comment",
        deliveryAction: "send-now",
        targetType: "specific",
        specificUsers: [recipientId],
        deviceTypes: ["all"],
        priority: "high",
        sound: true,
        _status: "published",
        data: { commentId: doc.id, newsId, kind: "reply", url },
      },
      req,
    });
  } catch (error) {
    req.payload.logger.error(
      { error, commentId: doc.id, replyTargetId },
      "notifyOnReply: failed to create notification"
    );
  }

  return doc;
};

export default notifyOnReply;
