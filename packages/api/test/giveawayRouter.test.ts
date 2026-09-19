import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { giveawayRouter } from "../src/router/giveaway";
import { mockContext } from "../src/test-utils";

type Row = Record<string, any>;

const user = { id: "u1", isAnonymous: false, username: "tester" };

const HOUR = 3_600_000;

/** Comfortably over 18, so the age gate is not what a test is measuring. */
const ADULT_DOB = new Date(Date.now() - 30 * 365 * 24 * HOUR).toISOString();

function openGiveaway(overrides: Row = {}): Row {
  return {
    id: "g1",
    name: "Week 33",
    status: "active",
    startDate: new Date(Date.now() - HOUR).toISOString(),
    endDate: new Date(Date.now() + HOUR).toISOString(),
    ticketPrice: 50,
    minTicketsRequired: 1,
    ...overrides,
  };
}

/**
 * A Payload stand-in plus a points ledger, wired so that the drizzle calls the
 * purchase endpoint makes behave like the real ones: a balance that is the sum
 * of the ledger, and inserts that append to it.
 */
function createContext({
  giveaway = openGiveaway(),
  tickets = [],
  engagements = [],
  streaks = [],
  content = null,
  points = 10_000,
  dateOfBirth = ADULT_DOB,
  userId = user.id,
  priorGiveaways = [],
  priorWinners = [],
  priorTickets = [],
  onCreate,
}: {
  giveaway?: Row | null;
  tickets?: Row[];
  engagements?: Row[];
  streaks?: Row[];
  content?: Row | null;
  points?: number;
  /** null models an account that predates the date-of-birth field. */
  dateOfBirth?: string | null;
  /**
   * The rate limiter buckets per user, so a test making purchase calls needs
   * its own identity or it spends the budget of the tests around it.
   */
  userId?: string;
  /** Completed giveaways behind this one, for the 22 cooldown history. */
  priorGiveaways?: Row[];
  priorWinners?: Row[];
  priorTickets?: Row[];
  onCreate?: (collection: string) => void;
} = {}) {
  const ledger: number[] = points ? [points] : [];
  const created: Record<string, Row[]> = {};

  const collections: Record<string, Row[]> = {
    giveaways: [...(giveaway ? [giveaway] : []), ...priorGiveaways],
    "giveaway-tickets": [...tickets, ...priorTickets],
    "giveaway-engagements": engagements,
    "giveaway-streaks": streaks,
    "giveaway-winners": priorWinners,
  };

  const balance = () => ledger.reduce((sum, n) => sum + n, 0);

  const tx = {
    execute: async () => undefined,
    select: () => ({
      from: () => ({
        where: async () => [{ totalPoints: balance() }],
      }),
    }),
    insert: () => ({
      values: async (row: Row) => {
        ledger.push(row.point);
      },
    }),
  };

  const drizzle = {
    transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
    insert: () => ({
      values: (row: Row) => {
        ledger.push(row.point);
        return { catch: async () => undefined };
      },
    }),
  };

  const payload: Row = {
    logger: { error: () => undefined },
    db: { drizzle },
    find: async ({ collection, where }: Row) => {
      const docs = (collections[collection] ?? []).filter((row) =>
        matchesWhere(row, where)
      );
      return { docs, totalDocs: docs.length };
    },
    findByID: async ({ collection, id }: Row) => {
      if (collection === "partner-content") {
        return content && content.id === id ? content : null;
      }
      if (collection === "users") {
        return { id, dateOfBirth };
      }
      return collections[collection]?.find((row) => row.id === id) ?? null;
    },
    create: async ({ collection, data }: Row) => {
      onCreate?.(collection);
      const row = {
        id: `${collection}-${(created[collection]?.length ?? 0) + 1}`,
        ...data,
      };
      created[collection] = [...(created[collection] ?? []), row];
      collections[collection] = [...(collections[collection] ?? []), row];
      return row;
    },
  };

  return {
    ctx: mockContext({ user: { ...user, id: userId } as never, payload }),
    created,
    ledger,
    balance,
  };
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
    if (Array.isArray(clause?.in)) {
      return clause.in.some((v: unknown) => String(v) === String(key));
    }
    if (clause?.less_than !== undefined) {
      return String(key) < String(clause.less_than);
    }
    return true;
  });
}

function ticket(overrides: Row = {}): Row {
  return {
    id: "t1",
    giveaway: "g1",
    user: "u1",
    quantity: 1,
    status: "valid",
    ...overrides,
  };
}

function boostItem(overrides: Row = {}): Row {
  return {
    id: "pc1",
    placements: ["connect-brand-video"],
    ...overrides,
  };
}

/** Run a call that should fail and hand the error back to the test. */
async function captureError(
  promise: Promise<unknown>
): Promise<{ code: string; message: string }> {
  try {
    await promise;
  } catch (error) {
    return error as { code: string; message: string };
  }
  throw new Error("expected the call to throw, but it resolved");
}

describe("giveaway.current", () => {
  it("returns null when nothing is running", async () => {
    const { ctx } = createContext({ giveaway: null });
    expect(
      await call(giveawayRouter.current, undefined, { context: ctx })
    ).toBe(null);
  });

  it("exposes the ticket price and purchase minimum", async () => {
    const { ctx } = createContext({
      giveaway: openGiveaway({ ticketPrice: 75, minTicketsRequired: 5 }),
    });

    const result = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });

    expect(result).toMatchObject({ ticketPrice: 75, minTicketsRequired: 5 });
  });
});

describe("giveaway.buyTickets (spec 6)", () => {
  it("writes one row per purchase rather than upserting", async () => {
    const { ctx, created } = createContext({
      tickets: [ticket({ id: "t0", quantity: 3 })],
    });

    const result = await call(
      giveawayRouter.buyTickets,
      { quantity: 4 },
      { context: ctx }
    );

    // A second row, not an edit to the first: each purchase is its own
    // weighted entry in the draw.
    expect(created["giveaway-tickets"]).toHaveLength(1);
    expect(created["giveaway-tickets"]?.[0]).toMatchObject({
      quantity: 4,
      status: "valid",
      unitPrice: 50,
    });
    expect(result.validTickets).toBe(7);
  });

  it("charges quantity times price, not quantity", async () => {
    const { ctx, balance } = createContext({ points: 1000 });

    const result = await call(
      giveawayRouter.buyTickets,
      { quantity: 10 },
      { context: ctx }
    );

    expect(result.pointsSpent).toBe(500);
    expect(balance()).toBe(500);
  });

  it("refuses a purchase the user cannot afford", async () => {
    const { ctx, created } = createContext({ points: 100 });

    const error = await captureError(
      call(giveawayRouter.buyTickets, { quantity: 10 }, { context: ctx })
    );

    expect(error.code).toBe("BAD_REQUEST");

    expect(error.message).toMatch(/costs 500 points and you have 100/);
    expect(created["giveaway-tickets"]).toBeUndefined();
  });

  it("enforces the giveaway's minimum purchase", async () => {
    const { ctx } = createContext({
      giveaway: openGiveaway({ minTicketsRequired: 5 }),
    });

    const error = await captureError(
      call(giveawayRouter.buyTickets, { quantity: 2 }, { context: ctx })
    );

    expect(error.code).toBe("BAD_REQUEST");

    expect(error.message).toMatch(/minimum of 5 tickets/);
  });

  it("refunds the points when the ticket cannot be written", async () => {
    const { ctx, balance } = createContext({
      points: 1000,
      onCreate: (collection) => {
        if (collection === "giveaway-tickets") {
          throw new Error("database unavailable");
        }
      },
    });

    await expect(
      call(giveawayRouter.buyTickets, { quantity: 10 }, { context: ctx })
    ).rejects.toThrow(/database unavailable/);

    // Charged 500, refunded 500: the user is not left out of pocket for
    // tickets they never received.
    expect(balance()).toBe(1000);
  });

  it("refuses to sell once the countdown has ended", async () => {
    const { ctx } = createContext({
      giveaway: openGiveaway({
        endDate: new Date(Date.now() - HOUR).toISOString(),
      }),
    });

    const error = await captureError(
      call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx })
    );

    expect(error.code).toBe("CONFLICT");

    expect(error.message).toMatch(/waiting for its draw/);
  });

  it("refuses to sell when no giveaway is running", async () => {
    const { ctx } = createContext({ giveaway: null });

    const error = await captureError(
      call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx })
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("rejects a negative quantity at the input boundary", async () => {
    const { ctx } = createContext();

    await expect(
      call(giveawayRouter.buyTickets, { quantity: -10 }, { context: ctx })
    ).rejects.toThrow();
  });
});

/**
 * Skipped while `AGE_GATE_ENABLED` is false in the giveaway router.
 *
 * These describe the gate's behaviour when it is on, and they pass as written
 * the moment it is switched back on: un-skip in the same change that flips
 * the flag. The under-18 rule itself is unaffected and still covered directly
 * by participantEligibility.test.ts; only its enforcement at purchase is off.
 */
describe.skip("age gate on participation", () => {
  it("refuses a purchase from an account with no date of birth", async () => {
    const { ctx, created } = createContext({
      dateOfBirth: null,
      userId: "age-none",
    });

    const error = await captureError(
      call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx })
    );

    // FORBIDDEN, not BAD_REQUEST: nothing about the request is malformed,
    // the account simply may not do this.
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toMatch(/date of birth/);
    expect(created["giveaway-tickets"]).toBeUndefined();
  });

  it("refuses a purchase from someone under 18", async () => {
    const { ctx, created } = createContext({
      dateOfBirth: new Date(Date.now() - 16 * 365 * 24 * HOUR).toISOString(),
      userId: "age-under",
    });

    const error = await captureError(
      call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx })
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toMatch(/18 or older/);
    expect(created["giveaway-tickets"]).toBeUndefined();
  });

  it("allows someone who has since turned 18", async () => {
    // Signed up under age; the birthday has now passed. Recomputing from the
    // date of birth each time is what lets them in without any intervention.
    const { ctx, created } = createContext({
      dateOfBirth: new Date(
        Date.now() - 18 * 365.25 * 24 * HOUR - 24 * HOUR
      ).toISOString(),
      userId: "age-just-turned",
    });

    await call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx });

    expect(created["giveaway-tickets"]).toHaveLength(1);
  });

  it("reports the block on progress so the app can explain it up front", async () => {
    const { ctx } = createContext({
      dateOfBirth: null,
      userId: "age-progress-blocked",
    });

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    expect(result.canParticipate).toBe(false);
    expect(result.blockedReason).toBe("no_date_of_birth");
  });

  it("reports no block for an adult", async () => {
    const { ctx } = createContext();

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    expect(result.canParticipate).toBe(true);
    expect(result.blockedReason).toBe(null);
  });
});

describe("giveaway.recordEngagement (spec 7, 8)", () => {
  it("records a completed boost", async () => {
    const { ctx, created } = createContext({
      tickets: [ticket()],
      content: boostItem(),
    });

    const result = await call(
      giveawayRouter.recordEngagement,
      { type: "boost", contentId: "pc1" },
      { context: ctx }
    );

    expect(created["giveaway-engagements"]?.[0]).toMatchObject({
      type: "boost",
      completionStatus: "completed",
      content: "pc1",
    });
    expect(result.boosts).toBe(1);
  });

  it("refuses a boost from a user with no ticket", async () => {
    const { ctx, created } = createContext({
      tickets: [],
      content: boostItem(),
    });

    const error = await captureError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "pc1" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("FORBIDDEN");

    expect(error.message).toMatch(/Buy a ticket before/);
    expect(created["giveaway-engagements"]).toBeUndefined();
  });

  it("refuses to count a Lucky App Wall item as a boost", async () => {
    const { ctx } = createContext({
      tickets: [ticket()],
      content: boostItem({ placements: ["lucky-app-wall"] }),
    });

    const error = await captureError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "pc1" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("BAD_REQUEST");

    expect(error.message).toMatch(/does not count towards Boost Your Luck/);
  });

  it("accepts the same item as a Featured Offer", async () => {
    const { ctx, created } = createContext({
      tickets: [ticket()],
      content: boostItem({ placements: ["lucky-app-wall"] }),
    });

    await call(
      giveawayRouter.recordEngagement,
      { type: "featured_offer", contentId: "pc1" },
      { context: ctx }
    );

    expect(created["giveaway-engagements"]?.[0]).toMatchObject({
      type: "featured_offer",
    });
  });

  it("counts one partner item once, however many times it is replayed", async () => {
    const { ctx, created } = createContext({
      tickets: [ticket()],
      content: boostItem(),
    });

    await call(
      giveawayRouter.recordEngagement,
      { type: "boost", contentId: "pc1" },
      { context: ctx }
    );

    // Re-watching the same advertisement is not a second boost: otherwise
    // Tier 1's three-boost requirement falls to a single item.
    const error = await captureError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "pc1" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("CONFLICT");

    expect(error.message).toMatch(/already completed/);
    expect(created["giveaway-engagements"]).toHaveLength(1);
  });

  it("refuses an item that does not exist", async () => {
    const { ctx } = createContext({ tickets: [ticket()], content: null });

    const error = await captureError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "nope" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("giveaway.progress (spec 11)", () => {
  it("aggregates tickets by quantity, not by row", async () => {
    const { ctx } = createContext({
      tickets: [
        ticket({ id: "t1", quantity: 5 }),
        ticket({ id: "t2", quantity: 5 }),
        // Refunded tickets never count (6).
        ticket({ id: "t3", quantity: 50, status: "refunded" }),
      ],
    });

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    expect(result.participation.validTickets).toBe(10);
  });

  it("reports Tier 1 eligibility once every requirement is met", async () => {
    const { ctx } = createContext({
      tickets: [ticket({ quantity: 10 })],
      engagements: [
        {
          id: "e1",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e2",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e3",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e4",
          giveaway: "g1",
          user: "u1",
          type: "featured_offer",
          completionStatus: "completed",
        },
      ],
    });

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    const tier1 = result.tiers.find((t) => t.tier === "tier1");
    expect(result.participation).toMatchObject({
      validTickets: 10,
      boosts: 3,
      featuredOffers: 1,
    });
    expect(tier1).toMatchObject({
      requirementsMet: true,
      canWin: true,
      path: "primary",
      cooldown: null,
    });
  });

  it("reports Tier 1 as out of reach when a boost is missing", async () => {
    const { ctx } = createContext({
      tickets: [ticket({ quantity: 10 })],
      engagements: [
        {
          id: "e1",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e2",
          giveaway: "g1",
          user: "u1",
          type: "featured_offer",
          completionStatus: "completed",
        },
      ],
    });

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    expect(result.tiers.find((t) => t.tier === "tier1")?.requirementsMet).toBe(
      false
    );
    // One ticket is all Tier 3 asks for.
    expect(result.tiers.find((t) => t.tier === "tier3")?.requirementsMet).toBe(
      true
    );
  });
});

describe("giveaway.progress cooldowns (spec 22)", () => {
  /** A completed giveaway that ended before the open one. */
  const lastRound = {
    id: "g0",
    name: "Week 32",
    status: "completed",
    endDate: new Date(Date.now() - 7 * 24 * HOUR).toISOString(),
  };

  function tierOneReady(extra: Row = {}) {
    return {
      tickets: [ticket({ quantity: 10 })],
      engagements: [
        {
          id: "e1",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e2",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e3",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e4",
          giveaway: "g1",
          user: "u1",
          type: "featured_offer",
          completionStatus: "completed",
        },
      ],
      ...extra,
    };
  }

  it("separates what the user can fix from what they cannot", async () => {
    const { ctx } = createContext(
      tierOneReady({
        priorGiveaways: [lastRound],
        priorTickets: [
          {
            id: "pt0",
            giveaway: "g0",
            user: "u1",
            quantity: 5,
            status: "valid",
          },
        ],
        // Won Tier 1 last round, so Tier 1 is barred for four draws (22.2).
        priorWinners: [
          { id: "pw0", giveaway: "g0", user: "u1", tier: "tier1" },
        ],
      })
    );

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    const tier1 = result.tiers.find((t) => t.tier === "tier1");

    // They have done everything asked of them this round, and still cannot
    // win Tier 1, which is exactly the distinction the app needs to show.
    expect(tier1?.requirementsMet).toBe(true);
    expect(tier1?.canWin).toBe(false);
    expect(tier1?.cooldown?.rule).toBe("22.1");

    // Tier 3 is untouched by the high-tier cooldowns.
    expect(result.tiers.find((t) => t.tier === "tier3")?.canWin).toBe(true);
  });

  it("reports no cooldown for a user with no history", async () => {
    const { ctx } = createContext(tierOneReady());

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    for (const tier of result.tiers) {
      expect(tier.cooldown).toBe(null);
    }
    expect(result.tiers.find((t) => t.tier === "tier1")?.canWin).toBe(true);
  });

  it("waives the Featured Offer requirement for a loyal user (22.4)", async () => {
    const rounds = [4, 3, 2, 1].map((n) => ({
      id: `g-${n}`,
      name: `Round ${n}`,
      status: "completed",
      endDate: new Date(Date.now() - n * 7 * 24 * HOUR).toISOString(),
    }));

    const { ctx } = createContext({
      // Ten tickets and three boosts, but no Featured Offer this round.
      tickets: [ticket({ quantity: 10 })],
      engagements: [
        {
          id: "e1",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e2",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
        {
          id: "e3",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
        },
      ],
      priorGiveaways: rounds,
      // Took part in four consecutive rounds and won nothing.
      priorTickets: rounds.map((round, i) => ({
        id: `pt${i}`,
        giveaway: round.id,
        user: "u1",
        quantity: 5,
        status: "valid",
      })),
      priorWinners: [],
    });

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    const tier1 = result.tiers.find((t) => t.tier === "tier1");
    expect(tier1?.loyaltyWaiver).toBe(true);
    // The waiver is what carries them over the line without the offer.
    expect(tier1?.requirementsMet).toBe(true);
    expect(tier1?.canWin).toBe(true);
  });
});
