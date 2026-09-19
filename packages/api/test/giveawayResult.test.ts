import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { giveawayRouter } from "../src/router/giveaway";
import { mockContext } from "../src/test-utils";

type Row = Record<string, any>;

const user = { id: "u1", isAnonymous: false, username: "tester" };

const DAY = 86_400_000;

function completedGiveaway(overrides: Row = {}): Row {
  return {
    id: "g1",
    name: "Week 33",
    status: "completed",
    startDate: new Date(Date.now() - 8 * DAY).toISOString(),
    endDate: new Date(Date.now() - DAY).toISOString(),
    drawCompletedAt: new Date(Date.now() - DAY).toISOString(),
    totalValidParticipants: 420,
    ...overrides,
  };
}

function winnerRow(overrides: Row = {}): Row {
  return {
    id: "w1",
    giveaway: "g1",
    user: "u1",
    tier: "tier1",
    prizeName: "₦5,000 Airtime",
    claimStatus: "unclaimed",
    fulfilmentStatus: "pending",
    selectedAt: new Date(Date.now() - DAY).toISOString(),
    claimDeadline: new Date(Date.now() + 13 * DAY).toISOString(),
    ...overrides,
  };
}

/**
 * A Payload stand-in scoped to the reveal: the completed giveaway, whether
 * this user held a ticket in it, whether they won, and the pointer recording
 * that they have already been told.
 */
function createContext({
  giveaways = [completedGiveaway()],
  tickets = [{ id: "t1", quantity: 3 }],
  winners = [],
  seen = null,
}: Partial<{
  giveaways: Row[];
  /** Rows, so a single purchase of several tickets can be distinguished. */
  tickets: Row[];
  winners: Row[];
  seen: string | null;
}> = {}) {
  const updates: Row[] = [];

  const payload: Row = {
    logger: { error: () => undefined, warn: () => undefined },
    find: async ({ collection, sort }: Row) => {
      if (collection === "giveaways") {
        // Both queries here take the first row of a sorted list, so the fake
        // sorts rather than returning insertion order and hoping.
        const key =
          sort === "-drawCompletedAt" ? "drawCompletedAt" : "startDate";
        const docs = [...giveaways]
          .filter((g) => (key === "drawCompletedAt" ? g.drawCompletedAt : true))
          .filter((g) =>
            key === "drawCompletedAt" ? g.status === "completed" : true
          )
          .sort((a, b) =>
            String(b[key] ?? "").localeCompare(String(a[key] ?? ""))
          );
        return { docs, totalDocs: docs.length };
      }
      if (collection === "giveaway-winners") {
        return { docs: winners, totalDocs: winners.length };
      }
      if (collection === "giveaway-tickets") {
        return { docs: tickets, totalDocs: tickets.length };
      }
      return { docs: [], totalDocs: 0 };
    },
    findByID: async ({ collection, id }: Row) =>
      collection === "users" ? { id, lastGiveawayResultSeen: seen } : null,
    update: async ({ collection, id, data }: Row) => {
      updates.push({ collection, id, ...data });
      return { id, ...data };
    },
  };

  return {
    ctx: mockContext({ user: user as never, payload }),
    updates,
  };
}

describe("giveaway.lastResult", () => {
  it("tells a participant who did not win that the draw has been made", async () => {
    const { ctx } = createContext();

    const result: any = await call(giveawayRouter.lastResult, undefined, {
      context: ctx,
    });

    expect(result).not.toBe(null);
    expect(result.won).toBe(false);
    expect(result.prizes).toHaveLength(0);
    expect(result.giveawayId).toBe("g1");
    expect(result.tickets).toBe(3);
    expect(result.totalParticipants).toBe(420);
  });

  it("reports the prizes when the participant won", async () => {
    const { ctx } = createContext({ winners: [winnerRow()] });

    const result: any = await call(giveawayRouter.lastResult, undefined, {
      context: ctx,
    });

    expect(result.won).toBe(true);
    expect(result.prizes[0]).toMatchObject({
      id: "w1",
      prizeName: "₦5,000 Airtime",
      claimable: true,
    });
  });

  it("counts entries by quantity, not by purchase", async () => {
    // One purchase of ten tickets is ten entries. Reporting the row count
    // would understate someone's own stake back to them.
    const { ctx } = createContext({
      tickets: [
        { id: "t1", quantity: 10 },
        { id: "t2", quantity: 2 },
      ],
    });

    const result: any = await call(giveawayRouter.lastResult, undefined, {
      context: ctx,
    });

    expect(result.tickets).toBe(12);
  });

  it("says nothing to someone who never entered", async () => {
    // A draw only speaks to the people it drew from. Telling a non-entrant
    // they did not win is announcing the outcome of something they sat out.
    const { ctx } = createContext({ tickets: [] });

    expect(
      await call(giveawayRouter.lastResult, undefined, { context: ctx })
    ).toBe(null);
  });

  it("says nothing once the result has been acknowledged", async () => {
    const { ctx } = createContext({ seen: "g1" });

    expect(
      await call(giveawayRouter.lastResult, undefined, { context: ctx })
    ).toBe(null);
  });

  it("reveals a newer draw even after the previous one was acknowledged", async () => {
    // The pointer retires one result, not the feature. Someone who saw week 33
    // is still owed week 34.
    const { ctx } = createContext({
      seen: "g1",
      giveaways: [
        completedGiveaway(),
        completedGiveaway({
          id: "g2",
          name: "Week 34",
          drawCompletedAt: new Date().toISOString(),
        }),
      ],
    });

    const result: any = await call(giveawayRouter.lastResult, undefined, {
      context: ctx,
    });

    expect(result.giveawayId).toBe("g2");
  });

  it("says nothing when no draw has ever completed", async () => {
    const { ctx } = createContext({ giveaways: [] });

    expect(
      await call(giveawayRouter.lastResult, undefined, { context: ctx })
    ).toBe(null);
  });

  it("ignores a giveaway that is running rather than drawn", async () => {
    const { ctx } = createContext({
      giveaways: [
        completedGiveaway({ status: "active", drawCompletedAt: null }),
      ],
    });

    expect(
      await call(giveawayRouter.lastResult, undefined, { context: ctx })
    ).toBe(null);
  });
});

describe("giveaway.acknowledgeResult", () => {
  it("records that the result has been seen", async () => {
    const { ctx, updates } = createContext();

    const result = await call(
      giveawayRouter.acknowledgeResult,
      { giveawayId: "g1" },
      { context: ctx }
    );

    expect(result).toEqual({ acknowledged: true });
    expect(updates[0]).toMatchObject({
      collection: "users",
      id: "u1",
      lastGiveawayResultSeen: "g1",
    });
  });

  it("refuses to move the pointer to a superseded result", async () => {
    // A client holding week 33's reveal must not be able to mark week 34 seen,
    // as that would silently swallow a result nobody had been shown.
    const { ctx, updates } = createContext({
      giveaways: [
        completedGiveaway(),
        completedGiveaway({
          id: "g2",
          drawCompletedAt: new Date().toISOString(),
        }),
      ],
    });

    const result = await call(
      giveawayRouter.acknowledgeResult,
      { giveawayId: "g1" },
      { context: ctx }
    );

    expect(result).toEqual({ acknowledged: false });
    expect(updates).toHaveLength(0);
  });

  it("is harmless when no draw has completed", async () => {
    const { ctx, updates } = createContext({ giveaways: [] });

    expect(
      await call(
        giveawayRouter.acknowledgeResult,
        { giveawayId: "g1" },
        { context: ctx }
      )
    ).toEqual({ acknowledged: false });
    expect(updates).toHaveLength(0);
  });
});
