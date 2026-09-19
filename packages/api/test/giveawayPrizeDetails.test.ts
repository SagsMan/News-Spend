import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { giveawayRouter } from "../src/router/giveaway";
import { mockContext } from "../src/test-utils";

type Row = Record<string, any>;

const user = { id: "u1", isAnonymous: false, username: "tester" };

const DAY = 86_400_000;

const GIVEAWAY = {
  id: "g1",
  name: "Week 33",
  endDate: new Date(Date.now() - 2 * DAY).toISOString(),
  drawCompletedAt: new Date(Date.now() - DAY).toISOString(),
  startDate: new Date(Date.now() - 9 * DAY).toISOString(),
};

function winnerRow(overrides: Row = {}): Row {
  return {
    id: "w1",
    user: "u1",
    giveaway: GIVEAWAY,
    tier: "tier3",
    prizeName: "₦500 Airtime",
    claimStatus: "claimed",
    fulfilmentStatus: "fulfilled",
    selectedAt: new Date(Date.now() - DAY).toISOString(),
    claimedAt: new Date(Date.now() - DAY / 2).toISOString(),
    fulfilledAt: new Date(Date.now() - DAY / 3).toISOString(),
    claimPhone: "08162617119",
    prize: {
      id: "p1",
      fulfilmentType: "airtime",
      description: "Sent to your phone",
      requiresVerification: false,
    },
    ...overrides,
  };
}

const ATTEMPT = {
  id: "a1",
  outcome: "sent",
  operatorName: "MTN Nigeria",
  localAmount: 500,
  recipientPhone: "08162617119",
  providerTransactionId: "177879",
  attemptedAt: new Date(Date.now() - DAY / 3).toISOString(),
  error: null,
};

function createContext({
  winner = winnerRow(),
  attempts = [ATTEMPT],
}: Partial<{ winner: Row | null; attempts: Row[] }> = {}) {
  const payload: Row = {
    logger: { error: () => undefined, warn: () => undefined },
    findByID: async ({ collection }: Row) =>
      collection === "giveaway-winners" ? winner : null,
    find: async ({ collection }: Row) => {
      if (collection === "giveaway-fulfilment-attempts") {
        return { docs: attempts, totalDocs: attempts.length };
      }
      if (collection === "giveaways") {
        return { docs: [GIVEAWAY], totalDocs: 1 };
      }
      return { docs: [], totalDocs: 0 };
    },
  };

  return mockContext({ user: user as never, payload });
}

const detailsOf = (ctx: unknown) =>
  call(
    giveawayRouter.prizeDetails,
    { winnerId: "w1" },
    { context: ctx as never }
  );

describe("giveaway.prizeDetails", () => {
  it("names the giveaway that produced the prize", async () => {
    const result: any = await detailsOf(createContext());

    expect(result.giveawayName).toBe("Week 33");
    expect(result.drawnAt).toBe(GIVEAWAY.drawCompletedAt);
    expect(result.prizeName).toBe("₦500 Airtime");
  });

  it("shows where an airtime prize was actually sent", async () => {
    // The reason this endpoint exists: a top-up that went to a mistyped number
    // is otherwise impossible for the winner to diagnose.
    const result: any = await detailsOf(createContext());

    expect(result.dispatch).toMatchObject({
      outcome: "sent",
      network: "MTN Nigeria",
      amount: 500,
      sentTo: "08162617119",
      reference: "177879",
    });
  });

  it("surfaces the provider's own words when a dispatch failed", async () => {
    const result: any = await detailsOf(
      createContext({
        attempts: [
          { ...ATTEMPT, outcome: "failed", error: "Operator unreachable" },
        ],
      })
    );

    expect(result.dispatch.outcome).toBe("failed");
    expect(result.dispatch.error).toBe("Operator unreachable");
  });

  it("has no dispatch record for a prize that never leaves the platform", async () => {
    // Points are credited in-app, so there is no provider and nothing to show.
    const result: any = await detailsOf(
      createContext({
        winner: winnerRow({
          prizeName: "500 Dream Points",
          prize: { id: "p2", fulfilmentType: "points", pointsAmount: 500 },
        }),
        attempts: [],
      })
    );

    expect(result.dispatch).toBe(null);
    expect(result.pointsAmount).toBe(500);
  });

  it("returns a physical prize's delivery details", async () => {
    const result: any = await detailsOf(
      createContext({
        winner: winnerRow({
          prizeName: "Smart TV",
          prize: { id: "p3", fulfilmentType: "physical" },
          claimRecipientName: "Ada Obi",
          claimAddress: "12 Marina, Lagos",
          claimPhone: null,
        }),
        attempts: [],
      })
    );

    expect(result.recipientName).toBe("Ada Obi");
    expect(result.shippingAddress).toBe("12 Marina, Lagos");
    expect(result.dispatch).toBe(null);
  });

  it("explains a payout being held", async () => {
    // 22.7/22.8: the win stands, the payout waits. Saying so is the
    // difference between a delay and an apparent loss.
    const result: any = await detailsOf(
      createContext({
        winner: winnerRow({
          fulfilmentStatus: "on_hold",
          reviewNote: "Account flagged as suspicious.",
        }),
      })
    );

    expect(result.underReview).toBe(true);
    expect(result.reviewNote).toBe("Account flagged as suspicious.");
  });

  it("never reveals someone else's prize", async () => {
    const ctx = createContext({ winner: winnerRow({ user: "someone-else" }) });

    await expect(detailsOf(ctx)).rejects.toThrow(/could not be found/);
  });

  it("reports a missing prize the same way", async () => {
    // Identical message, so the response cannot be used to probe which ids
    // exist.
    const ctx = createContext({ winner: null });

    await expect(detailsOf(ctx)).rejects.toThrow(/could not be found/);
  });
});
