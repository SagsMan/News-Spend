import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { BasePayload } from "payload";

import { GiveawayEngine } from "../src/lib/giveaway/GiveawayEngine";
import { getTestPayload, resetGiveawayTables } from "./helpers/testPayload";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let payload: BasePayload;

const engine = () =>
  new GiveawayEngine(payload, { reportSender: async () => ({ id: null }) });

beforeAll(async () => {
  payload = await getTestPayload();
}, 180_000);

beforeEach(async () => {
  await resetGiveawayTables(payload);
});

let seq = 0;

/**
 * Tier 1 as section 11 defines it: ten tickets, three Boosts and one Featured Offer.
 *
 * Every one of these had to be fixed before a Tier 1 winner could exist at
 * all, one Boost item where three distinct ones are needed, an app wall that
 * never recorded a click, and webhook partners that could not be created. None
 * of them announced itself, because a tier nobody reaches looks exactly like a
 * tier nobody happened to qualify for that round. This is the test that tells
 * the difference.
 */
const TIER1 = { tickets: 10, boosts: 3, featuredOffers: 1 };

async function createUser(): Promise<string> {
  seq += 1;
  const doc = await payload.create({
    collection: "users",
    data: {
      name: `Tier1 Participant ${seq}`,
      username: `tier1_${Date.now()}_${seq}`,
      email: `tier1_${Date.now()}_${seq}@example.invalid`,
      wish: "A reachable top tier",
      phone: `083000000${seq.toString().padStart(2, "0")}`,
    },
  });
  return String(doc.id);
}

async function setUp({
  tickets = TIER1.tickets,
  boosts = TIER1.boosts,
  featuredOffers = TIER1.featuredOffers,
}: Partial<{ tickets: number; boosts: number; featuredOffers: number }> = {}) {
  const prize = await payload.create({
    collection: "prize-catalogue",
    data: {
      name: `Tier 1 prize ${Date.now()}_${seq}`,
      tier: "tier1",
      fulfilmentType: "points",
      pointsAmount: 5000,
      active: true,
    },
  });

  const giveaway = await payload.create({
    collection: "giveaways",
    data: {
      name: `Tier 1 draw ${Date.now()}_${seq}`,
      status: "active",
      startDate: new Date(Date.now() - 8 * DAY).toISOString(),
      endDate: new Date(Date.now() - HOUR).toISOString(),
      ticketPrice: 50,
      minTicketsRequired: 1,
      // Tier 1 alone: with a lower tier enabled the draw could award that
      // instead and the test would pass without proving anything.
      tier1WinnerPercentage: 100,
      tier2WinnerPercentage: 0,
      tier3WinnerPercentage: 0,
      budgetUtilizationPct: 100,
    },
  });

  await payload.create({
    collection: "giveaway-prizes",
    data: {
      giveaway: giveaway.id,
      prize: prize.id,
      tier: "tier1",
      maxUnits: 1,
    },
  });

  const userId = await createUser();

  // Section 6 aggregates by quantity, so one purchase of ten counts as ten.
  await payload.create({
    collection: "giveaway-tickets",
    data: {
      giveaway: giveaway.id,
      user: userId,
      quantity: tickets,
      unitPrice: 50,
      purchasedAt: new Date(Date.now() - DAY).toISOString(),
      status: "valid",
    },
  });

  for (let i = 0; i < boosts; i += 1) {
    await payload.create({
      collection: "giveaway-engagements",
      data: {
        giveaway: giveaway.id,
        user: userId,
        type: "boost",
        completionStatus: "completed",
        completedAt: new Date().toISOString(),
      },
    });
  }

  for (let i = 0; i < featuredOffers; i += 1) {
    await payload.create({
      collection: "giveaway-engagements",
      data: {
        giveaway: giveaway.id,
        user: userId,
        type: "featured_offer",
        completionStatus: "completed",
        completedAt: new Date().toISOString(),
      },
    });
  }

  return { giveawayId: String(giveaway.id), userId };
}

async function winnersOf(giveawayId: string) {
  const found = await payload.find({
    collection: "giveaway-winners",
    where: { giveaway: { equals: giveawayId } },
    pagination: false,
    depth: 0,
  });
  return found.docs;
}

describe("Tier 1 eligibility (11)", () => {
  test("awards the top tier when all three requirements are met", async () => {
    const { giveawayId, userId } = await setUp();

    const result = await engine().runDraw(giveawayId);

    expect(result.totalWinners).toBe(1);

    const winners = await winnersOf(giveawayId);
    expect(winners).toHaveLength(1);
    expect(winners[0].tier).toBe("tier1");
    expect(String(winners[0].user)).toBe(userId);

    /**
     * The winner row carries the eligibility that qualified them, so a draw
     * can be defended afterwards without recomputing it from records that
     * may since have changed.
     */
    expect(winners[0].validTicketCount).toBe(TIER1.tickets);
    expect(winners[0].boostCount).toBe(TIER1.boosts);
    expect(winners[0].featuredOfferCount).toBe(TIER1.featuredOffers);
  }, 120_000);

  test("refuses the top tier one ticket short", async () => {
    const { giveawayId } = await setUp({ tickets: TIER1.tickets - 1 });

    const result = await engine().runDraw(giveawayId);

    expect(result.totalWinners).toBe(0);
    expect(await winnersOf(giveawayId)).toHaveLength(0);
  }, 120_000);

  test("refuses the top tier one boost short", async () => {
    // The failure that hid for weeks: only one Boost item existed, so nobody
    // could reach three however hard they tried.
    const { giveawayId } = await setUp({ boosts: TIER1.boosts - 1 });

    const result = await engine().runDraw(giveawayId);

    expect(result.totalWinners).toBe(0);
    expect(await winnersOf(giveawayId)).toHaveLength(0);
  }, 120_000);

  test("refuses the top tier with no Featured Offer", async () => {
    // The app wall never recorded a click, so this was everybody's state.
    const { giveawayId } = await setUp({ featuredOffers: 0 });

    const result = await engine().runDraw(giveawayId);

    expect(result.totalWinners).toBe(0);
    expect(await winnersOf(giveawayId)).toHaveLength(0);
  }, 120_000);

  test("a draw that awards nothing still completes cleanly", async () => {
    // No winners is a legitimate outcome, not a failure; it must not leave
    // the giveaway interrupted, which is what an administrator would have to
    // untangle by hand.
    const { giveawayId } = await setUp({ boosts: 0, featuredOffers: 0 });

    await engine().runDraw(giveawayId);

    const giveaway = await payload.findByID({
      collection: "giveaways",
      id: giveawayId,
      depth: 0,
    });
    expect(giveaway.status).toBe("completed");
    expect(giveaway.drawError).toBeFalsy();
  }, 120_000);
});
