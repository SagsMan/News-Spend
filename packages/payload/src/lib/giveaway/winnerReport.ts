import type { BasePayload } from "payload";

import {
  PRIZE_TIERS,
  type PrizeTier,
} from "../../collections/giveaway/constants";
import type { GiveawayAuditLog, GiveawayWinner } from "../../payload-types";

/** Nigeria, so the report reads in the time zone the draw was run in. */
const REPORT_TIME_ZONE = "Africa/Lagos";

export type WinnerReportRow = {
  winnerId: string;
  userId: string;
  username: string;
  email: string;
  phone: string;
  tier: PrizeTier;
  prizeName: string;
  prizeValueNaira: number | null;
  winningTicketId: string;
  validTicketCount: number;
  boostCount: number;
  featuredOfferCount: number;
  claimStatus: string;
  fulfilmentStatus: string;
  /** 22.7/22.8: fulfilment paused pending an administrator's review. */
  heldForReview: boolean;
  reviewNote: string;
  /** 12: the winner this row replaces, if any. */
  replacesWinnerId: string;
  disqualifiedAt: string;
  disqualificationReason: string;
  selectedAt: string;
};

export type WinnerReport = {
  giveawayId: string;
  title: string;
  drawCompletedAt: string | null;
  /** Human-readable, in the draw's own time zone. */
  drawDateLabel: string;
  /** `YYYY-MM-DD`, for the attachment filename. */
  drawDateStamp: string;
  status: string;
  executionId: string | null;
  totalValidParticipants: number;
  /**
   * Winners currently holding a prize. Disqualified rows are excluded: a
   * disqualified winner is not a winner, but they still appear in the CSV,
   * with their replacement, so the record of what happened stays complete.
   */
  totalWinners: number;
  tierCounts: Record<PrizeTier, number>;
  antiAbuse: {
    heldForReview: number;
    accountsExcluded: number;
    fairnessExclusions: { rule: string; count: number }[];
    loyaltyWaivers: number;
    disqualified: number;
    replacements: number;
  };
  rows: WinnerReportRow[];
};

/**
 * Assemble the Winner Report for a completed draw (spec 21).
 *
 * Everything is read back from the persisted records rather than passed
 * through from the draw, so a report generated now and one generated after a
 * resend say the same thing, and a report can be produced for a draw that
 * ran long before this code did.
 */
export async function buildWinnerReport(
  payload: BasePayload,
  giveawayId: string
): Promise<WinnerReport> {
  const giveaway = await payload.findByID({
    collection: "giveaways",
    id: giveawayId,
    depth: 0,
  });

  if (!giveaway) {
    throw new Error(`Giveaway ${giveawayId} not found`);
  }

  const [winners, auditEvents] = await Promise.all([
    payload.find({
      collection: "giveaway-winners",
      where: { giveaway: { equals: giveawayId } },
      sort: "selectedAt",
      pagination: false,
      // Depth 1 resolves the user and prize so the report can name them.
      depth: 1,
    }),
    payload.find({
      collection: "giveaway-audit-log",
      where: { giveaway: { equals: giveawayId } },
      pagination: false,
      depth: 0,
    }),
  ]);

  const rows = winners.docs.map(toReportRow);

  const active = rows.filter((row) => row.claimStatus !== "disqualified");
  const tierCounts = Object.fromEntries(
    PRIZE_TIERS.map((tier) => [
      tier,
      active.filter((row) => row.tier === tier).length,
    ])
  ) as Record<PrizeTier, number>;

  const drawDate = giveaway.drawCompletedAt
    ? new Date(giveaway.drawCompletedAt)
    : new Date();

  return {
    giveawayId,
    title: giveaway.name || `Draw ${giveawayId}`,
    drawCompletedAt: giveaway.drawCompletedAt ?? null,
    drawDateLabel: drawDate.toLocaleString("en-GB", {
      timeZone: REPORT_TIME_ZONE,
      dateStyle: "long",
      timeStyle: "short",
    }),
    drawDateStamp: stampDate(drawDate),
    status: giveaway.status,
    executionId: (giveaway.drawExecutionId as string | null) ?? null,
    totalValidParticipants: giveaway.totalValidParticipants ?? 0,
    totalWinners: active.length,
    tierCounts,
    antiAbuse: summariseAntiAbuse(rows, auditEvents.docs),
    rows,
  };
}

function toReportRow(winner: GiveawayWinner): WinnerReportRow {
  const user = winner.user as Record<string, unknown> | string | null;
  const prize = winner.prize as Record<string, unknown> | string | null;
  const userDoc = typeof user === "object" && user !== null ? user : null;
  const prizeDoc = typeof prize === "object" && prize !== null ? prize : null;

  const value = prizeDoc?.valueNaira;

  return {
    winnerId: String(winner.id ?? ""),
    userId: userDoc ? String(userDoc.id ?? "") : String(user ?? ""),
    username: text(userDoc?.username ?? userDoc?.name),
    email: text(userDoc?.email),
    phone: text(userDoc?.phone),
    tier: winner.tier as PrizeTier,
    prizeName: text(winner.prizeName),
    prizeValueNaira: typeof value === "number" ? value : null,
    winningTicketId: relationId(winner.winningTicket),
    validTicketCount: Number(winner.validTicketCount ?? 0),
    boostCount: Number(winner.boostCount ?? 0),
    featuredOfferCount: Number(winner.featuredOfferCount ?? 0),
    claimStatus: text(winner.claimStatus),
    fulfilmentStatus: text(winner.fulfilmentStatus),
    heldForReview: winner.fulfilmentStatus === "on_hold",
    reviewNote: text(winner.reviewNote),
    replacesWinnerId: relationId(winner.replaces),
    disqualifiedAt: text(winner.disqualifiedAt),
    disqualificationReason: text(winner.disqualificationReason),
    selectedAt: text(winner.selectedAt),
  };
}

/**
 * The anti-abuse and manual-review summary 21 asks for in the email body.
 *
 * Exclusions are counted from the audit log rather than recomputed, so the
 * report describes what the draw actually did rather than what the same rules
 * would decide today.
 */
function summariseAntiAbuse(
  rows: WinnerReportRow[],
  events: GiveawayAuditLog[]
): WinnerReport["antiAbuse"] {
  const byRule = new Map<string, number>();
  let accountsExcluded = 0;
  let loyaltyWaivers = 0;

  for (const event of events) {
    const detail = (event.detail ?? {}) as Record<string, unknown>;

    if (event.eventType === "account_excluded") {
      accountsExcluded += 1;
    }

    if (event.eventType === "fairness_exclusion") {
      const rule = String(detail.rule ?? "unknown");
      byRule.set(rule, (byRule.get(rule) ?? 0) + Number(detail.count ?? 0));
    }

    if (event.eventType === "loyalty_waiver_applied") {
      loyaltyWaivers += Number(detail.count ?? 0);
    }
  }

  return {
    heldForReview: rows.filter((row) => row.heldForReview).length,
    accountsExcluded,
    fairnessExclusions: [...byRule.entries()]
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count),
    loyaltyWaivers,
    disqualified: rows.filter((row) => row.claimStatus === "disqualified")
      .length,
    replacements: rows.filter((row) => row.replacesWinnerId).length,
  };
}

/** `NewsSpend Winner Report – [Draw Title] – [Draw Date]` (spec 21). */
export function winnerReportSubject(report: WinnerReport): string {
  return `NewsSpend Winner Report – ${report.title} – ${report.drawDateLabel}`;
}

/** `NewsSpend_Winner_Report_[Draw_Title]_[Draw_Date].csv` (spec 21). */
export function winnerReportFileName(report: WinnerReport): string {
  return `NewsSpend_Winner_Report_${slug(report.title)}_${report.drawDateStamp}.csv`;
}

const CSV_COLUMNS: {
  header: string;
  value: (row: WinnerReportRow) => string;
}[] = [
  { header: "Winner ID", value: (r) => r.winnerId },
  { header: "User ID", value: (r) => r.userId },
  { header: "Username", value: (r) => r.username },
  { header: "Email", value: (r) => r.email },
  { header: "Phone", value: (r) => r.phone },
  { header: "Tier", value: (r) => r.tier },
  { header: "Prize", value: (r) => r.prizeName },
  {
    header: "Prize Value (NGN)",
    value: (r) => (r.prizeValueNaira === null ? "" : String(r.prizeValueNaira)),
  },
  { header: "Winning Ticket", value: (r) => r.winningTicketId },
  { header: "Valid Tickets", value: (r) => String(r.validTicketCount) },
  { header: "Boosts", value: (r) => String(r.boostCount) },
  { header: "Featured Offers", value: (r) => String(r.featuredOfferCount) },
  { header: "Claim Status", value: (r) => r.claimStatus },
  { header: "Fulfilment Status", value: (r) => r.fulfilmentStatus },
  { header: "Held For Review", value: (r) => (r.heldForReview ? "Yes" : "No") },
  { header: "Review Note", value: (r) => r.reviewNote },
  { header: "Replaces Winner", value: (r) => r.replacesWinnerId },
  { header: "Disqualified At", value: (r) => r.disqualifiedAt },
  { header: "Disqualification Reason", value: (r) => r.disqualificationReason },
  { header: "Selected At", value: (r) => r.selectedAt },
];

/** The full winner list, including disqualified rows and replacements. */
export function renderWinnerReportCsv(report: WinnerReport): string {
  const lines = [CSV_COLUMNS.map((column) => csvCell(column.header)).join(",")];

  for (const row of report.rows) {
    lines.push(
      CSV_COLUMNS.map((column) => csvCell(column.value(row))).join(",")
    );
  }

  // CRLF: Excel is the likely reader and handles it more predictably.
  return lines.join("\r\n");
}

/**
 * Quote a CSV cell, and defuse anything a spreadsheet would treat as a
 * formula.
 *
 * A username of `=HYPERLINK(...)` is executed on open by Excel and Sheets, and
 * usernames here are user-supplied. Prefixing with an apostrophe keeps the
 * text visible while stopping it being evaluated.
 */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

/** The email body 21 specifies: headline figures, then the review summary. */
export function renderWinnerReportHtml(report: WinnerReport): string {
  const { antiAbuse } = report;

  const fairness = antiAbuse.fairnessExclusions.length
    ? antiAbuse.fairnessExclusions
        .map((entry) => `${entry.rule}: ${entry.count}`)
        .join(", ")
    : "None";

  return `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 640px; color: #1a1a2e;">
  <h2 style="margin: 0 0 4px;">NewsSpend Winner Report</h2>
  <p style="margin: 0 0 20px; color: #666;">${escapeHtml(report.title)}: ${escapeHtml(report.drawDateLabel)}</p>

  <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
    ${summaryRow("Draw ID", report.giveawayId)}
    ${report.executionId ? summaryRow("Execution ID", report.executionId) : ""}
    ${summaryRow("Date / Time", report.drawDateLabel)}
    ${summaryRow("Draw Status", report.status)}
    ${summaryRow("Total Valid Participants", report.totalValidParticipants.toLocaleString("en-NG"))}
    ${summaryRow("Total Winners", String(report.totalWinners))}
    ${summaryRow("Tier 1 Winners", String(report.tierCounts.tier1))}
    ${summaryRow("Tier 2 Winners", String(report.tierCounts.tier2))}
    ${summaryRow("Tier 3 Winners", String(report.tierCounts.tier3))}
  </table>

  <h3 style="margin: 0 0 8px; font-size: 15px;">Anti-Abuse &amp; Manual Review Summary</h3>
  <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
    ${summaryRow("Prizes held for review", String(antiAbuse.heldForReview))}
    ${summaryRow("Accounts excluded", String(antiAbuse.accountsExcluded))}
    ${summaryRow("Fairness cooldown exclusions", fairness)}
    ${summaryRow("Loyalty waivers applied", String(antiAbuse.loyaltyWaivers))}
    ${summaryRow("Winners disqualified", String(antiAbuse.disqualified))}
    ${summaryRow("Replacement winners drawn", String(antiAbuse.replacements))}
  </table>

  <p style="color: #444; margin: 0 0 8px;">The full winner list is attached as a CSV, including any disqualified winners and their replacements.</p>
  <p style="color: #999; font-size: 12px; margin-top: 20px;">News Spend Media: generated automatically after the draw completed.</p>
</div>`;
}

function summaryRow(label: string, value: string): string {
  return `<tr>
      <td style="padding: 6px 12px 6px 0; color: #666; white-space: nowrap;">${escapeHtml(label)}</td>
      <td style="padding: 6px 0;"><strong>${escapeHtml(value)}</strong></td>
    </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `YYYY-MM-DD` in the draw's own time zone. */
function stampDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

/** Filename-safe form of the draw title. */
function slug(title: string): string {
  return (
    (title ?? "")
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s-]+/g, "_")
      .slice(0, 60) || "Draw"
  );
}

function text(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function relationId(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
}
