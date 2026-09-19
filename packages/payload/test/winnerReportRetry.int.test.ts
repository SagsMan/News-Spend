import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { BasePayload } from "payload";

import { GiveawayEngine } from "../src/lib/giveaway/GiveawayEngine";
import { retryFailedWinnerReports } from "../src/lib/giveaway/sendWinnerReport";
import { getTestPayload, resetGiveawayTables } from "./helpers/testPayload";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let payload: BasePayload;

beforeAll(async () => {
  payload = await getTestPayload();
}, 180_000);

beforeEach(async () => {
  await resetGiveawayTables(payload);
});

let seq = 0;

/**
 * Draw a giveaway whose Winner Report send fails, leaving a delivery row in
 * `failed` for the retry sweep to find.
 */
async function drawWithFailingReport(): Promise<void> {
  seq += 1;

  const prize = await payload.create({
    collection: "prize-catalogue",
    data: {
      name: `Retry prize ${Date.now()}_${seq}`,
      tier: "tier3",
      fulfilmentType: "points",
      pointsAmount: 500,
      active: true,
    },
  });

  const giveaway = await payload.create({
    collection: "giveaways",
    data: {
      name: `Retry draw ${Date.now()}_${seq}`,
      status: "active",
      startDate: new Date(Date.now() - 8 * DAY).toISOString(),
      endDate: new Date(Date.now() - HOUR).toISOString(),
      ticketPrice: 50,
      minTicketsRequired: 1,
      tier1WinnerPercentage: 0,
      tier2WinnerPercentage: 0,
      tier3WinnerPercentage: 100,
      budgetUtilizationPct: 100,
    },
  });

  await payload.create({
    collection: "giveaway-prizes",
    data: {
      giveaway: giveaway.id,
      prize: prize.id,
      tier: "tier3",
      maxUnits: 1,
    },
  });

  const user = await payload.create({
    collection: "users",
    data: {
      name: `Retry Participant ${seq}`,
      username: `retry_${Date.now()}_${seq}`,
      email: `retry_${Date.now()}_${seq}@example.invalid`,
      wish: "A report that sends once",
      phone: `082000000${seq.toString().padStart(2, "0")}`,
    },
  });

  await payload.create({
    collection: "giveaway-tickets",
    data: {
      giveaway: giveaway.id,
      user: user.id,
      quantity: 1,
      unitPrice: 50,
      purchasedAt: new Date(Date.now() - DAY).toISOString(),
      status: "valid",
    },
  });

  await new GiveawayEngine(payload, {
    reportSender: async () => {
      throw new Error("simulated mail provider rejection");
    },
  }).runDraw(String(giveaway.id));
}

describe("winner report retry", () => {
  test("concurrent sweeps send a failed report exactly once", async () => {
    await drawWithFailingReport();

    const failed = await payload.find({
      collection: "giveaway-report-deliveries",
      where: { status: { equals: "failed" } },
      pagination: false,
      depth: 0,
    });
    expect(failed.docs).toHaveLength(1);

    /**
     * Four sweeps at once, which is what staging actually did: `autoRun`
     * lives in the shared config so the CMS and the API server each sweep,
     * and a rolling deploy briefly doubles that. Before the claim, every one
     * of them sent the same report (winners' names, emails and phone
     * numbers), four times over.
     */
    let sends = 0;
    const send = async () => {
      sends += 1;
      return { id: `msg-${sends}` };
    };

    const sweeps = await Promise.all([
      retryFailedWinnerReports(payload, { send }),
      retryFailedWinnerReports(payload, { send }),
      retryFailedWinnerReports(payload, { send }),
      retryFailedWinnerReports(payload, { send }),
    ]);

    expect(sends).toBe(1);

    // Exactly one sweep claimed it; the rest correctly found nothing to do.
    expect(sweeps.reduce((n, s) => n + s.retried, 0)).toBe(1);
    expect(sweeps.reduce((n, s) => n + s.sent, 0)).toBe(1);

    const after = await payload.find({
      collection: "giveaway-report-deliveries",
      pagination: false,
      depth: 0,
    });
    expect(after.docs).toHaveLength(1);
    expect(after.docs[0].status).toBe("sent");
  }, 120_000);

  test("a delivery that fails again is left retryable", async () => {
    await drawWithFailingReport();

    const result = await retryFailedWinnerReports(payload, {
      send: async () => {
        throw new Error("still rejected");
      },
    });

    expect(result.retried).toBe(1);
    expect(result.sent).toBe(0);

    // Back to `failed`, not stranded in the claimed state, because otherwise one bad
    // send would silently retire the report for good.
    const after = await payload.find({
      collection: "giveaway-report-deliveries",
      pagination: false,
      depth: 0,
    });
    expect(after.docs[0].status).toBe("failed");
  }, 120_000);
});
