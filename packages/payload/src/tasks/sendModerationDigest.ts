import { DEFAULT_FROM_EMAIL, resend } from "@news-spend-media/mail";
import type { TaskConfig } from "payload";
import { getPayload } from "../lib/getPayload";
import { REASON_LABELS } from "../lib/moderationLabels";
import { resolveModerationRecipients } from "../lib/moderationRecipients";
import { getModerationSettings } from "../lib/moderationSettings";
import { nextDigestTime } from "../lib/nextDigestTime";

/**
 * Payload job task: sendModerationDigest
 *
 * Digest email for content reports. Cadence comes from the Moderation
 * Settings global (daily or weekly); runs via cron (configured in
 * configurePayload.ts → jobs.autoRun).
 *
 * Covers *every* unresolved report regardless of age: a 24h window meant
 * anything not actioned on its arrival day silently disappeared, plus a
 * rolling window count of content-filter rejections, which are informational
 * rather than actionable. Recipients are resolved by role and per-admin
 * preference; see lib/moderationRecipients.
 */
export const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export const sendModerationDigestTask = {
  slug: "sendModerationDigest",
  retries: 1,
  handler: async ({ req }) => {
    const payload = await getPayload();
    const settings = await getModerationSettings(payload, req);

    if (!settings.digestEnabled) {
      return { output: { sent: false, reason: "digest-disabled" } };
    }

    const windowMs =
      settings.digestFrequency === "weekly"
        ? 7 * DIGEST_WINDOW_MS
        : DIGEST_WINDOW_MS;
    const windowLabel =
      settings.digestFrequency === "weekly" ? "7 days" : "24 hours";

    const windowStartIso = new Date(Date.now() - windowMs).toISOString();

    const [reportsResult, rejectionsResult, adminEmails] = await Promise.all([
      payload.find({
        collection: "contentReports",
        // Every unresolved report, not just today's. Scoping this to the last
        // 24 hours meant a report that wasn't actioned on the day it arrived
        // dropped out of every subsequent digest and was never surfaced again.
        where: {
          and: [
            { status: { equals: "pending" } },
            { type: { not_equals: "filterRejection" } },
          ],
        },
        sort: "-createdAt",
        depth: 0,
        pagination: false,
        req,
      }),
      // Filter rejections are informational rather than actionable, so they are
      // reported as a rolling 24h count rather than a backlog.
      payload.find({
        collection: "contentReports",
        where: {
          and: [
            { type: { equals: "filterRejection" } },
            { createdAt: { greater_than_equal: windowStartIso } },
          ],
        },
        depth: 0,
        pagination: false,
        req,
      }),
      resolveModerationRecipients(payload, "digest", req),
    ]);

    const reports = reportsResult.docs;
    const rejections = rejectionsResult.docs;

    // While anything is still unresolved, schedule tomorrow's digest now. The
    // report hook only queues a digest when a *new* report arrives, so without
    // this a backlog would stop being reported the moment reports dried up.
    if (reports.length > 0) {
      try {
        const nowIso = new Date().toISOString();
        const existingScheduledDigest = await payload.find({
          collection: "payload-jobs",
          where: {
            and: [
              { taskSlug: { equals: "sendModerationDigest" } },
              { completedAt: { exists: false } },
              { hasError: { not_equals: true } },
              { waitUntil: { greater_than_equal: nowIso } },
            ],
          },
          limit: 1,
          depth: 0,
          pagination: false,
          req,
        });

        if (existingScheduledDigest.docs.length === 0) {
          await payload.jobs.queue({
            task: "sendModerationDigest",
            input: {},
            waitUntil: nextDigestTime(new Date(), {
              frequency: settings.digestFrequency,
              weekday: settings.digestWeekday,
            }),
          });
        }
      } catch (error) {
        req.payload.logger.error(
          { error },
          "Failed to re-schedule moderation digest"
        );
      }
    }

    if (reports.length === 0 && rejections.length === 0) {
      return { output: { sent: false } };
    }

    if (adminEmails.length === 0) {
      return { output: { sent: false, reason: "no-recipients" } };
    }

    const serverUrl =
      process.env.PAYLOAD_PUBLIC_SERVER_URL ?? process.env.APP_URL ?? "";

    // Categorize reports
    let blocks = 0;

    const blockDetails: Array<{ by: string; blocked: string }> = [];
    const contentFlags: Array<{
      reason: string;
      relationTo: string;
      value: string;
      ageDays: number;
    }> = [];

    const windowStart = Date.now() - windowMs;
    let newInWindow = 0;
    let oldestPendingDays = 0;

    for (const doc of reports) {
      const details = (doc as unknown as { additionalDetails?: string | null })
        .additionalDetails;
      const reportedItem = (
        doc as unknown as {
          reportedItem?: {
            relationTo: string;
            value: string;
          } | null;
        }
      ).reportedItem;
      const reason = (doc as unknown as { reason?: string }).reason;
      const type = (doc as unknown as { type?: string | null }).type;
      const createdAt = new Date(
        (doc as unknown as { createdAt: string }).createdAt
      ).getTime();

      if (createdAt >= windowStart) {
        newInWindow++;
      }

      const ageDays = Math.floor((Date.now() - createdAt) / DIGEST_WINDOW_MS);
      oldestPendingDays = Math.max(oldestPendingDays, ageDays);

      // Records predating the `type` field have no value, so fall back to the
      // old details-text sniffing for them only.
      const isBlock =
        type === "block" || (!type && details?.includes("blocked by user"));

      if (isBlock) {
        blocks++;
        const match = details?.match(/User (\S+) blocked by user (\S+)/);
        if (match) {
          blockDetails.push({ by: match[2]!, blocked: match[1]! });
        }
      } else if (reportedItem?.relationTo && reportedItem?.value) {
        contentFlags.push({
          reason: REASON_LABELS[reason ?? "other"] ?? reason ?? "Other",
          relationTo: reportedItem.relationTo,
          value: reportedItem.value,
          ageDays,
        });
      }
    }

    // Oldest first: the backlog is what needs attention, not the newest arrival.
    contentFlags.sort((a, b) => b.ageDays - a.ageDays);

    const now = new Date().toLocaleString("en-US", {
      timeZone: "Africa/Lagos",
    });

    let blockList = "";
    if (blockDetails.length > 0) {
      blockList =
        "<h3>Blocks</h3><ul>" +
        blockDetails
          .map((b) => `<li><strong>${b.by}</strong> blocked ${b.blocked}</li>`)
          .join("") +
        "</ul>";
    }

    // Aggregated per user: a single user with many rejections is the signal
    // worth acting on, not the individual blocked attempts.
    const rejectionsByUser = new Map<string, number>();
    for (const doc of rejections) {
      const reportedBy = (doc as unknown as { reportedBy?: unknown })
        .reportedBy;
      const userId =
        typeof reportedBy === "object" && reportedBy !== null
          ? (reportedBy as { id?: string }).id
          : (reportedBy as string | undefined);
      if (userId) {
        rejectionsByUser.set(userId, (rejectionsByUser.get(userId) ?? 0) + 1);
      }
    }

    const repeatOffenders = [...rejectionsByUser.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    let rejectionList = "";
    if (rejections.length > 0) {
      const offenderRows =
        repeatOffenders.length > 0
          ? `<ul>${repeatOffenders
              .map(
                ([userId, count]) =>
                  `<li><a href="${serverUrl}/admin/collections/users/${userId}" style="color: #1a73e8;">User ${userId}</a>: <strong>${count}</strong> blocked attempts</li>`
              )
              .join("")}</ul>`
          : "";

      rejectionList = `<h3>Content Filter (last ${windowLabel})</h3>
  <p style="color: #666;"><strong>${rejections.length}</strong> comment${rejections.length > 1 ? "s were" : " was"} blocked before publication across <strong>${rejectionsByUser.size}</strong> user${rejectionsByUser.size === 1 ? "" : "s"}.${repeatOffenders.length > 0 ? " Users with repeated attempts:" : ""}</p>
  ${offenderRows}`;
    }

    let contentFlagList = "";
    if (contentFlags.length > 0) {
      contentFlagList =
        "<h3>Content Flags</h3><ul>" +
        contentFlags
          .map(
            (f) =>
              `<li><strong>${f.reason}</strong>${f.ageDays >= 1 ? ` <span style="color: #b3261e;">(pending ${f.ageDays} day${f.ageDays > 1 ? "s" : ""})</span>` : ""}: <a href="${serverUrl}/admin/collections/${f.relationTo}/${f.value}" style="color: #1a73e8;">View ${f.relationTo === "news" ? "News" : "Comment"}</a></li>`
          )
          .join("") +
        "</ul>";
    }

    const html = `<div style="font-family: system-ui, sans-serif; max-width: 520px;">
  <h2 style="color: #1a1a2e;">Moderation Digest</h2>
  <p style="color: #666;">All unresolved reports (as of ${now}):</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr>
      <td style="padding: 8px 0; color: #666;">New in last ${windowLabel}</td>
      <td><strong>${newInWindow}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Total still pending</td>
      <td><strong>${reports.length}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">User blocks</td>
      <td><strong>${blocks}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Content flags</td>
      <td><strong>${contentFlags.length}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Filter blocks (24h)</td>
      <td><strong>${rejections.length}</strong></td>
    </tr>
    ${
      oldestPendingDays >= 1
        ? `<tr>
      <td style="padding: 8px 0; color: #666;">Oldest unresolved</td>
      <td><strong style="color: #b3261e;">${oldestPendingDays} day${oldestPendingDays > 1 ? "s" : ""}</strong></td>
    </tr>`
        : ""
    }
  </table>
  ${blockList}
  ${contentFlagList}
  ${rejectionList}
  <p style="color: #666;">Review in the <strong>Content Reports</strong> section of the admin panel.</p>
</div>`;

    try {
      await resend.emails.send({
        from: DEFAULT_FROM_EMAIL,
        to: adminEmails,
        subject: `Moderation Digest: ${reports.length} unresolved report${reports.length === 1 ? "" : "s"}${newInWindow > 0 ? ` (${newInWindow} new)` : ""}`,
        html,
      });

      req.payload.logger.info(
        {
          count: reports.length,
          blocks,
          contentFlags: contentFlags.length,
          filterRejections: rejections.length,
          recipients: adminEmails.length,
        },
        "Moderation digest email sent"
      );
    } catch (error) {
      req.payload.logger.error(
        { error },
        "Failed to send moderation digest email"
      );
      throw error;
    }

    return { output: { sent: true } };
  },
} as TaskConfig<"sendModerationDigest">;
