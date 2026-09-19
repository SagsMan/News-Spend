import { describe, expect, it } from "bun:test";
import {
  claimDeadlineFor,
  claimWindowFor,
  expireLapsedClaims,
} from "@news-spend-media/payload/lib/giveaway/claim";
import { call } from "@orpc/server";

import { giveawayRouter } from "../src/router/giveaway";
import { mockContext } from "../src/test-utils";

type Row = Record<string, any>;

const DAY = 24 * 60 * 60 * 1000;
const user = { id: "u1", isAnonymous: false, username: "tester" };

/**
 * One clock for the whole fixture. `pastGiveaway` is stamped twice per test,
 * once inside `winnerRow` and once as `createContext`'s default `giveaways`
 * seed, and two live `Date.now()` calls can straddle a millisecond tick under
 * CPU contention, making the second giveaway read as "superseded" by the first
 * (claim.ts `isSuperseded`: latestStart > giveawayStartDate). Freezing the
 * clock makes the two stamps identical, so a fresh giveaway is never mistaken
 * for a later one.
 */
const FIXTURE_NOW = Date.now();

function pastGiveaway(overrides: Row = {}): Row {
  return {
    id: "g1",
    name: "Week 33",
    status: "completed",
    startDate: new Date(FIXTURE_NOW - 20 * DAY).toISOString(),
    endDate: new Date(FIXTURE_NOW - 6 * DAY).toISOString(),
    ...overrides,
  };
}

function prize(overrides: Row = {}): Row {
  return {
    id: "cat-1",
    name: "500 Airtime",
    fulfilmentType: "airtime",
    ...overrides,
  };
}

function winnerRow(overrides: Row = {}): Row {
  const selectedAt = new Date(Date.now() - 2 * DAY).toISOString();
  return {
    id: "w1",
    giveaway: pastGiveaway(),
    user: "u1",
    tier: "tier3",
    prize: prize(),
    prizeName: "500 Airtime",
    selectedAt,
    claimDeadline: claimDeadlineFor(selectedAt),
    claimStatus: "unclaimed",
    fulfilmentStatus: "pending",
    ...overrides,
  };
}

function createContext({
  winners = [],
  giveaways = [pastGiveaway()],
}: {
  winners?: Row[];
  giveaways?: Row[];
} = {}) {
  const collections: Record<string, Row[]> = {
    "giveaway-winners": winners,
    giveaways,
  };
  const points: number[] = [];

  const payload: any = {
    logger: { error: () => undefined, warn: () => undefined },
    db: {
      drizzle: {
        insert: () => ({
          values: async (row: Row) => {
            points.push(row.point);
          },
        }),
      },
    },
    findByID: async ({ collection, id }: Row) =>
      collections[collection]?.find((row) => row.id === id) ?? null,
    find: async ({ collection, where, sort, limit, page }: Row) => {
      let docs = (collections[collection] ?? []).filter((row) =>
        matchesWhere(row, where)
      );
      if (sort) {
        const desc = sort.startsWith("-");
        const key = desc ? sort.slice(1) : sort;
        docs = [...docs].sort((a, b) =>
          desc
            ? String(b[key]).localeCompare(String(a[key]))
            : String(a[key]).localeCompare(String(b[key]))
        );
      }
      const totalDocs = docs.length;
      const size = limit ?? totalDocs;
      const current = page ?? 1;
      const start = (current - 1) * size;
      docs = docs.slice(start, start + size);
      return {
        docs,
        totalDocs,
        page: current,
        hasNextPage: start + size < totalDocs,
      };
    },
    count: async ({ collection, where }: Row) => ({
      totalDocs: (collections[collection] ?? []).filter((row) =>
        matchesWhere(row, where)
      ).length,
    }),
    update: async ({ collection, id, data }: Row) => {
      const row = collections[collection]?.find((item) => item.id === id);
      if (row) {
        Object.assign(row, data);
      }
      return row ?? { id, ...data };
    },
  };

  return {
    ctx: mockContext({ user: user as never, payload }),
    payload,
    collections,
    points,
  };
}

function matchesWhere(row: Row, where: Row | undefined): boolean {
  if (!where) {
    return true;
  }
  if (Array.isArray(where.and)) {
    return where.and.every((clause: Row) => matchesWhere(row, clause));
  }
  if (Array.isArray(where.or)) {
    return where.or.some((clause: Row) => matchesWhere(row, clause));
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
    if (clause?.not_equals !== undefined) {
      return String(key) !== String(clause.not_equals);
    }
    if (clause?.greater_than !== undefined) {
      return String(key) > String(clause.greater_than);
    }
    return true;
  });
}

async function captureError(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code: string; message: string };
  }
  throw new Error("expected the call to throw, but it resolved");
}

describe("claimWindowFor (spec 21)", () => {
  const selectedAt = new Date(Date.now() - 2 * DAY).toISOString();
  const winner = { selectedAt, claimDeadline: claimDeadlineFor(selectedAt) };

  it("is open inside the 14 days", () => {
    expect(claimWindowFor(winner, { laterGiveawayExists: false }).open).toBe(
      true
    );
  });

  it("closes once 14 days have passed", () => {
    const window = claimWindowFor(winner, {
      laterGiveawayExists: false,
      now: new Date(Date.now() + 13 * DAY),
    });

    expect(window.open).toBe(false);
    if (!window.open) {
      expect(window.reason).toBe("expired");
    }
  });

  it("closes the moment a later giveaway exists, deadline or not", () => {
    // Two days in, twelve still on the clock, but a new round has started.
    const window = claimWindowFor(winner, { laterGiveawayExists: true });

    expect(window.open).toBe(false);
    if (!window.open) {
      expect(window.reason).toBe("superseded");
      expect(window.message).toMatch(/new giveaway has already started/);
    }
  });
});

describe("giveaway.actionable", () => {
  it("lists prizes with what each one still needs", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({ id: "w1", prize: prize({ fulfilmentType: "airtime" }) }),
        winnerRow({
          id: "w2",
          prize: prize({ id: "cat-2", fulfilmentType: "physical" }),
          prizeName: "Refrigerator",
        }),
        winnerRow({
          id: "w3",
          prize: prize({ id: "cat-3", fulfilmentType: "points" }),
          prizeName: "500 Points",
        }),
      ],
    });

    const rows = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(rows.find((r) => r.id === "w1")?.needs).toEqual({
      phone: true,
      address: false,
      verification: false,
    });
    expect(rows.find((r) => r.id === "w2")?.needs).toEqual({
      phone: false,
      address: true,
      verification: false,
    });
    expect(rows.find((r) => r.id === "w3")?.needs).toEqual({
      phone: false,
      address: false,
      verification: false,
    });
  });

  it("still shows a prize the sweep has not yet caught, marked closed", async () => {
    // Storage still says "unclaimed": only the hourly sweep flips it to
    // "expired", so this genuinely belongs here until that runs. The window
    // being closed is what the app has to show, not the raw claimStatus.
    const selectedAt = new Date(Date.now() - 30 * DAY).toISOString();
    const { ctx } = createContext({
      winners: [
        winnerRow({
          selectedAt,
          claimDeadline: claimDeadlineFor(selectedAt),
        }),
      ],
    });

    const [row] = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(row?.claimable).toBe(false);
    expect(row?.closedReason).toBe("expired");
  });

  it("flags a prize held for review rather than promising delivery", async () => {
    const { ctx } = createContext({
      winners: [winnerRow({ fulfilmentStatus: "on_hold" })],
    });

    const [row] = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(row?.underReview).toBe(true);
  });

  it("includes a claimed prize still waiting on verification", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({
          claimStatus: "claimed",
          fulfilmentStatus: "awaiting_verification",
        }),
      ],
    });

    const [row] = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(row?.awaitingVerification).toBe(true);
  });

  it("excludes a prize that has already resolved", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({ claimStatus: "claimed", fulfilmentStatus: "fulfilled" }),
      ],
    });

    const rows = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    // Fulfilled prizes belong to history, not the unpaged actionable list;
    // otherwise this list would grow the same way history does.
    expect(rows).toHaveLength(0);
  });

  it("is never paged, however many prizes qualify", async () => {
    const { ctx } = createContext({
      winners: Array.from({ length: 25 }, (_, i) =>
        winnerRow({ id: `w${i}`, prizeName: `Prize ${i}` })
      ),
    });

    const rows = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(rows).toHaveLength(25);
  });

  it("does not list another user's prize", async () => {
    const { ctx } = createContext({
      winners: [winnerRow({ user: "someone-else" })],
    });

    const rows = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(rows).toHaveLength(0);
  });
});

describe("giveaway.history", () => {
  function resolved(overrides: Row = {}): Row {
    return winnerRow({
      claimStatus: "claimed",
      fulfilmentStatus: "fulfilled",
      ...overrides,
    });
  }

  it("pages rather than returning every prize at once", async () => {
    const { ctx } = createContext({
      winners: Array.from({ length: 25 }, (_, i) =>
        resolved({ id: `w${i}`, prizeName: `Prize ${i}` })
      ),
    });

    const first = await call(giveawayRouter.history, {}, { context: ctx });

    // A list that only ever grows must not be fetched whole to draw one screen.
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(first.totalPrizes).toBe(25);

    const second = await call(
      giveawayRouter.history,
      { page: 2 },
      { context: ctx }
    );

    expect(second.items).toHaveLength(5);
    expect(second.hasMore).toBe(false);
  });

  it("excludes a prize actionable already covers", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({ id: "w1" }),
        resolved({ id: "w2" }),
        winnerRow({
          id: "w3",
          claimStatus: "claimed",
          fulfilmentStatus: "awaiting_verification",
        }),
      ],
    });

    const { items } = await call(giveawayRouter.history, {}, { context: ctx });

    // Otherwise a prize would appear in both lists at once.
    expect(items.map((r) => r.id)).toEqual(["w2"]);
  });

  it("does not list another user's prize", async () => {
    const { ctx } = createContext({
      winners: [resolved({ user: "someone-else" })],
    });

    const { items } = await call(giveawayRouter.history, {}, { context: ctx });

    expect(items).toHaveLength(0);
  });
});

describe("giveaway.winning", () => {
  it("fetches one prize by id, without scanning any list", async () => {
    const { ctx } = createContext({
      winners: Array.from({ length: 25 }, (_, i) =>
        winnerRow({ id: `w${i}`, prizeName: `Prize ${i}` })
      ),
    });

    // Deliberately a prize past the first page of history: the claim screen
    // has to reach it even though the app is only holding page one.
    const row = await call(
      giveawayRouter.winning,
      { winnerId: "w24" },
      { context: ctx }
    );

    expect(row.prizeName).toBe("Prize 24");
  });

  it("refuses to fetch another user's prize by id", async () => {
    const { ctx } = createContext({
      winners: [winnerRow({ user: "someone-else" })],
    });

    const error = await captureError(
      call(giveawayRouter.winning, { winnerId: "w1" }, { context: ctx })
    );

    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("giveaway.claimPrize (spec 21)", () => {
  it("credits a points prize immediately", async () => {
    const { ctx, points, collections } = createContext({
      winners: [
        winnerRow({
          prize: prize({ fulfilmentType: "points", pointsAmount: 500 }),
          prizeName: "500 Points",
        }),
      ],
    });

    const result = await call(
      giveawayRouter.claimPrize,
      { winnerId: "w1" },
      { context: ctx }
    );

    expect(result.pointsCredited).toBe(500);
    expect(points).toEqual([500]);
    // Settled outright: there is no window where it reads claimed but unpaid.
    expect(collections["giveaway-winners"]?.[0]?.fulfilmentStatus).toBe(
      "fulfilled"
    );
  });

  it("requires a phone number for airtime", async () => {
    const { ctx } = createContext({ winners: [winnerRow()] });

    const error = await captureError(
      call(giveawayRouter.claimPrize, { winnerId: "w1" }, { context: ctx })
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toMatch(/phone number is needed/);
  });

  it("stores the nominated number and leaves fulfilment pending", async () => {
    const { ctx, collections } = createContext({ winners: [winnerRow()] });

    await call(
      giveawayRouter.claimPrize,
      { winnerId: "w1", phoneNumber: "08031234567" },
      { context: ctx }
    );

    const stored = collections["giveaway-winners"]?.[0];
    expect(stored?.claimPhone).toBe("08031234567");
    expect(stored?.claimStatus).toBe("claimed");
    expect(stored?.fulfilmentStatus).toBe("pending");
  });

  it("requires an address and recipient for a physical prize", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({
          prize: prize({ fulfilmentType: "physical" }),
          prizeName: "Refrigerator",
        }),
      ],
    });

    const error = await captureError(
      call(
        giveawayRouter.claimPrize,
        { winnerId: "w1", recipientName: "Ada" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toMatch(/delivery address and recipient name/);
  });

  it("refuses once a later giveaway has started", async () => {
    const { ctx } = createContext({
      winners: [winnerRow()],
      giveaways: [
        pastGiveaway(),
        // A newer round is running, so the old prize is closed even though
        // twelve days of its window remain.
        {
          id: "g2",
          name: "Week 34",
          status: "active",
          startDate: new Date(Date.now() - DAY).toISOString(),
          endDate: new Date(Date.now() + 13 * DAY).toISOString(),
        },
      ],
    });

    const error = await captureError(
      call(
        giveawayRouter.claimPrize,
        { winnerId: "w1", phoneNumber: "08031234567" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.message).toMatch(/new giveaway has already started/);
  });

  it("ignores a draft giveaway when deciding supersession", async () => {
    const { ctx } = createContext({
      winners: [winnerRow()],
      giveaways: [
        pastGiveaway(),
        // Configured but not published: it has not started anything.
        {
          id: "g2",
          status: "draft",
          startDate: new Date(Date.now() - DAY).toISOString(),
          endDate: new Date(Date.now() + 13 * DAY).toISOString(),
        },
      ],
    });

    const result = await call(
      giveawayRouter.claimPrize,
      { winnerId: "w1", phoneNumber: "08031234567" },
      { context: ctx }
    );

    expect(result.claimStatus).toBe("claimed");
  });

  it("refuses a second claim", async () => {
    const { ctx } = createContext({
      winners: [winnerRow({ claimStatus: "claimed" })],
    });

    const error = await captureError(
      call(
        giveawayRouter.claimPrize,
        { winnerId: "w1", phoneNumber: "08031234567" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.message).toMatch(/already claimed/);
  });

  it("keeps a held prize held after it is claimed", async () => {
    const { ctx, collections } = createContext({
      winners: [winnerRow({ fulfilmentStatus: "on_hold" })],
    });

    const result = await call(
      giveawayRouter.claimPrize,
      { winnerId: "w1", phoneNumber: "08031234567" },
      { context: ctx }
    );

    // 22.8: claiming is the winner's act, releasing is the administrator's.
    expect(result.underReview).toBe(true);
    expect(collections["giveaway-winners"]?.[0]?.fulfilmentStatus).toBe(
      "on_hold"
    );
  });

  it("secures the claim but withholds a prize needing verification", async () => {
    const { ctx, collections } = createContext({
      winners: [
        winnerRow({
          prize: prize({
            fulfilmentType: "physical",
            requiresVerification: true,
          }),
          prizeName: "PlayStation Console",
        }),
      ],
    });

    const result = await call(
      giveawayRouter.claimPrize,
      {
        winnerId: "w1",
        recipientName: "Ada Obi",
        shippingAddress: "12 Marina Road, Lagos Island, Lagos",
      },
      { context: ctx }
    );

    // The claim itself lands immediately: that is what stops the 14-day
    // clock. Only the dispatch waits on identity.
    expect(result.claimStatus).toBe("claimed");
    expect(result.awaitingVerification).toBe(true);
    expect(collections["giveaway-winners"]?.[0]).toMatchObject({
      claimStatus: "claimed",
      fulfilmentStatus: "awaiting_verification",
    });
    expect(result.message).toMatch(/no rush/);
  });

  it("never settles a points prize instantly when verification is required", async () => {
    const { ctx, points, collections } = createContext({
      winners: [
        winnerRow({
          prize: prize({
            fulfilmentType: "points",
            pointsAmount: 5000,
            requiresVerification: true,
          }),
          prizeName: "5,000 Points",
        }),
      ],
    });

    const result = await call(
      giveawayRouter.claimPrize,
      { winnerId: "w1" },
      { context: ctx }
    );

    // Crediting first and verifying later would hand over the prize before the
    // check that was supposed to gate it.
    expect(points).toEqual([]);
    expect(result.pointsCredited).toBe(0);
    expect(collections["giveaway-winners"]?.[0]?.fulfilmentStatus).toBe(
      "awaiting_verification"
    );
  });

  it("keeps a held prize held even when it also needs verification", async () => {
    const { ctx, collections } = createContext({
      winners: [
        winnerRow({
          fulfilmentStatus: "on_hold",
          prize: prize({
            fulfilmentType: "physical",
            requiresVerification: true,
          }),
        }),
      ],
    });

    const result = await call(
      giveawayRouter.claimPrize,
      {
        winnerId: "w1",
        recipientName: "Ada Obi",
        shippingAddress: "12 Marina Road, Lagos Island, Lagos",
      },
      { context: ctx }
    );

    // An administrator review outranks a verification prompt: telling the
    // winner to verify would imply that is all that stands in the way.
    expect(result.underReview).toBe(true);
    expect(collections["giveaway-winners"]?.[0]?.fulfilmentStatus).toBe(
      "on_hold"
    );
  });

  it("will not let one user claim another's prize", async () => {
    const { ctx } = createContext({
      winners: [winnerRow({ user: "someone-else" })],
    });

    const error = await captureError(
      call(
        giveawayRouter.claimPrize,
        { winnerId: "w1", phoneNumber: "08031234567" },
        { context: ctx }
      )
    );

    // Deliberately NOT_FOUND rather than FORBIDDEN: a stranger's prize should
    // not be confirmed to exist.
    expect(error.code).toBe("NOT_FOUND");
  });
});

describe("supersession lookups scale flat", () => {
  /** Counts reads per collection so query growth is visible to a test. */
  function countingContext(winners: Row[], giveaways: Row[]) {
    const base = createContext({ winners, giveaways });
    const reads: Record<string, number> = {};
    const original = base.payload.find;
    base.payload.find = async (args: Row) => {
      reads[args.collection] = (reads[args.collection] ?? 0) + 1;
      return original(args);
    };
    return { ...base, reads };
  }

  it("asks about giveaways once, however many prizes are listed", async () => {
    const giveaways = Array.from({ length: 12 }, (_, i) => ({
      id: `g${i}`,
      name: `Round ${i}`,
      status: "completed",
      startDate: new Date(Date.now() - (40 - i) * DAY).toISOString(),
      endDate: new Date(Date.now() - (30 - i) * DAY).toISOString(),
    }));
    const winners = giveaways.map((g, i) =>
      winnerRow({ id: `w${i}`, giveaway: g, prizeName: `Prize ${i}` })
    );

    const { ctx, reads } = countingContext(winners, giveaways);
    const items = await call(giveawayRouter.actionable, undefined, {
      context: ctx,
    });

    expect(items).toHaveLength(12);
    // Twelve prizes across twelve different giveaways still costs one
    // giveaway lookup: asking for the newest start date answers "has this
    // been superseded?" for every prize at once.
    expect(reads.giveaways).toBe(1);
  });

  it("asks once while expiring a batch too", async () => {
    const giveaways = Array.from({ length: 8 }, (_, i) => ({
      id: `g${i}`,
      name: `Round ${i}`,
      status: "completed",
      startDate: new Date(Date.now() - (60 - i) * DAY).toISOString(),
      endDate: new Date(Date.now() - (50 - i) * DAY).toISOString(),
    }));
    const stale = new Date(Date.now() - 40 * DAY).toISOString();
    const winners = giveaways.map((g, i) =>
      winnerRow({
        id: `w${i}`,
        giveaway: g,
        selectedAt: stale,
        claimDeadline: claimDeadlineFor(stale),
      })
    );

    const { payload, reads } = countingContext(winners, giveaways);
    const expired = await expireLapsedClaims(payload);

    expect(expired).toBe(8);
    expect(reads.giveaways).toBe(1);
  });

  it("expires at most one batch per pass", async () => {
    const stale = new Date(Date.now() - 40 * DAY).toISOString();
    const { payload, collections } = createContext({
      winners: Array.from({ length: 30 }, (_, i) =>
        winnerRow({
          id: `w${i}`,
          selectedAt: stale,
          claimDeadline: claimDeadlineFor(stale),
        })
      ),
    });

    // An unbounded sweep would grow with the platform forever. Whatever is
    // left over is picked up on the next hourly pass.
    expect(await expireLapsedClaims(payload, { limit: 10 })).toBe(10);
    expect(
      collections["giveaway-winners"]?.filter(
        (w) => w.claimStatus === "expired"
      )
    ).toHaveLength(10);

    expect(await expireLapsedClaims(payload, { limit: 10 })).toBe(10);
  });
});

describe("expireLapsedClaims (spec 21)", () => {
  it("expires an unclaimed prize past its deadline", async () => {
    const selectedAt = new Date(Date.now() - 30 * DAY).toISOString();
    const { payload, collections } = createContext({
      winners: [
        winnerRow({ selectedAt, claimDeadline: claimDeadlineFor(selectedAt) }),
      ],
    });

    const expired = await expireLapsedClaims(payload);

    expect(expired).toBe(1);
    expect(collections["giveaway-winners"]?.[0]).toMatchObject({
      claimStatus: "expired",
      // An expired prize must not stay in anyone's dispatch queue.
      fulfilmentStatus: "cancelled",
    });
  });

  it("expires an unclaimed prize once a later giveaway starts", async () => {
    const { payload, collections } = createContext({
      winners: [winnerRow()],
      giveaways: [
        pastGiveaway(),
        {
          id: "g2",
          status: "active",
          startDate: new Date(Date.now() - DAY).toISOString(),
          endDate: new Date(Date.now() + 13 * DAY).toISOString(),
        },
      ],
    });

    const expired = await expireLapsedClaims(payload);

    expect(expired).toBe(1);
    expect(collections["giveaway-winners"]?.[0]?.claimStatus).toBe("expired");
  });

  it("leaves a prize still inside its window alone", async () => {
    const { payload, collections } = createContext({
      winners: [winnerRow()],
    });

    expect(await expireLapsedClaims(payload)).toBe(0);
    expect(collections["giveaway-winners"]?.[0]?.claimStatus).toBe("unclaimed");
  });

  it("does not touch a prize that was already claimed", async () => {
    const selectedAt = new Date(Date.now() - 30 * DAY).toISOString();
    const { payload, collections } = createContext({
      winners: [
        winnerRow({
          selectedAt,
          claimDeadline: claimDeadlineFor(selectedAt),
          claimStatus: "claimed",
        }),
      ],
    });

    expect(await expireLapsedClaims(payload)).toBe(0);
    expect(collections["giveaway-winners"]?.[0]?.claimStatus).toBe("claimed");
  });
});

describe("giveaway.updateClaimDetails", () => {
  it("corrects the number a held airtime prize is being sent to", async () => {
    const { ctx, collections } = createContext({
      winners: [
        winnerRow({ claimStatus: "claimed", fulfilmentStatus: "on_hold" }),
      ],
    });
    collections["giveaway-fulfilment-attempts"] = [
      { id: "a1", winner: "w1", outcome: "permanent_failure" },
    ];

    const result = await call(
      giveawayRouter.updateClaimDetails,
      { winnerId: "w1", phoneNumber: "08099999999" },
      { context: ctx }
    );

    const winner = collections["giveaway-winners"]![0]!;
    expect(winner.claimPhone).toBe("08099999999");
    // A corrected number is worthless if nothing tries again.
    expect(result.releasedForRetry).toBe(true);
    expect(winner.fulfilmentStatus).toBe("pending");
  });

  it("does not release a prize held for review rather than for a failure", async () => {
    const { ctx, collections } = createContext({
      winners: [
        winnerRow({ claimStatus: "claimed", fulfilmentStatus: "on_hold" }),
      ],
    });
    // No fulfilment attempts: this is a 22.7/22.8 fraud hold, not a payout
    // that failed. Editing a phone number must not be a way out of a review.
    collections["giveaway-fulfilment-attempts"] = [];

    const result = await call(
      giveawayRouter.updateClaimDetails,
      { winnerId: "w1", phoneNumber: "08099999999" },
      { context: ctx }
    );

    expect(result.releasedForRetry).toBe(false);
    expect(collections["giveaway-winners"]![0]!.fulfilmentStatus).toBe(
      "on_hold"
    );
  });

  it("refuses to change details once the prize has been sent", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({ claimStatus: "claimed", fulfilmentStatus: "fulfilled" }),
      ],
    });

    const error = await captureError(
      call(
        giveawayRouter.updateClaimDetails,
        { winnerId: "w1", phoneNumber: "08099999999" },
        { context: ctx }
      )
    );

    // The airtime has already gone somewhere. Editing the record afterwards
    // would only rewrite history.
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toMatch(/already been sent/);
  });

  it("refuses while a dispatch is in flight", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({ claimStatus: "claimed", fulfilmentStatus: "in_progress" }),
      ],
    });

    const error = await captureError(
      call(
        giveawayRouter.updateClaimDetails,
        { winnerId: "w1", phoneNumber: "08099999999" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("CONFLICT");
  });

  it("will not let someone edit a prize that is not theirs", async () => {
    const { ctx } = createContext({
      winners: [
        winnerRow({
          user: "someone-else",
          claimStatus: "claimed",
          fulfilmentStatus: "on_hold",
        }),
      ],
    });

    const error = await captureError(
      call(
        giveawayRouter.updateClaimDetails,
        { winnerId: "w1", phoneNumber: "08099999999" },
        { context: ctx }
      )
    );

    // Not FORBIDDEN: that would confirm the prize exists.
    expect(error.code).toBe("NOT_FOUND");
  });

  it("updates name and address for a physical prize", async () => {
    const { ctx, collections } = createContext({
      winners: [
        winnerRow({
          prize: prize({ fulfilmentType: "physical" }),
          claimStatus: "claimed",
          fulfilmentStatus: "pending",
        }),
      ],
    });

    await call(
      giveawayRouter.updateClaimDetails,
      {
        winnerId: "w1",
        recipientName: "Joseph Odunsi",
        shippingAddress: "3 Olanipekun Street, Ikosi Ketu, Lagos",
      },
      { context: ctx }
    );

    const winner = collections["giveaway-winners"]![0]!;
    expect(winner.claimRecipientName).toBe("Joseph Odunsi");
    expect(winner.claimAddress).toContain("Olanipekun");
  });
});
