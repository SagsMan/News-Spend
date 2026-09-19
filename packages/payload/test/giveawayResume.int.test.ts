import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { BasePayload } from "payload";

import { GiveawayEngine } from "../src/lib/giveaway/GiveawayEngine";
import { getTestPayload, resetGiveawayTables } from "./helpers/testPayload";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let payload: BasePayload;

const noopReportSender = async () => ({ id: null });

const engine = (p: BasePayload = payload) =>
  new GiveawayEngine(p, { reportSender: noopReportSender });

beforeAll(async () => {
  payload = await getTestPayload();
}, 180_000);

beforeEach(async () => {
  await resetGiveawayTables(payload);
});

let seq = 0;

async function createUser(): Promise<string> {
  seq += 1;
  const doc = await payload.create({
    collection: "users",
    data: {
      name: `Resume Participant ${seq}`,
      username: `resume_${Date.now()}_${seq}`,
      email: `resume_${Date.now()}_${seq}@example.invalid`,
      wish: "A resumable draw",
      phone: `081000000${seq.toString().padStart(2, "0")}`,
    },
  });
  return String(doc.id);
}

async function createDrawableGiveaway(participants: number, maxUnits: number) {
  const prize = await payload.create({
    collection: "prize-catalogue",
    data: {
      name: `Resume prize ${Date.now()}`,
      tier: "tier3",
      fulfilmentType: "points",
      pointsAmount: 500,
      active: true,
    },
  });

  const giveaway = await payload.create({
    collection: "giveaways",
    data: {
      name: `Resume draw ${Date.now()}`,
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
      maxUnits,
    },
  });

  for (let i = 0; i < participants; i += 1) {
    await payload.create({
      collection: "giveaway-tickets",
      data: {
        giveaway: giveaway.id,
        user: await createUser(),
        quantity: 1,
        unitPrice: 50,
        purchasedAt: new Date(Date.now() - DAY).toISOString(),
        status: "valid",
      },
    });
  }

  return String(giveaway.id);
}

/**
 * A payload that fails the Nth winner it is asked to record.
 *
 * Interrupting for real, rather than writing `status: "interrupted"` into the
 * database by hand, because the point of the test is that the engine reaches that
 * state on its own and can be continued from it. A failing report sender would
 * not do: `sendWinnerReport` deliberately never throws, so a report failure
 * cannot stop a draw.
 */
function payloadFailingOnWinner(
  base: BasePayload,
  failOnNth: number
): BasePayload {
  let winners = 0;

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop !== "create") {
        return Reflect.get(target, prop, receiver);
      }

      return async (args: { collection: string }) => {
        if (args.collection === "giveaway-winners") {
          winners += 1;
          if (winners === failOnNth) {
            throw new Error("simulated database failure mid-draw");
          }
        }
        return (target.create as (a: unknown) => Promise<unknown>)(args);
      };
    },
  }) as BasePayload;
}

describe("interrupted draw, resumed (19)", () => {
  test("records who authorized the resumption", async () => {
    const giveawayId = await createDrawableGiveaway(2, 2);

    await expect(
      engine(payloadFailingOnWinner(payload, 2)).runDraw(giveawayId)
    ).rejects.toThrow();

    const interrupted = await payload.findByID({
      collection: "giveaways",
      id: giveawayId,
      depth: 0,
    });
    expect(interrupted.status).toBe("interrupted");

    const result = await engine().authorizeResumption(giveawayId, {
      authorizedBy: "super@newsspend.com",
      note: "checked the logs",
    });
    expect(result.authorized).toBe(true);

    /**
     * The gap this endpoint was built to close. Reaching
     * `resumption_authorized` by editing the status select produces the same
     * state with all three of these empty, which leaves section 19 unable to answer
     * who allowed the prizes to be awarded.
     */
    const authorized = await payload.findByID({
      collection: "giveaways",
      id: giveawayId,
      depth: 0,
    });
    expect(authorized.status).toBe("resumption_authorized");
    expect(authorized.resumptionAuthorizedBy).toBe("super@newsspend.com");
    expect(authorized.resumptionAuthorizedAt).toBeTruthy();

    const audit = await payload.find({
      collection: "giveaway-audit-log",
      where: {
        and: [
          { giveaway: { equals: giveawayId } },
          { eventType: { equals: "resumption_authorized" } },
        ],
      },
      pagination: false,
      depth: 0,
    });
    expect(audit.docs).toHaveLength(1);
  }, 120_000);

  test("resumes on the original seed without re-awarding what it already gave", async () => {
    const giveawayId = await createDrawableGiveaway(2, 2);

    await expect(
      engine(payloadFailingOnWinner(payload, 2)).runDraw(giveawayId)
    ).rejects.toThrow();

    const afterFailure = await payload.find({
      collection: "giveaway-winners",
      where: { giveaway: { equals: giveawayId } },
      pagination: false,
      depth: 0,
    });
    // The first winner was recorded before the failure and must survive it.
    expect(afterFailure.docs).toHaveLength(1);
    const firstWinnerId = String(afterFailure.docs[0].id);

    const before = await payload.findByID({
      collection: "giveaways",
      id: giveawayId,
      depth: 0,
    });

    await engine().authorizeResumption(giveawayId, {
      authorizedBy: "super@newsspend.com",
    });
    const result = await engine().runDraw(giveawayId, { resume: true });

    // Same seed, or the tiers still to run would produce different winners
    // and the audit trail would not add up.
    expect(result.seed).toBe(before.drawSeed as string);
    expect(result.executionId).toBe(before.drawExecutionId as string);

    const completed = await payload.findByID({
      collection: "giveaways",
      id: giveawayId,
      depth: 0,
    });
    expect(completed.status).toBe("completed");

    const winners = await payload.find({
      collection: "giveaway-winners",
      where: { giveaway: { equals: giveawayId } },
      pagination: false,
      depth: 0,
    });
    expect(winners.docs).toHaveLength(2);
    // The pre-existing winner was kept, not replaced by a re-draw.
    expect(winners.docs.map((w) => String(w.id))).toContain(firstWinnerId);

    const attempts = await payload.find({
      collection: "giveaway-draw-attempts",
      where: { giveaway: { equals: giveawayId } },
      sort: "attemptNumber",
      pagination: false,
      depth: 0,
    });
    expect(attempts.docs).toHaveLength(2);
    expect(attempts.docs[0].outcome).toBe("interrupted");
    expect(attempts.docs[1].kind).toBe("resumption");
    expect(attempts.docs[1].outcome).toBe("completed");
    expect(attempts.docs[1].authorizedBy).toBe("super@newsspend.com");
  }, 120_000);

  test("refuses to restart an interrupted draw instead of resuming it", async () => {
    const giveawayId = await createDrawableGiveaway(2, 2);

    await expect(
      engine(payloadFailingOnWinner(payload, 2)).runDraw(giveawayId)
    ).rejects.toThrow();

    // Without `resume`, this is a restart, which would re-draw the tier and
    // award the prize a second time.
    await expect(engine().runDraw(giveawayId)).rejects.toThrow(
      /stopped part-way through/
    );
  }, 120_000);

  test("refuses to resume a draw nobody authorized", async () => {
    const giveawayId = await createDrawableGiveaway(2, 2);

    await expect(
      engine(payloadFailingOnWinner(payload, 2)).runDraw(giveawayId)
    ).rejects.toThrow();

    await expect(
      engine().runDraw(giveawayId, { resume: true })
    ).rejects.toThrow(/authorized/);
  }, 120_000);
});
