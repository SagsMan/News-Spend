import type { CollectionAfterChangeHook } from "payload";

import { getModerationSettings } from "../../lib/moderationSettings";

export { DEFAULT_AUTO_HIDE_THRESHOLD as AUTO_HIDE_REPORT_THRESHOLD } from "../../lib/moderationLabels";

/**
 * Hides reported comments automatically so objectionable content stops being
 * served without waiting for a moderator. Required by App Store Review
 * guideline 1.2, which expects reported content to be acted on promptly;
 * a human-in-the-loop-only flow cannot guarantee that.
 *
 * The threshold and the hide-on-first-report reasons come from the Moderation
 * Settings global, falling back to code defaults when unconfigured.
 *
 * Hiding is reversible: a moderator sets `moderationStatus` back to "visible".
 */
export const autoHideReportedContent: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== "create") {
    return;
  }

  const reportedItem = (
    doc as { reportedItem?: { relationTo?: string; value?: unknown } | null }
  ).reportedItem;

  if (reportedItem?.relationTo !== "comments" || !reportedItem.value) {
    return;
  }

  const commentId =
    typeof reportedItem.value === "object"
      ? (reportedItem.value as { id?: string }).id
      : (reportedItem.value as string);

  if (!commentId) {
    return;
  }

  const reason = (doc as { reason?: string }).reason;

  try {
    const [comment, settings] = await Promise.all([
      req.payload.findByID({
        collection: "comments",
        id: commentId,
        depth: 0,
        req,
      }),
      getModerationSettings(req.payload, req),
    ]);

    // Only escalate content that is currently public. NULL counts as public:
    // comments created before this field existed have no value, and they must
    // stay auto-hideable. Anything already hidden or removed is left alone so
    // a moderator's decision is never overwritten.
    const status = comment?.moderationStatus;
    if (status === "hidden" || status === "removed") {
      return;
    }

    let shouldHide = reason
      ? settings.hideOnFirstReportReasons.has(reason)
      : false;

    if (!shouldHide) {
      const reports = await req.payload.find({
        collection: "contentReports",
        where: {
          "reportedItem.value": { equals: commentId },
          "reportedItem.relationTo": { equals: "comments" },
          status: { not_equals: "dismissed" },
        },
        depth: 0,
        pagination: false,
        req,
      });

      const distinctReporters = new Set(
        reports.docs
          .map((report) => {
            const reportedBy = (report as { reportedBy?: unknown }).reportedBy;
            return typeof reportedBy === "object" && reportedBy !== null
              ? (reportedBy as { id?: string }).id
              : (reportedBy as string | undefined);
          })
          .filter(Boolean)
      );

      shouldHide = distinctReporters.size >= settings.autoHideThreshold;
    }

    if (!shouldHide) {
      return;
    }

    await req.payload.update({
      collection: "comments",
      id: commentId,
      data: { moderationStatus: "hidden" },
      req,
    });

    req.payload.logger.warn(
      {
        commentId,
        reason,
        trigger:
          reason && settings.hideOnFirstReportReasons.has(reason)
            ? "severe-reason"
            : "report-threshold",
      },
      "Comment auto-hidden pending moderator review"
    );
  } catch (error) {
    // Never fail the user's report because moderation bookkeeping failed.
    req.payload.logger.error(
      { error, commentId },
      "Failed to auto-hide reported comment"
    );
  }
};
