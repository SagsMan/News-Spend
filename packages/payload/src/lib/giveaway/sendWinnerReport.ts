import { sql } from "@payloadcms/db-postgres/drizzle";
import type { BasePayload } from "payload";

import {
  type AuditEventType,
  WINNER_REPORT_RECIPIENT,
} from "../../collections/giveaway/constants";
import type { GiveawayReportDelivery } from "../../payload-types";
import {
  buildWinnerReport,
  renderWinnerReportCsv,
  renderWinnerReportHtml,
  winnerReportFileName,
  winnerReportSubject,
} from "./winnerReport";

export type ReportMessage = {
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; content: string };
};

/** Injectable so tests, and any future provider change, need not touch this. */
export type ReportSender = (
  message: ReportMessage
) => Promise<{ id: string | null }>;

export type SendWinnerReportResult =
  | { sent: true; deliveryId: string; alreadySent?: false }
  | { sent: true; deliveryId: string | null; alreadySent: true }
  | { sent: false; deliveryId: string | null; message: string };

export type SendWinnerReportOptions = {
  /** `original` is the automatic post-draw send; anything else is a resend. */
  kind?: "original" | "resend";
  requestedBy?: string;
  send?: ReportSender;
  /** Attempts within this call before the delivery is marked failed. */
  maxAttempts?: number;
  recipient?: string;
};

const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Send the Winner Report for a completed draw (spec 21).
 *
 * The four sending rules 21 states all live here. The report goes out only
 * once a draw is `completed`; there is at most one *original* per draw, so a
 * second automatic attempt after one has succeeded does nothing; failures are
 * retried, both inside this call and later by
 * {@link retryFailedWinnerReports}; and every attempt is written to the
 * delivery log whether it worked or not.
 *
 * This never throws. A draw that has already awarded its prizes correctly must
 * not be marked failed because a mail provider was unreachable: 21 is
 * explicit that a delivery failure does not invalidate the draw.
 */
export async function sendWinnerReport(
  payload: BasePayload,
  giveawayId: string,
  options: SendWinnerReportOptions = {}
): Promise<SendWinnerReportResult> {
  const kind = options.kind ?? "original";
  const recipient = options.recipient ?? WINNER_REPORT_RECIPIENT;
  const send = options.send ?? defaultSender;

  try {
    const giveaway = await payload.findByID({
      collection: "giveaways",
      id: giveawayId,
      depth: 0,
    });

    if (!giveaway) {
      return {
        sent: false,
        deliveryId: null,
        message: "Giveaway not found.",
      };
    }

    if (giveaway.status !== "completed") {
      return {
        sent: false,
        deliveryId: null,
        message: `The Winner Report is only sent for a completed draw (giveaway is "${giveaway.status}").`,
      };
    }

    // 21: one original per draw. A failed original is retried on its own
    // row rather than duplicated, so "how many originals were there?" always
    // answers one.
    const existingOriginal = await findOriginalDelivery(payload, giveawayId);

    if (kind === "original" && existingOriginal?.status === "sent") {
      return {
        sent: true,
        deliveryId: String(existingOriginal.id),
        alreadySent: true,
      };
    }

    const report = await buildWinnerReport(payload, giveawayId);
    const message: ReportMessage = {
      to: recipient,
      subject: winnerReportSubject(report),
      html: renderWinnerReportHtml(report),
      attachment: {
        filename: winnerReportFileName(report),
        content: renderWinnerReportCsv(report),
      },
    };

    const reuse = kind === "original" ? existingOriginal : null;
    const delivery = reuse
      ? reuse
      : await payload.create({
          collection: "giveaway-report-deliveries",
          data: {
            giveaway: giveawayId,
            kind,
            status: "pending",
            recipient,
            subject: message.subject,
            attachmentFileName: message.attachment.filename,
            winnerCount: report.rows.length,
            attempts: 0,
            requestedBy: options.requestedBy,
            createdAtIso: new Date().toISOString(),
          },
        });

    return await attemptDelivery(payload, {
      deliveryId: String(delivery.id),
      giveawayId,
      message,
      send,
      priorAttempts: Number(delivery.attempts ?? 0),
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      winnerCount: report.rows.length,
    });
  } catch (error) {
    // Building the report itself failed. Still not fatal to the draw.
    payload.logger.error(
      { err: error, giveawayId },
      "[giveaway] could not produce the winner report"
    );
    return {
      sent: false,
      deliveryId: null,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function attemptDelivery(
  payload: BasePayload,
  args: {
    deliveryId: string;
    giveawayId: string;
    message: ReportMessage;
    send: ReportSender;
    priorAttempts: number;
    maxAttempts: number;
    winnerCount: number;
  }
): Promise<SendWinnerReportResult> {
  let attempts = args.priorAttempts;
  let lastError = "";

  for (let i = 0; i < args.maxAttempts; i += 1) {
    attempts += 1;

    try {
      const result = await args.send(args.message);

      await payload.update({
        collection: "giveaway-report-deliveries",
        id: args.deliveryId,
        data: {
          status: "sent",
          attempts,
          providerMessageId: result.id,
          error: null,
          sentAt: new Date().toISOString(),
          subject: args.message.subject,
          attachmentFileName: args.message.attachment.filename,
          winnerCount: args.winnerCount,
        },
      });

      await payload.update({
        collection: "giveaways",
        id: args.giveawayId,
        data: { winnerReportSentAt: new Date().toISOString() },
      });

      await writeAudit(payload, args.giveawayId, {
        eventType: "winner_report_sent",
        message: `Winner Report emailed to ${args.message.to}`,
        detail: {
          deliveryId: args.deliveryId,
          attempts,
          providerMessageId: result.id,
        },
      });

      return { sent: true, deliveryId: args.deliveryId };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      payload.logger.warn(
        { err: error, giveawayId: args.giveawayId, attempt: attempts },
        "[giveaway] winner report delivery failed"
      );
    }
  }

  await payload.update({
    collection: "giveaway-report-deliveries",
    id: args.deliveryId,
    data: { status: "failed", attempts, error: lastError },
  });

  return {
    sent: false,
    deliveryId: args.deliveryId,
    message: lastError,
  };
}

/**
 * Retry every delivery that is still failed (spec 21, "retry automatically
 * on failure").
 *
 * Intended for a scheduled job. Retrying a whole delivery rather than a single
 * send means the report is rebuilt from current records, which is what you
 * want, since a disqualification between the draw and a successful send should
 * be reflected in the report that finally arrives.
 */
export async function retryFailedWinnerReports(
  payload: BasePayload,
  options: { send?: ReportSender; limit?: number } = {}
): Promise<{ retried: number; sent: number }> {
  const failed = await payload.find({
    collection: "giveaway-report-deliveries",
    where: { status: { equals: "failed" } },
    limit: options.limit ?? 20,
    pagination: false,
    depth: 0,
  });

  let sent = 0;
  let retried = 0;

  for (const delivery of failed.docs) {
    const giveawayId = relationId(delivery.giveaway);
    if (!giveawayId) {
      continue;
    }

    if (!(await claimForRetry(payload, String(delivery.id)))) {
      continue;
    }

    retried += 1;

    const result = await sendWinnerReport(payload, giveawayId, {
      kind: delivery.kind as "original" | "resend",
      send: options.send,
      recipient: delivery.recipient,
      maxAttempts: 1,
    });

    if (result.sent) {
      sent += 1;
    }
  }

  return { retried, sent };
}

/**
 * Take exclusive ownership of a failed delivery before retrying it.
 *
 * Reading the failed rows and sending them is not enough on its own, because
 * the job queue runs in more than one process: `jobs.autoRun` lives in the
 * shared config, so the CMS and the API server each sweep, and a rolling
 * deploy briefly doubles that again. Every runner read the same failed row and
 * every one of them sent it: one draw's report went to a real inbox four
 * times in the same millisecond, carrying winners' names, emails and phone
 * numbers each time.
 *
 * The claim is a single conditional UPDATE rather than a read-then-write:
 * Postgres serialises the row, so exactly one runner sees a row come back and
 * the rest move on. `pending` is the claimed state: it is what the delivery
 * was before it failed, and `attemptDelivery` moves it to `sent` or back to
 * `failed`, so a runner that dies mid-send leaves the row eligible again on
 * the next sweep rather than stuck.
 */
async function claimForRetry(
  payload: BasePayload,
  deliveryId: string
): Promise<boolean> {
  try {
    const claimed = await payload.db.drizzle.execute(
      sql`UPDATE giveaway_report_deliveries
          SET status = 'pending', updated_at = now()
          WHERE id = ${deliveryId} AND status = 'failed'
          RETURNING id`
    );

    const rows = (claimed as { rows?: unknown[] })?.rows ?? claimed;
    return Array.isArray(rows) ? rows.length > 0 : Boolean(rows);
  } catch (error) {
    payload.logger.error(
      { err: error, deliveryId },
      "[giveaway] could not claim a winner report for retry"
    );
    return false;
  }
}

async function findOriginalDelivery(
  payload: BasePayload,
  giveawayId: string
): Promise<GiveawayReportDelivery | null> {
  const found = await payload.find({
    collection: "giveaway-report-deliveries",
    where: {
      and: [
        { giveaway: { equals: giveawayId } },
        { kind: { equals: "original" } },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  return found.docs[0] ?? null;
}

async function writeAudit(
  payload: BasePayload,
  giveawayId: string,
  entry: {
    eventType: AuditEventType;
    message: string;
    detail: Record<string, unknown>;
  }
) {
  try {
    await payload.create({
      collection: "giveaway-audit-log",
      data: {
        giveaway: giveawayId,
        eventType: entry.eventType,
        message: entry.message,
        detail: entry.detail,
        occurredAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    payload.logger.error(
      { err: error, giveawayId },
      "[giveaway] failed to write the winner report audit record"
    );
  }
}

/**
 * Resolved lazily so importing this module does not require a mail provider
 * key: the report can be built and rendered in a test without one.
 */
const defaultSender: ReportSender = async (message) => {
  const { sendGiveawayWinnerReport } = await import("@news-spend-media/mail");
  return await sendGiveawayWinnerReport(message);
};

function relationId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
}
