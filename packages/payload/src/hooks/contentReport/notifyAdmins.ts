import type { CollectionAfterChangeHook } from "payload";
import { getModerationSettings } from "../../lib/moderationSettings";
import { nextDigestTime } from "../../lib/nextDigestTime";

/**
 * Routes new ContentReports to admins on one of two tiers.
 *
 * Severe categories, configurable via the Moderation Settings global, queue
 * an immediate alert job, picked up by the next default-queue autoRun tick.
 * Everything else is batched into the digest (daily 23:00 or a weekly slot,
 * per the Digest Schedule in Moderation Settings): when a digest job is
 * already pending this does nothing, otherwise it queues one. When the digest
 * is disabled, nothing is queued here; urgent alerts above are unaffected.
 */
export const notifyAdminsOnReport: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== "create") {
    return;
  }

  const reason = (doc as { reason?: string }).reason;
  const type = (doc as { type?: string }).type;

  // Filter rejections carry a severe-sounding reason but describe content that
  // was never published, so they must not page anyone. They still reach the
  // nightly digest below. Settings are only read when a page is actually
  // possible, so the common path costs no extra query.
  const isUrgentCandidate = Boolean(reason) && type !== "filterRejection";
  const settings = isUrgentCandidate
    ? await getModerationSettings(req.payload, req)
    : null;

  if (reason && settings?.urgentReasons.has(reason)) {
    try {
      await req.payload.jobs.queue({
        task: "sendUrgentModerationAlert",
        input: { reportId: String((doc as { id: string | number }).id) },
      });
    } catch (error) {
      req.payload.logger.error(
        { error, reason },
        "Failed to queue urgent moderation alert"
      );
    }
    // Falls through to the digest as well, so the nightly summary stays a
    // complete record of the day rather than silently omitting severe reports.
  }

  try {
    const pending = await req.payload.find({
      collection: "payload-jobs",
      where: {
        taskSlug: { equals: "sendModerationDigest" },
        completedAt: { exists: false },
        hasError: { not_equals: true },
      },
      limit: 1,
      depth: 0,
      req,
    });

    if (pending.docs.length > 0) {
      return;
    }

    const digestSettings = await getModerationSettings(req.payload, req);
    if (!digestSettings.digestEnabled) {
      return;
    }

    await req.payload.jobs.queue({
      task: "sendModerationDigest",
      input: {},
      waitUntil: nextDigestTime(new Date(), {
        frequency: digestSettings.digestFrequency,
        weekday: digestSettings.digestWeekday,
      }),
    });
  } catch (error) {
    req.payload.logger.error(
      { error },
      "Failed to schedule moderation digest job"
    );
  }
};
