import { DEFAULT_FROM_EMAIL, resend } from "@news-spend-media/mail";
import type { TaskConfig } from "payload";
import { getPayload } from "../lib/getPayload";
import { REASON_LABELS } from "../lib/moderationLabels";
import { resolveModerationRecipients } from "../lib/moderationRecipients";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Payload job task: sendUrgentModerationAlert
 *
 * Sends a single report to every admin immediately, rather than waiting for
 * the nightly digest. Queued (without `waitUntil`) by the contentReports
 * afterChange hook for severe categories only, so it is picked up by the next
 * default-queue autoRun tick, minutes rather than up to a day.
 *
 * Volume is deliberately not batched here: severe reports should be rare, and
 * one email per report is what makes them impossible to overlook.
 */
export const sendUrgentModerationAlertTask = {
  slug: "sendUrgentModerationAlert",
  retries: 2,
  inputSchema: [{ name: "reportId", type: "text", required: true }],
  handler: async ({ input, req }) => {
    const payload = await getPayload();
    const reportId = (input as { reportId: string }).reportId;

    const [report, adminEmails] = await Promise.all([
      payload.findByID({
        collection: "contentReports",
        id: reportId,
        depth: 0,
        req,
      }),
      resolveModerationRecipients(payload, "urgent", req),
    ]);

    if (!report) {
      return { output: { sent: false } };
    }

    if (adminEmails.length === 0) {
      return { output: { sent: false, reason: "no-recipients" } };
    }

    const serverUrl =
      process.env.PAYLOAD_PUBLIC_SERVER_URL ?? process.env.APP_URL ?? "";

    const reason = (report as { reason?: string }).reason ?? "other";
    const reasonLabel = REASON_LABELS[reason] ?? reason;
    const details = (report as { additionalDetails?: string | null })
      .additionalDetails;
    const escapedDetails = details ? escapeHtml(details) : null;
    const reportedItem = (
      report as {
        reportedItem?: { relationTo: string; value: string } | null;
      }
    ).reportedItem;

    const itemLink =
      reportedItem?.relationTo && reportedItem?.value
        ? `<p><a href="${serverUrl}/admin/collections/${reportedItem.relationTo}/${reportedItem.value}" style="color: #1a73e8;">View reported ${reportedItem.relationTo === "news" ? "article" : "comment"}</a></p>`
        : "";

    const html = `<div style="font-family: system-ui, sans-serif; max-width: 520px;">
  <h2 style="color: #b3261e;">Urgent moderation report</h2>
  <p style="color: #666;">A report was filed in a category that requires immediate review.</p>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr>
      <td style="padding: 8px 0; color: #666;">Reason</td>
      <td><strong>${reasonLabel}</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Reported at</td>
      <td>${new Date((report as { createdAt: string }).createdAt).toLocaleString("en-US", { timeZone: "Africa/Lagos" })}</td>
    </tr>
  </table>
  ${escapedDetails ? `<p style="color: #444;"><strong>Details:</strong> ${escapedDetails}</p>` : ""}
  ${itemLink}
  <p style="color: #666;">The comment has already been hidden automatically if it met the auto-hide criteria. Resolve this report in the <strong>Content Reports</strong> section of the admin panel.</p>
</div>`;

    try {
      await resend.emails.send({
        from: DEFAULT_FROM_EMAIL,
        to: adminEmails,
        subject: `Urgent: ${reasonLabel} report needs review`,
        html,
      });

      req.payload.logger.info(
        { reportId, reason, recipients: adminEmails.length },
        "Urgent moderation alert sent"
      );
    } catch (error) {
      req.payload.logger.error(
        { error, reportId },
        "Failed to send urgent moderation alert"
      );
      throw error;
    }

    return { output: { sent: true } };
  },
} as TaskConfig<"sendUrgentModerationAlert">;
