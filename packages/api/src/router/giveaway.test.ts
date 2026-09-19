import { describe, expect, it, spyOn } from "bun:test";
import { call } from "@orpc/server";

import {
  createFakePayload,
  type Doc,
  expectError,
  mockContext,
} from "../test-utils";
import { giveawayRouter } from "./giveaway";

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };
const guestUser = { id: "guest-1", isAnonymous: true, username: "guest" };

const NOW = new Date();

/**
 * Over 18, so the age gate on purchases is not what these tests measure.
 * Buying a ticket requires it, as prizes of real value are age-restricted.
 */
function adult(overrides: Doc = {}): Doc {
  return {
    id: "user-1",
    dateOfBirth: new Date("1995-01-01").toISOString(),
    ...overrides,
  };
}

const PAST = new Date(NOW.getTime() - 86_400_000).toISOString();
const FUTURE = new Date(NOW.getTime() + 86_400_000 * 30).toISOString();
const FAR_FUTURE = new Date(NOW.getTime() + 86_400_000 * 60).toISOString();
const FAR_PAST = new Date(NOW.getTime() - 86_400_000 * 60).toISOString();

function giveaway(overrides: Doc = {}): Doc {
  return {
    id: "gw-1",
    name: "Test Giveaway",
    description: "A test giveaway",
    status: "active",
    startDate: PAST,
    endDate: FUTURE,
    ticketPrice: 5,
    minTicketsRequired: 1,
    ...overrides,
  };
}

function ticket(overrides: Doc = {}): Doc {
  return {
    id: "t1",
    giveaway: "gw-1",
    user: "user-1",
    quantity: 1,
    unitPrice: 5,
    status: "valid",
    purchasedAt: NOW.toISOString(),
    ...overrides,
  };
}

function engagement(overrides: Doc = {}): Doc {
  return {
    id: "e1",
    giveaway: "gw-1",
    user: "user-1",
    type: "boost",
    content: "content-1",
    completionStatus: "completed",
    completedAt: NOW.toISOString(),
    ...overrides,
  };
}

function partnerContent(overrides: Doc = {}): Doc {
  return {
    id: "content-1",
    placements: ["connect-brand-video"],
    ...overrides,
  };
}

type DrizzleTx = {
  execute: () => Promise<unknown>;
  select: () => {
    from: () => { where: () => Promise<{ totalPoints: number }[]> };
  };
  insert: () => { values: (data: Doc) => Promise<void> };
};

function createDrizzleMock(balance = 1000) {
  const inserts: Doc[] = [];

  const tx: DrizzleTx = {
    execute: async () => [],
    select: () => ({
      from: () => ({
        where: async () => [{ totalPoints: balance }],
      }),
    }),
    insert: () => ({
      values: (data: Doc) => {
        inserts.push(data);
        return Promise.resolve();
      },
    }),
  };

  return {
    transaction: async (cb: (tx: DrizzleTx) => Promise<void>) => cb(tx),
    insert: () => ({
      values: (data: Doc) => {
        inserts.push(data);
        return Promise.resolve();
      },
    }),
    inserts,
  };
}

// ---------------------------------------------------------------------------
// current
// ---------------------------------------------------------------------------

describe("giveaway.current", () => {
  it("returns the active giveaway when one exists", async () => {
    const payload = createFakePayload({
      collections: { giveaways: [giveaway()] },
    });
    const ctx = mockContext({ payload });

    const result = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });

    expect(result).toMatchObject({
      id: "gw-1",
      name: "Test Giveaway",
      description: "A test giveaway",
      ticketPrice: 5,
      minTicketsRequired: 1,
      isOpen: true,
      state: "open",
    });
  });

  /**
   * The app renders its entry button from this call and the write paths
   * enforce the window separately, so a giveaway switched on early must not
   * come back looking enterable: that mismatch is what put a live "Enter
   * Giveaway" button in front of a purchase the server would refuse.
   */
  it("reports a giveaway switched on before its start date as not open", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway({ startDate: FUTURE, endDate: FAR_FUTURE })],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });

    expect(result).toMatchObject({
      id: "gw-1",
      startDate: FUTURE,
      isOpen: false,
      state: "pending",
    });
  });

  it("reports a giveaway past its end date as not open", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway({ startDate: FAR_PAST, endDate: PAST })],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });

    expect(result).toMatchObject({ isOpen: false, state: "closed" });
  });

  /**
   * The bug this guards against was reported as a giveaway showing as not
   * started for a reader hours west of UTC. The dates cross the window in
   * absolute time, so no device offset may change the answer.
   */
  it("judges the window in UTC, not in any local calendar", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [
          giveaway({
            startDate: "2026-08-20T14:00:00.000Z",
            endDate: "2026-09-20T14:00:00.000Z",
          }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const at = (iso: string) => {
      const spy = spyOn(Date, "now").mockReturnValue(new Date(iso).getTime());
      return () => spy.mockRestore();
    };

    let restore = at("2026-08-20T15:45:00.000Z");
    const afterStart = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });
    restore();

    restore = at("2026-08-20T13:59:00.000Z");
    const beforeStart = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });
    restore();

    expect(afterStart).toMatchObject({ isOpen: true, state: "open" });
    expect(beforeStart).toMatchObject({ isOpen: false, state: "pending" });
  });

  it("returns null when there is no active giveaway", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const result = await call(giveawayRouter.current, undefined, {
      context: ctx,
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// progress
// ---------------------------------------------------------------------------

describe("giveaway.progress", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(giveawayRouter.progress, undefined, { context: mockContext() })
    );
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("throws NOT_FOUND when there is no active giveaway", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(giveawayRouter.progress, undefined, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "There is no giveaway running at the moment.",
    });
  });

  it("throws CONFLICT when the giveaway has not opened yet", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway({ startDate: FUTURE, endDate: FAR_FUTURE })],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(giveawayRouter.progress, undefined, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "This giveaway has not opened yet.",
    });
  });

  it("throws CONFLICT when the giveaway has closed", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway({ startDate: FAR_PAST, endDate: PAST })],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(giveawayRouter.progress, undefined, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "This giveaway has closed and is waiting for its draw.",
    });
  });

  it("returns participation and tier summary for an active giveaway", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway()],
        "giveaway-tickets": [ticket({ quantity: 5 })],
        "giveaway-engagements": [
          engagement({ type: "boost" }),
          engagement({ id: "e2", type: "featured_offer" }),
        ],
        "giveaway-streaks": [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(giveawayRouter.progress, undefined, {
      context: ctx,
    });

    expect(result).toMatchObject({
      giveawayId: "gw-1",
      participation: {
        validTickets: 5,
        boosts: 1,
        featuredOffers: 1,
      },
    });
    expect(result.tiers).toHaveLength(3);
    // tier3: needs 1 ticket, 0 boosts, 0 featuredOffers → met
    const tier3 = result.tiers.find((t: Doc) => t.tier === "tier3");
    expect(tier3?.requirementsMet).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buyTickets
// ---------------------------------------------------------------------------

describe("giveaway.buyTickets", () => {
  it("rejects a guest caller", async () => {
    const payload = createFakePayload({
      collections: { giveaways: [giveaway()] },
    });
    const ctx = mockContext({ user: guestUser as never, payload });

    const error = await expectError(
      call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx })
    );

    expect(error.code).toBe("FORBIDDEN");
  });

  it("rejects quantity below minimum with a validation error", async () => {
    const payload = createFakePayload({
      collections: { giveaways: [giveaway()] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(giveawayRouter.buyTickets, { quantity: 0 }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
  });

  it("throws BAD_REQUEST when quantity is below the giveaway minimum", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway({ minTicketsRequired: 5 })],
        users: [adult()],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(giveawayRouter.buyTickets, { quantity: 2 }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "This giveaway has a minimum of 5 tickets per purchase.",
    });
  });

  it("throws BAD_REQUEST when the user has insufficient points", async () => {
    const drizzle = createDrizzleMock(10);
    const basePayload = createFakePayload({
      collections: {
        giveaways: [giveaway({ ticketPrice: 5 })],
        users: [adult()],
      },
    });
    const payload = {
      ...basePayload,
      db: { ...basePayload.db, drizzle },
    };
    const ctx = mockContext({ user: authedUser as never, payload });

    // 5 tickets × 5 points = 25 cost, but balance is only 10
    const error = await expectError(
      call(giveawayRouter.buyTickets, { quantity: 5 }, { context: ctx })
    );

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect((error as { message: string }).message).toContain(
      "Not enough points"
    );
  });

  it("creates tickets and returns the updated standing", async () => {
    const drizzle = createDrizzleMock(1000);
    const basePayload = createFakePayload({
      collections: {
        giveaways: [giveaway({ ticketPrice: 5 })],
        users: [adult()],
        "giveaway-tickets": [],
        "giveaway-engagements": [],
        "giveaway-streaks": [],
      },
    });
    const payload = {
      ...basePayload,
      db: { ...basePayload.db, drizzle },
    };
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      giveawayRouter.buyTickets,
      { quantity: 3, paymentReference: "ref-1" },
      { context: ctx }
    );

    expect(result).toMatchObject({
      quantity: 3,
      pointsSpent: 15, // 3 × 5
    });
    expect(result.ticketId).toBeDefined();
    expect(result.validTickets).toBe(3);

    // Debit activity was inserted via drizzle
    expect(drizzle.inserts).toHaveLength(1);
    expect(drizzle.inserts[0]).toMatchObject({
      user: "user-1",
      type: "point",
      action: "ticketPurchase",
      point: -15,
    });

    // Ticket was created in the fake payload
    expect(payload.docs("giveaway-tickets")).toHaveLength(1);
    expect(payload.docs("giveaway-tickets")[0]).toMatchObject({
      giveaway: "gw-1",
      user: "user-1",
      quantity: 3,
      unitPrice: 5,
      status: "valid",
      paymentReference: "ref-1",
    });

    // Tier summary was returned
    expect(result.tiers).toHaveLength(3);
  });

  it("rate limits after 10 purchases in a minute", async () => {
    // Its own id so this test spends its own rate-limit budget, not the
    // budget of the purchase tests above it.
    const user = { id: `rl-${Date.now()}`, isAnonymous: false, username: "rl" };
    const drizzle = createDrizzleMock(100_000);
    const basePayload = createFakePayload({
      collections: {
        giveaways: [giveaway({ ticketPrice: 1 })],
        users: [adult({ id: user.id })],
        "giveaway-tickets": [],
        "giveaway-engagements": [],
        "giveaway-streaks": [],
      },
    });
    const payload = {
      ...basePayload,
      db: { ...basePayload.db, drizzle },
    };
    const ctx = mockContext({ user: user as never, payload });

    const attempts = await Promise.all(
      Array.from({ length: 11 }, () =>
        call(giveawayRouter.buyTickets, { quantity: 1 }, { context: ctx }).then(
          () => "ok",
          (error: { code: string }) => error.code
        )
      )
    );

    expect(attempts.filter((a) => a === "ok")).toHaveLength(10);
    expect(attempts.filter((a) => a === "TOO_MANY_REQUESTS")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// recordEngagement
// ---------------------------------------------------------------------------

describe("giveaway.recordEngagement", () => {
  it("rejects a guest caller", async () => {
    const payload = createFakePayload({
      collections: { giveaways: [giveaway()] },
    });
    const ctx = mockContext({ user: guestUser as never, payload });

    const error = await expectError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "content-1" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("FORBIDDEN");
  });

  it("throws FORBIDDEN when the user has no valid tickets", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway()],
        "giveaway-tickets": [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "content-1" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Buy a ticket before completing a Boost Your Luck.",
    });
  });

  it("throws NOT_FOUND when the partner content does not exist", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway()],
        "giveaway-tickets": [ticket()],
        "partner-content": [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "nonexistent" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "That item no longer exists.",
    });
  });

  it("throws BAD_REQUEST when the placement does not match the engagement type", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway()],
        "giveaway-tickets": [ticket()],
        "partner-content": [
          partnerContent({
            id: "wrong-placement",
            placements: ["lucky-app-wall"],
          }),
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "wrong-placement" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "That item does not count towards Boost Your Luck.",
    });
  });

  it("throws CONFLICT when the engagement was already completed", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway()],
        "giveaway-tickets": [ticket()],
        "partner-content": [partnerContent()],
        "giveaway-engagements": [
          engagement({
            type: "boost",
            content: "content-1",
            completionStatus: "completed",
          }),
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        giveawayRouter.recordEngagement,
        { type: "boost", contentId: "content-1" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "You have already completed this Boost Your Luck.",
    });
  });

  it("creates an engagement and returns the updated standing", async () => {
    const payload = createFakePayload({
      collections: {
        giveaways: [giveaway()],
        "giveaway-tickets": [ticket()],
        "partner-content": [partnerContent()],
        "giveaway-engagements": [],
        "giveaway-streaks": [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      giveawayRouter.recordEngagement,
      { type: "boost", contentId: "content-1" },
      { context: ctx }
    );

    expect(result).toMatchObject({
      type: "boost",
      boosts: 1,
      featuredOffers: 0,
    });
    expect(result.engagementId).toBeDefined();
    expect(result.tiers).toHaveLength(3);

    // Engagement was persisted in the fake payload
    expect(payload.docs("giveaway-engagements")).toHaveLength(1);
    expect(payload.docs("giveaway-engagements")[0]).toMatchObject({
      giveaway: "gw-1",
      user: "user-1",
      type: "boost",
      content: "content-1",
      completionStatus: "completed",
    });
  });
});
