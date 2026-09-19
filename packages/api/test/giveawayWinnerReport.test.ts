import { describe, expect, it } from "bun:test";
import {
  type ReportMessage,
  retryFailedWinnerReports,
  sendWinnerReport,
} from "@news-spend-media/payload/lib/giveaway/sendWinnerReport";
import {
  buildWinnerReport,
  renderWinnerReportCsv,
  renderWinnerReportHtml,
  winnerReportFileName,
  winnerReportSubject,
} from "@news-spend-media/payload/lib/giveaway/winnerReport";

type Row = Record<string, any>;

const DRAWN_AT = "2026-08-13T09:30:00.000Z";

function winnerRow(overrides: Row = {}): Row {
  return {
    id: "w1",
    giveaway: "g1",
    user: {
      id: "u1",
      username: "ada",
      email: "ada@example.com",
      phone: "08030000001",
    },
    tier: "tier3",
    prize: { id: "cat-1", name: "500 Airtime", valueNaira: 500 },
    prizeName: "500 Airtime",
    winningTicket: "t1",
    validTicketCount: 3,
    boostCount: 0,
    featuredOfferCount: 0,
    claimStatus: "unclaimed",
    fulfilmentStatus: "pending",
    selectedAt: DRAWN_AT,
    ...overrides,
  };
}

function createFakePayload({
  giveaway = {},
  winners = [],
  auditEvents = [],
  deliveries = [],
}: {
  giveaway?: Row | null;
  winners?: Row[];
  auditEvents?: Row[];
  deliveries?: Row[];
} = {}) {
  const doc: Row | null =
    giveaway === null
      ? null
      : {
          id: "g1",
          name: "Week 33",
          status: "completed",
          drawCompletedAt: DRAWN_AT,
          drawExecutionId: "exec-1",
          totalValidParticipants: 1200,
          ...giveaway,
        };

  const collections: Record<string, Row[]> = {
    "giveaway-winners": winners,
    "giveaway-audit-log": auditEvents,
    "giveaway-report-deliveries": deliveries,
  };

  const created: Record<string, Row[]> = {};

  const payload: any = {
    logger: { error: () => undefined, warn: () => undefined },
    /**
     * The retry sweep claims a delivery with a conditional UPDATE before
     * sending it, so a fake without this returns "claimed nothing" and the
     * sweep correctly does nothing at all.
     *
     * Modelled rather than stubbed away: the claim only hands the row to one
     * caller, which is the whole point of it, so this flips the row to
     * `pending` exactly as Postgres would and returns nothing when another
     * caller got there first.
     */
    db: {
      drizzle: {
        execute: async (query: unknown) => {
          const text = String(
            (query as { queryChunks?: unknown })?.queryChunks
              ? JSON.stringify((query as Row).queryChunks)
              : query
          );

          if (!text.includes("giveaway_report_deliveries")) {
            return { rows: [] };
          }

          const claimable = (
            collections["giveaway-report-deliveries"] ?? []
          ).filter((row) => row.status === "failed");

          for (const row of claimable) {
            row.status = "pending";
          }

          return { rows: claimable.map((row) => ({ id: row.id })) };
        },
      },
    },
    findByID: async ({ collection, id }: Row) => {
      if (collection === "giveaways") {
        return doc && doc.id === id ? doc : null;
      }
      return collections[collection]?.find((row) => row.id === id) ?? null;
    },
    find: async ({ collection, where }: Row) => {
      const docs = (collections[collection] ?? []).filter((row) =>
        matchesWhere(row, where)
      );
      return { docs, totalDocs: docs.length };
    },
    create: async ({ collection, data }: Row) => {
      const row = {
        id: `${collection}-${(created[collection]?.length ?? 0) + 1}`,
        ...data,
      };
      created[collection] = [...(created[collection] ?? []), row];
      collections[collection] = [...(collections[collection] ?? []), row];
      return row;
    },
    update: async ({ collection, id, data }: Row) => {
      if (collection === "giveaways") {
        Object.assign(doc ?? {}, data);
        return doc;
      }
      const row = collections[collection]?.find((item) => item.id === id);
      if (row) {
        Object.assign(row, data);
      }
      return row ?? { id, ...data };
    },
  };

  return { payload, doc, created, collections };
}

function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) {
    return true;
  }
  if (Array.isArray(where.and)) {
    return where.and.every((clause: Row) => matchesWhere(row, clause));
  }
  return Object.entries(where).every(([field, condition]) => {
    const clause = condition as Row;
    const actual = row[field];
    const key =
      actual && typeof actual === "object" && "id" in actual
        ? actual.id
        : actual;
    if (clause?.equals !== undefined) {
      return String(key) === String(clause.equals);
    }
    return true;
  });
}

/** A sender that records what it was asked to send. */
function recordingSender() {
  const sent: ReportMessage[] = [];
  return {
    sent,
    send: async (message: ReportMessage) => {
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

describe("buildWinnerReport (spec 21)", () => {
  it("counts winners by tier and excludes disqualified ones from the total", async () => {
    const { payload } = createFakePayload({
      winners: [
        winnerRow({ id: "w1", tier: "tier1" }),
        winnerRow({ id: "w2", tier: "tier2" }),
        winnerRow({ id: "w3", tier: "tier3" }),
        winnerRow({
          id: "w4",
          tier: "tier3",
          claimStatus: "disqualified",
          disqualifiedAt: DRAWN_AT,
          disqualificationReason: "Ticket refunded",
        }),
        winnerRow({ id: "w5", tier: "tier3", replaces: "w4" }),
      ],
    });

    const report = await buildWinnerReport(payload, "g1");

    // A disqualified winner is not a winner, but their replacement is.
    expect(report.totalWinners).toBe(4);
    expect(report.tierCounts).toEqual({ tier1: 1, tier2: 1, tier3: 2 });
    // All five still appear in the list, so the record stays complete.
    expect(report.rows).toHaveLength(5);
    expect(report.antiAbuse.disqualified).toBe(1);
    expect(report.antiAbuse.replacements).toBe(1);
  });

  it("summarises the anti-abuse activity from the audit log", async () => {
    const { payload } = createFakePayload({
      winners: [
        winnerRow({ id: "w1", fulfilmentStatus: "on_hold" }),
        winnerRow({ id: "w2" }),
      ],
      auditEvents: [
        { id: "a1", giveaway: "g1", eventType: "account_excluded", detail: {} },
        { id: "a2", giveaway: "g1", eventType: "account_excluded", detail: {} },
        {
          id: "a3",
          giveaway: "g1",
          eventType: "fairness_exclusion",
          detail: { rule: "22.2", count: 7 },
        },
        {
          id: "a4",
          giveaway: "g1",
          eventType: "fairness_exclusion",
          detail: { rule: "22.2", count: 3 },
        },
        {
          id: "a5",
          giveaway: "g1",
          eventType: "fairness_exclusion",
          detail: { rule: "22.1", count: 2 },
        },
        {
          id: "a6",
          giveaway: "g1",
          eventType: "loyalty_waiver_applied",
          detail: { count: 4 },
        },
      ],
    });

    const report = await buildWinnerReport(payload, "g1");

    expect(report.antiAbuse.heldForReview).toBe(1);
    expect(report.antiAbuse.accountsExcluded).toBe(2);
    expect(report.antiAbuse.loyaltyWaivers).toBe(4);
    // Same rule across two events is one total, ordered by size.
    expect(report.antiAbuse.fairnessExclusions).toEqual([
      { rule: "22.2", count: 10 },
      { rule: "22.1", count: 2 },
    ]);
  });

  it("names the subject and attachment the way the spec requires", async () => {
    const { payload } = createFakePayload({
      giveaway: { name: "Week 33 / August" },
      winners: [winnerRow()],
    });

    const report = await buildWinnerReport(payload, "g1");

    expect(winnerReportSubject(report)).toStartWith(
      "NewsSpend Winner Report – Week 33 / August – "
    );
    // The slash is not filename-safe, so the title is sanitised.
    expect(winnerReportFileName(report)).toBe(
      "NewsSpend_Winner_Report_Week_33_August_2026-08-13.csv"
    );
  });
});

describe("renderWinnerReportCsv (spec 21)", () => {
  it("includes the hold and fairness indicators for every winner", async () => {
    const { payload } = createFakePayload({
      winners: [
        winnerRow({
          id: "w1",
          fulfilmentStatus: "on_hold",
          reviewNote: "Account flagged as suspicious.",
        }),
        winnerRow({ id: "w2", replaces: "w0" }),
      ],
    });

    const csv = renderWinnerReportCsv(await buildWinnerReport(payload, "g1"));
    const [header, first, second] = csv.split("\r\n");

    expect(header).toContain("Held For Review");
    expect(header).toContain("Replaces Winner");
    expect(first).toContain("Yes");
    expect(first).toContain("Account flagged as suspicious.");
    expect(second).toContain("w0");
  });

  it("quotes cells containing commas and doubles inner quotes", async () => {
    const { payload } = createFakePayload({
      winners: [
        winnerRow({
          prizeName: 'Phone, 128GB "Pro"',
        }),
      ],
    });

    const csv = renderWinnerReportCsv(await buildWinnerReport(payload, "g1"));

    expect(csv).toContain('"Phone, 128GB ""Pro"""');
  });

  it("defuses a username a spreadsheet would run as a formula", async () => {
    const { payload } = createFakePayload({
      winners: [
        winnerRow({
          user: {
            id: "u1",
            username: '=HYPERLINK("http://evil.test","claim")',
            email: "a@b.test",
            phone: "",
          },
        }),
      ],
    });

    const csv = renderWinnerReportCsv(await buildWinnerReport(payload, "g1"));

    // Usernames are user-supplied and Excel executes a leading `=` on open.
    expect(csv).toContain("'=HYPERLINK");
  });

  it("emits a header row even when nobody won", async () => {
    const { payload } = createFakePayload({ winners: [] });

    const csv = renderWinnerReportCsv(await buildWinnerReport(payload, "g1"));

    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv).toStartWith("Winner ID,User ID,Username");
  });
});

describe("renderWinnerReportHtml (spec 21)", () => {
  it("carries every figure the body must contain", async () => {
    const { payload } = createFakePayload({
      winners: [winnerRow({ tier: "tier1" })],
    });

    const html = renderWinnerReportHtml(await buildWinnerReport(payload, "g1"));

    for (const label of [
      "Draw ID",
      "Date / Time",
      "Total Valid Participants",
      "Total Winners",
      "Tier 1 Winners",
      "Tier 2 Winners",
      "Tier 3 Winners",
      "Draw Status",
      "Anti-Abuse &amp; Manual Review Summary",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("escapes a draw title containing markup", async () => {
    const { payload } = createFakePayload({
      giveaway: { name: "<script>alert(1)</script>" },
      winners: [],
    });

    const html = renderWinnerReportHtml(await buildWinnerReport(payload, "g1"));

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("sendWinnerReport (spec 21 sending rules)", () => {
  it("sends the report and records the delivery", async () => {
    const { payload, doc, created } = createFakePayload({
      winners: [winnerRow()],
    });
    const sender = recordingSender();

    const result = await sendWinnerReport(payload, "g1", {
      send: sender.send,
    });

    expect(result.sent).toBe(true);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe("rewards@newsspend.com");
    expect(sender.sent[0]?.attachment.filename).toContain(
      "NewsSpend_Winner_Report_"
    );

    const delivery = created["giveaway-report-deliveries"]?.[0];
    expect(delivery).toMatchObject({
      kind: "original",
      status: "sent",
      attempts: 1,
      providerMessageId: "msg-1",
    });
    expect(doc?.winnerReportSentAt).toBeTruthy();

    const events = (created["giveaway-audit-log"] ?? []).map(
      (e) => e.eventType
    );
    expect(events).toContain("winner_report_sent");
  });

  it("refuses to send before the draw has completed", async () => {
    const { payload, created } = createFakePayload({
      giveaway: { status: "draw_in_progress" },
      winners: [winnerRow()],
    });
    const sender = recordingSender();

    const result = await sendWinnerReport(payload, "g1", {
      send: sender.send,
    });

    expect(result.sent).toBe(false);
    expect(sender.sent).toHaveLength(0);
    expect(created["giveaway-report-deliveries"]).toBeUndefined();
  });

  it("sends only one original per draw", async () => {
    const { payload, created } = createFakePayload({ winners: [winnerRow()] });
    const sender = recordingSender();

    await sendWinnerReport(payload, "g1", { send: sender.send });
    const second = await sendWinnerReport(payload, "g1", { send: sender.send });

    expect(second).toMatchObject({ sent: true, alreadySent: true });
    expect(sender.sent).toHaveLength(1);
    expect(created["giveaway-report-deliveries"]).toHaveLength(1);
  });

  it("still allows an administrator to resend", async () => {
    const { payload, created } = createFakePayload({ winners: [winnerRow()] });
    const sender = recordingSender();

    await sendWinnerReport(payload, "g1", { send: sender.send });
    const resend = await sendWinnerReport(payload, "g1", {
      kind: "resend",
      requestedBy: "admin@newsspend.com",
      send: sender.send,
    });

    expect(resend.sent).toBe(true);
    expect(sender.sent).toHaveLength(2);

    const deliveries = created["giveaway-report-deliveries"] ?? [];
    expect(deliveries).toHaveLength(2);
    expect(deliveries[1]).toMatchObject({
      kind: "resend",
      requestedBy: "admin@newsspend.com",
    });
  });

  it("retries within one call before giving up", async () => {
    const { payload, created } = createFakePayload({ winners: [winnerRow()] });
    let calls = 0;

    const result = await sendWinnerReport(payload, "g1", {
      send: async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error("provider unavailable");
        }
        return { id: "msg-late" };
      },
    });

    expect(result.sent).toBe(true);
    expect(calls).toBe(3);
    expect(created["giveaway-report-deliveries"]?.[0]).toMatchObject({
      status: "sent",
      attempts: 3,
    });
  });

  it("records a failure without throwing, so the draw is untouched", async () => {
    const { payload, doc, created } = createFakePayload({
      winners: [winnerRow()],
    });

    const result = await sendWinnerReport(payload, "g1", {
      maxAttempts: 2,
      send: async () => {
        throw new Error("provider unavailable");
      },
    });

    expect(result.sent).toBe(false);
    expect(created["giveaway-report-deliveries"]?.[0]).toMatchObject({
      status: "failed",
      attempts: 2,
      error: "provider unavailable",
    });
    // The draw itself is left alone: a mail failure never invalidates it.
    expect(doc?.status).toBe("completed");
    expect(doc?.winnerReportSentAt).toBeUndefined();
  });

  it("retries a failed original on its own row rather than making a second", async () => {
    const { payload, created } = createFakePayload({ winners: [winnerRow()] });

    await sendWinnerReport(payload, "g1", {
      maxAttempts: 1,
      send: async () => {
        throw new Error("provider unavailable");
      },
    });

    const sender = recordingSender();
    const retry = await sendWinnerReport(payload, "g1", { send: sender.send });

    expect(retry.sent).toBe(true);
    // One original, ever: its attempt count simply carries on.
    expect(created["giveaway-report-deliveries"]).toHaveLength(1);
    expect(created["giveaway-report-deliveries"]?.[0]).toMatchObject({
      kind: "original",
      status: "sent",
      attempts: 2,
    });
  });
});

describe("retryFailedWinnerReports (spec 21)", () => {
  it("picks up failed deliveries and sends them", async () => {
    const { payload, created } = createFakePayload({ winners: [winnerRow()] });

    await sendWinnerReport(payload, "g1", {
      maxAttempts: 1,
      send: async () => {
        throw new Error("provider unavailable");
      },
    });

    const sender = recordingSender();
    const outcome = await retryFailedWinnerReports(payload, {
      send: sender.send,
    });

    expect(outcome).toEqual({ retried: 1, sent: 1 });
    expect(created["giveaway-report-deliveries"]?.[0]?.status).toBe("sent");
  });

  it("does nothing when there is nothing to retry", async () => {
    const { payload } = createFakePayload({ winners: [winnerRow()] });
    const sender = recordingSender();

    const outcome = await retryFailedWinnerReports(payload, {
      send: sender.send,
    });

    expect(outcome).toEqual({ retried: 0, sent: 0 });
    expect(sender.sent).toHaveLength(0);
  });
});
