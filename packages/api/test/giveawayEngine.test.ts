import { describe, expect, it } from "bun:test";
import {
  evaluateEligibility,
  maxTierWinners,
  nextStreakValue,
  type Participation,
} from "@news-spend-media/payload/lib/giveaway/eligibility";
import {
  GiveawayEngine,
  GiveawayEngineError,
} from "@news-spend-media/payload/lib/giveaway/GiveawayEngine";
import {
  createRng,
  weightedPick,
} from "@news-spend-media/payload/lib/giveaway/random";

type Row = Record<string, any>;

type FakeData = {
  giveaway?: Row;
  tickets?: Row[];
  boosts?: Row[];
  offers?: Row[];
  prizes?: Row[];
  streaks?: Row[];
  /** Previously completed giveaways, for the 22 fairness history. */
  priorGiveaways?: Row[];
  /** Winner rows from those prior giveaways. */
  priorWinners?: Row[];
  /** Ticket rows from those prior giveaways, i.e. who took part. */
  priorTickets?: Row[];
  accountFlags?: Row[];
};

/**
 * Minimal in-memory stand-in for the Payload Local API, covering only the
 * operations the engine performs.
 */
function createFakePayload(data: FakeData = {}) {
  const created: Record<string, Row[]> = {};
  const giveaway: Row = {
    id: "g1",
    name: "Test Giveaway",
    status: "active",
    endDate: new Date(Date.now() - 60_000).toISOString(),
    tier1WinnerPercentage: 0.1,
    tier2WinnerPercentage: 0.5,
    tier3WinnerPercentage: 5,
    ...data.giveaway,
  };

  const prizes = (data.prizes ?? []).map((prize) => ({ ...prize }));

  const collections: Record<string, Row[]> = {
    "giveaway-tickets": data.tickets ?? [],
    // Boosts and Featured Offers live in one collection, split by `type`.
    // Tests still pass them separately for readability; the type is stamped
    // here, and an explicit `type` on a row wins.
    "giveaway-engagements": [
      ...(data.boosts ?? []).map((row) => ({ type: "boost", ...row })),
      ...(data.offers ?? []).map((row) => ({ type: "featured_offer", ...row })),
    ],
    "giveaway-prizes": prizes,
    "giveaway-streaks": data.streaks ?? [],
    giveaways: data.priorGiveaways ?? [],
    "giveaway-winners": data.priorWinners ?? [],
    "giveaway-account-flags": data.accountFlags ?? [],
  };

  // Prior-giveaway tickets share the collection with this giveaway's tickets.
  if (data.priorTickets?.length) {
    collections["giveaway-tickets"] = [
      ...collections["giveaway-tickets"],
      ...data.priorTickets,
    ];
  }

  const payload: any = {
    logger: {
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    },
    findByID: async ({ collection, id }: Row) => {
      if (collection === "giveaways") {
        return giveaway.id === id ? giveaway : null;
      }
      return collections[collection]?.find((row) => row.id === id) ?? null;
    },
    find: async ({ collection, where }: Row) => {
      const docs = (collections[collection] ?? []).filter((row) =>
        matchesWhere(row, where)
      );
      return { docs, totalDocs: docs.length };
    },
    create: async ({ collection, data: values }: Row) => {
      const row = {
        id: `${collection}-${(created[collection]?.length ?? 0) + 1}`,
        ...values,
      };
      created[collection] = [...(created[collection] ?? []), row];
      // Newly written rows are visible to later reads, as they would be in a
      // real database: the engine counts its own draw attempts, for one.
      // `created` keeps the same object references, so updates show in both.
      collections[collection] = [...(collections[collection] ?? []), row];
      return row;
    },
    update: async ({ collection, id, data: values }: Row) => {
      if (collection === "giveaways") {
        Object.assign(giveaway, values);
        return giveaway;
      }
      const row = collections[collection]?.find((item) => item.id === id);
      if (row) {
        Object.assign(row, values);
      }
      return row ?? { id, ...values };
    },
  };

  /**
   * Pre-populate rows that a previous draw attempt would have left behind.
   * Kept separate from `created` so tests can distinguish pre-existing records
   * from ones written by the run under test.
   */
  const seed = (collection: string, rows: Row[]) => {
    collections[collection] = [...(collections[collection] ?? []), ...rows];
  };

  return { payload, created, giveaway, prizes, seed };
}

/**
 * Evaluate the subset of Payload's query syntax the engine actually uses:
 * `{ and: [...] }` and `{ field: { equals: value } }`. Without this the fake
 * would return every row regardless of filter, quietly making the
 * ticket-status and completion-status tests pass for the wrong reason.
 */
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
        ? (actual as Row).id
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

/** N users each holding `perUser` valid tickets, boosts and offers. */
function participants(
  count: number,
  { tickets = 1, boosts = 0, offers = 0 } = {}
) {
  const ticketRows: Row[] = [];
  const boostRows: Row[] = [];
  const offerRows: Row[] = [];

  for (let i = 0; i < count; i += 1) {
    const user = `u${i}`;
    ticketRows.push({
      id: `t${i}`,
      user,
      giveaway: "g1",
      quantity: tickets,
      status: "valid",
    });
    for (let b = 0; b < boosts; b += 1) {
      boostRows.push({
        id: `b${i}-${b}`,
        user,
        giveaway: "g1",
        completionStatus: "completed",
      });
    }
    for (let o = 0; o < offers; o += 1) {
      offerRows.push({
        id: `o${i}-${o}`,
        user,
        giveaway: "g1",
        completionStatus: "completed",
      });
    }
  }

  return { ticketRows, boostRows, offerRows };
}

/**
 * A Winner Report sender that always succeeds. Passed to the engine so a draw
 * in a test never reaches for a mail provider, and so 19's thirteenth
 * checkpoint, which only closes when the report actually goes out, is
 * reachable here.
 */
function stubReportSender() {
  const sent: Row[] = [];
  return {
    sent,
    send: async (message: Row) => {
      sent.push(message);
      return { id: `msg-${sent.length}` };
    },
  };
}

function makeEngine(payload: any, sender = stubReportSender().send) {
  return new GiveawayEngine(payload, { reportSender: sender });
}

function prizeRow(
  id: string,
  tier: string,
  maxUnits: number,
  name = `prize-${id}`
) {
  return {
    id,
    giveaway: "g1",
    tier,
    maxUnits,
    unitsAwarded: 0,
    prize: { id: `cat-${id}`, name },
  };
}

describe("maxTierWinners (spec 3)", () => {
  it("rounds down", () => {
    expect(maxTierWinners(10_000, 0.1)).toBe(10);
    expect(maxTierWinners(10_000, 0.5)).toBe(50);
    expect(maxTierWinners(10_000, 5)).toBe(500);
    // 999 × 0.1% = 0.999 → 0
    expect(maxTierWinners(999, 0.1)).toBe(0);
  });

  it("treats 0% as a disabled tier", () => {
    expect(maxTierWinners(10_000, 0)).toBe(0);
  });
});

describe("evaluateEligibility (spec 11)", () => {
  const base: Participation = {
    userId: "u",
    validTickets: 0,
    boosts: 0,
    featuredOffers: 0,
    streaks: {},
  };

  it("qualifies Tier 1 on the primary path at exactly 10/3/1", () => {
    const p = { ...base, validTickets: 10, boosts: 3, featuredOffers: 1 };
    expect(evaluateEligibility("tier1", p)).toEqual({
      eligible: true,
      path: "primary",
    });
  });

  it("does not disqualify a user for exceeding a threshold", () => {
    // The legacy engine required boostLuck === 3 exactly; 4 boosts must qualify.
    const p = { ...base, validTickets: 25, boosts: 4, featuredOffers: 2 };
    expect(evaluateEligibility("tier1", p).eligible).toBe(true);
  });

  it("requires a featured offer for Tier 1", () => {
    const p = { ...base, validTickets: 10, boosts: 3, featuredOffers: 0 };
    expect(evaluateEligibility("tier1", p).eligible).toBe(false);
  });

  it("qualifies Tier 2 at 4/2/1", () => {
    const p = { ...base, validTickets: 4, boosts: 2, featuredOffers: 1 };
    expect(evaluateEligibility("tier2", p)).toEqual({
      eligible: true,
      path: "primary",
    });
  });

  it("qualifies Tier 3 on a single valid ticket with no engagement", () => {
    expect(evaluateEligibility("tier3", { ...base, validTickets: 1 })).toEqual({
      eligible: true,
      path: "primary",
    });
  });

  it("qualifies Tier 1 via the consecutive path on the fourth giveaway", () => {
    // Prior streak of 3, plus meeting the 3/3/1 bar now, makes four.
    const p = {
      ...base,
      validTickets: 3,
      boosts: 3,
      featuredOffers: 1,
      streaks: { tier1: 3 },
    };
    expect(evaluateEligibility("tier1", p)).toEqual({
      eligible: true,
      path: "consecutive",
    });
  });

  it("does not qualify via the consecutive path at a streak of two", () => {
    const p = {
      ...base,
      validTickets: 3,
      boosts: 3,
      featuredOffers: 1,
      streaks: { tier1: 2 },
    };
    expect(evaluateEligibility("tier1", p).eligible).toBe(false);
  });

  it("resets the streak when the bar is missed", () => {
    const missed = {
      ...base,
      validTickets: 3,
      boosts: 0,
      featuredOffers: 1,
      streaks: { tier1: 3 },
    };
    expect(nextStreakValue("tier1", missed)).toBe(0);

    const met = {
      ...base,
      validTickets: 3,
      boosts: 3,
      featuredOffers: 1,
      streaks: { tier1: 3 },
    };
    expect(nextStreakValue("tier1", met)).toBe(4);
  });
});

describe("streak persistence (spec 11)", () => {
  /** Runs a draw in which `participantIds` hold one valid ticket each. */
  async function drawWith(streaks: Row[], participantIds: string[]) {
    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: participantIds.map((user, i) => ({
        id: `t${i}`,
        user,
        giveaway: "g1",
        quantity: 1,
        status: "valid",
      })),
      prizes: [prizeRow("p3", "tier3", 50)],
      streaks,
    });

    await makeEngine(payload).runDraw("g1");
    return { streaks, created };
  }

  function streakRow(user: string, tier: string, consecutiveCount: number) {
    return {
      id: `s-${user}-${tier}`,
      user,
      tier,
      consecutiveCount,
      lastEvaluatedGiveaway: "g0",
    };
  }

  it("breaks the streak of a user who sits the giveaway out entirely", async () => {
    const rows = [streakRow("loyal", "tier1", 3)];
    // "loyal" bought nothing this time; someone else did.
    await drawWith(rows, ["someoneElse"]);

    expect(rows[0]?.consecutiveCount).toBe(0);
    expect(rows[0]?.lastEvaluatedGiveaway).toBe("g1");
  });

  it("breaks the streak of a participant who misses the tier bar", async () => {
    // One valid ticket is not enough for the tier1 consecutive bar (3/3/1).
    const rows = [streakRow("thin", "tier1", 3)];
    await drawWith(rows, ["thin"]);

    expect(rows[0]?.consecutiveCount).toBe(0);
  });

  it("advances the streak of a participant who meets the tier bar", async () => {
    const rows = [streakRow("keen", "tier1", 2)];
    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: [
        {
          id: "t1",
          user: "keen",
          giveaway: "g1",
          quantity: 3,
          status: "valid",
        },
      ],
      boosts: [1, 2, 3].map((n) => ({
        id: `b${n}`,
        user: "keen",
        giveaway: "g1",
        completionStatus: "completed",
      })),
      offers: [
        {
          id: "o1",
          user: "keen",
          giveaway: "g1",
          completionStatus: "completed",
        },
      ],
      prizes: [prizeRow("p3", "tier3", 50)],
      streaks: rows,
    });

    await makeEngine(payload).runDraw("g1");

    // Existing tier1 row advances 2 -> 3 in place.
    expect(rows[0]?.consecutiveCount).toBe(3);
    expect(rows[0]?.lastEvaluatedGiveaway).toBe("g1");

    // 3 tickets / 3 boosts / 1 offer also clears tier2's 2/2/1 bar, so a tier2
    // row is created for the first time.
    const tier2 = (created["giveaway-streaks"] ?? []).find(
      (row) => row.tier === "tier2"
    );
    expect(tier2?.consecutiveCount).toBe(1);
  });

  it("leaves a streak already at zero untouched", async () => {
    const rows = [streakRow("dormant", "tier1", 0)];
    rows[0]!.lastEvaluatedGiveaway = "g0";
    await drawWith(rows, ["someoneElse"]);

    expect(rows[0]?.consecutiveCount).toBe(0);
    // Not rewritten: avoids churning every dormant row on every draw.
    expect(rows[0]?.lastEvaluatedGiveaway).toBe("g0");
  });

  it("a gap prevents reaching four, so the consecutive path stays closed", () => {
    // Giveaways 1-3 qualified (streak 3), giveaway 4 was sat out (streak 0),
    // giveaway 5 qualifies again -> 1, not 4.
    const afterGap: Participation = {
      userId: "loyal",
      validTickets: 3,
      boosts: 3,
      featuredOffers: 1,
      streaks: { tier1: 0 },
    };

    expect(nextStreakValue("tier1", afterGap)).toBe(1);
    expect(evaluateEligibility("tier1", afterGap).eligible).toBe(false);
  });
});

describe("weightedPick", () => {
  it("selects proportionally to weight", () => {
    const rng = createRng("seed", "test");
    const counts = { heavy: 0, light: 0 };
    const items = [
      { key: "heavy" as const, weight: 90 },
      { key: "light" as const, weight: 10 },
    ];

    for (let i = 0; i < 10_000; i += 1) {
      const picked = weightedPick(items, (item) => item.weight, rng);
      counts[picked!.key] += 1;
    }

    expect(counts.heavy / 10_000).toBeGreaterThan(0.85);
    expect(counts.heavy / 10_000).toBeLessThan(0.95);
  });

  it("never selects a zero-weight item", () => {
    const rng = createRng("seed", "test");
    const items = [
      { key: "excluded", weight: 0 },
      { key: "only", weight: 5 },
    ];
    for (let i = 0; i < 200; i += 1) {
      expect(weightedPick(items, (item) => item.weight, rng)!.key).toBe("only");
    }
  });

  it("returns null when every weight is zero", () => {
    const rng = createRng("seed", "test");
    expect(weightedPick([{ w: 0 }], (item) => item.w, rng)).toBeNull();
  });
});

describe("GiveawayEngine.runDraw", () => {
  it("caps winners at floor(TVP × %) and never awards everyone", async () => {
    const { ticketRows } = participants(1000);
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 5,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 1000)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(result.totalValidParticipants).toBe(1000);
    // 5% of 1000 = 50, not 1000.
    expect(result.totalWinners).toBe(50);
  });

  it("caps winners at available prize units when units are scarcer", async () => {
    const { ticketRows } = participants(1000);
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 5,
      },
      tickets: ticketRows,
      // 50 allowed by percentage, but only 7 units exist.
      prizes: [prizeRow("p3", "tier3", 7)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(result.totalWinners).toBe(7);
    const tier3 = result.tiers.find((t) => t.tier === "tier3")!;
    expect(tier3.maxWinnersByPercentage).toBe(50);
    expect(tier3.unitsAvailable).toBe(7);
    expect(tier3.effectiveCap).toBe(7);
  });

  it("caps winners at candidate pool size when the pool is smallest", async () => {
    // 100 participants, but only 3 satisfy Tier 1.
    const { ticketRows, boostRows, offerRows } = participants(3, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });
    const filler = participants(97).ticketRows.map((row, i) => ({
      ...row,
      id: `filler-${i}`,
      user: `filler-${i}`,
    }));

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 50,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets: [...ticketRows, ...filler],
      boosts: boostRows,
      offers: offerRows,
      prizes: [prizeRow("p1", "tier1", 100)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    const tier1 = result.tiers.find((t) => t.tier === "tier1")!;
    expect(tier1.candidatePoolSize).toBe(3);
    expect(tier1.maxWinnersByPercentage).toBe(50);
    expect(tier1.winners.length).toBe(3);
  });

  it("never allocates more units of a prize than its Maximum Units", async () => {
    const { ticketRows } = participants(500);
    const { payload, prizes } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: ticketRows,
      prizes: [
        prizeRow("a", "tier3", 2, "Laptop"),
        prizeRow("b", "tier3", 5, "Airtime"),
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    // Capped by total units (7), not the 100% percentage.
    expect(result.totalWinners).toBe(7);

    const awarded = new Map<string, number>();
    for (const tier of result.tiers) {
      for (const winner of tier.winners) {
        awarded.set(winner.prizeName, (awarded.get(winner.prizeName) ?? 0) + 1);
      }
    }
    expect(awarded.get("Laptop") ?? 0).toBeLessThanOrEqual(2);
    expect(awarded.get("Airtime") ?? 0).toBeLessThanOrEqual(5);
    expect(prizes.every((p) => p.unitsAwarded === 0)).toBe(true); // dry run
  });

  it("gives every selected winner a prize", async () => {
    const { ticketRows } = participants(200);
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 10,
      },
      tickets: ticketRows,
      prizes: [prizeRow("a", "tier3", 3), prizeRow("b", "tier3", 4)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    for (const tier of result.tiers) {
      for (const winner of tier.winners) {
        expect(winner.prizeId).toBeTruthy();
        expect(winner.prizeName).toBeTruthy();
      }
    }
  });

  it("enforces one prize per user across all tiers (spec 13)", async () => {
    // Every user qualifies for all three tiers simultaneously.
    const { ticketRows, boostRows, offerRows } = participants(200, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 10,
        tier2WinnerPercentage: 20,
        tier3WinnerPercentage: 30,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [
        prizeRow("p1", "tier1", 100),
        prizeRow("p2", "tier2", 100),
        prizeRow("p3", "tier3", 100),
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    const winnerKeys = result.tiers.flatMap((tier) =>
      tier.winners.map((winner) => winner.userKey)
    );
    expect(new Set(winnerKeys).size).toBe(winnerKeys.length);
    expect(result.totalWinners).toBe(20 + 40 + 60);
  });

  it("shrinks lower-tier pools as higher tiers take winners", async () => {
    const { ticketRows, boostRows, offerRows } = participants(100, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 10,
        tier2WinnerPercentage: 10,
        tier3WinnerPercentage: 10,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [
        prizeRow("p1", "tier1", 50),
        prizeRow("p2", "tier2", 50),
        prizeRow("p3", "tier3", 50),
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    const [t1, t2, t3] = result.tiers;
    expect(t1!.candidatePoolSize).toBe(100);
    expect(t2!.candidatePoolSize).toBe(90); // 10 removed by Tier 1
    expect(t3!.candidatePoolSize).toBe(80); // 10 more removed by Tier 2
  });

  it("holds Total Valid Participants constant across tiers", async () => {
    const { ticketRows, boostRows, offerRows } = participants(1000, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 1,
        tier2WinnerPercentage: 1,
        tier3WinnerPercentage: 1,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [
        prizeRow("p1", "tier1", 500),
        prizeRow("p2", "tier2", 500),
        prizeRow("p3", "tier3", 500),
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    // 1% of the unchanging 1000 in every tier, despite the pool shrinking.
    for (const tier of result.tiers) {
      expect(tier.maxWinnersByPercentage).toBe(10);
      expect(tier.winners.length).toBe(10);
    }
  });

  it("excludes cancelled, refunded, reversed, unpaid and fraudulent tickets", async () => {
    const tickets = [
      {
        id: "t1",
        user: "valid1",
        giveaway: "g1",
        quantity: 1,
        status: "valid",
      },
      {
        id: "t2",
        user: "valid2",
        giveaway: "g1",
        quantity: 1,
        status: "valid",
      },
      {
        id: "t3",
        user: "x1",
        giveaway: "g1",
        quantity: 5,
        status: "cancelled",
      },
      { id: "t4", user: "x2", giveaway: "g1", quantity: 5, status: "refunded" },
      { id: "t5", user: "x3", giveaway: "g1", quantity: 5, status: "reversed" },
      { id: "t6", user: "x4", giveaway: "g1", quantity: 5, status: "unpaid" },
      {
        id: "t7",
        user: "x5",
        giveaway: "g1",
        quantity: 5,
        status: "fraudulent",
      },
    ];

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets,
      prizes: [prizeRow("p3", "tier3", 100)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(result.totalValidParticipants).toBe(2);
    const keys = result.tiers.flatMap((t) => t.winners.map((w) => w.userKey));
    expect(keys.sort()).toEqual(["valid1", "valid2"]);
  });

  it("aggregates multiple purchases by the same user", async () => {
    // 5 tickets on day 1 + 5 on day 3 = 10, enough for Tier 1.
    const tickets = [
      { id: "d1", user: "u1", giveaway: "g1", quantity: 5, status: "valid" },
      { id: "d3", user: "u1", giveaway: "g1", quantity: 5, status: "valid" },
    ];
    const boosts = [1, 2, 3].map((n) => ({
      id: `b${n}`,
      user: "u1",
      giveaway: "g1",
      completionStatus: "completed",
    }));
    const offers = [
      { id: "o1", user: "u1", giveaway: "g1", completionStatus: "completed" },
    ];

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets,
      boosts,
      offers,
      prizes: [prizeRow("p1", "tier1", 5)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    // One unique user, aggregated to 10 tickets → Tier 1 eligible.
    expect(result.totalValidParticipants).toBe(1);
    expect(
      result.tiers.find((t) => t.tier === "tier1")!.candidatePoolSize
    ).toBe(1);
    expect(result.totalWinners).toBe(1);
  });

  it("ignores boosts and offers that were not completed", async () => {
    const tickets = [
      { id: "t1", user: "u1", giveaway: "g1", quantity: 10, status: "valid" },
    ];
    const boosts = ["abandoned", "failed", "incomplete"].map((status, i) => ({
      id: `b${i}`,
      user: "u1",
      giveaway: "g1",
      completionStatus: status,
    }));

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets,
      boosts,
      prizes: [prizeRow("p1", "tier1", 5)],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(
      result.tiers.find((t) => t.tier === "tier1")!.candidatePoolSize
    ).toBe(0);
  });

  it("splits Boosts from Featured Offers by type within one collection", async () => {
    // Tier 1 needs 10 tickets / 3 boosts / 1 offer. This user has four
    // engagement rows in the single collection: three boosts and one offer.
    // If `type` were ignored and all four counted as boosts, the offer
    // requirement would be unmet and the pool would be empty.
    const engagements = [
      { id: "e1", user: "u1", giveaway: "g1", type: "boost" },
      { id: "e2", user: "u1", giveaway: "g1", type: "boost" },
      { id: "e3", user: "u1", giveaway: "g1", type: "boost" },
      { id: "e4", user: "u1", giveaway: "g1", type: "featured_offer" },
      // An unrecognised type must count towards neither tally.
      { id: "e5", user: "u1", giveaway: "g1", type: "connect_brand" },
    ].map((row) => ({ ...row, completionStatus: "completed" }));

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets: [
        { id: "t1", user: "u1", giveaway: "g1", quantity: 10, status: "valid" },
      ],
      boosts: engagements,
      prizes: [prizeRow("p1", "tier1", 5)],
    });

    const result = await makeEngine(payload).runDraw("g1");

    expect(
      result.tiers.find((t) => t.tier === "tier1")?.candidatePoolSize
    ).toBe(1);

    const winner = (result.tiers.flatMap((t) => t.winners) ?? [])[0];
    expect(winner?.userKey).toBe("u1");
  });

  it("records the split tallies on the winner record", async () => {
    const engagements = [
      { id: "e1", user: "u1", giveaway: "g1", type: "boost" },
      { id: "e2", user: "u1", giveaway: "g1", type: "boost" },
      { id: "e3", user: "u1", giveaway: "g1", type: "boost" },
      { id: "e4", user: "u1", giveaway: "g1", type: "featured_offer" },
      { id: "e5", user: "u1", giveaway: "g1", type: "featured_offer" },
    ].map((row) => ({ ...row, completionStatus: "completed" }));

    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets: [
        { id: "t1", user: "u1", giveaway: "g1", quantity: 10, status: "valid" },
      ],
      boosts: engagements,
      prizes: [prizeRow("p1", "tier1", 5)],
    });

    await makeEngine(payload).runDraw("g1");

    const winner = (created["giveaway-winners"] ?? [])[0];
    expect(winner?.boostCount).toBe(3);
    expect(winner?.featuredOfferCount).toBe(2);
  });

  it("weights selection by ticket count", async () => {
    // One user holds 100 tickets among 100 users holding 1 each.
    const tickets: Row[] = [
      {
        id: "whale",
        user: "whale",
        giveaway: "g1",
        quantity: 100,
        status: "valid",
      },
    ];
    for (let i = 0; i < 100; i += 1) {
      tickets.push({
        id: `t${i}`,
        user: `u${i}`,
        giveaway: "g1",
        quantity: 1,
        status: "valid",
      });
    }

    let whaleWins = 0;
    const runs = 60;

    for (let run = 0; run < runs; run += 1) {
      const { payload } = createFakePayload({
        giveaway: {
          tier1WinnerPercentage: 0,
          tier2WinnerPercentage: 0,
          tier3WinnerPercentage: 1,
        },
        tickets,
        prizes: [prizeRow("p3", "tier3", 10)],
      });
      const result = await makeEngine(payload).runDraw("g1", {
        dryRun: true,
        seed: `seed-${run}`,
      });
      if (
        result.tiers.some((t) => t.winners.some((w) => w.userKey === "whale"))
      ) {
        whaleWins += 1;
      }
    }

    // Holding half the entries, the whale should win far more often than 1/101.
    expect(whaleWins).toBeGreaterThan(runs * 0.25);
  });

  it("is deterministic for a given seed and divergent across seeds", async () => {
    const { ticketRows } = participants(300);
    const build = () =>
      createFakePayload({
        giveaway: {
          tier1WinnerPercentage: 0,
          tier2WinnerPercentage: 0,
          tier3WinnerPercentage: 5,
        },
        tickets: ticketRows,
        prizes: [prizeRow("p3", "tier3", 100)],
      }).payload;

    const a = await new GiveawayEngine(build()).runDraw("g1", {
      dryRun: true,
      seed: "fixed-seed",
    });
    const b = await new GiveawayEngine(build()).runDraw("g1", {
      dryRun: true,
      seed: "fixed-seed",
    });
    const c = await new GiveawayEngine(build()).runDraw("g1", {
      dryRun: true,
      seed: "different-seed",
    });

    expect(a.tiers).toEqual(b.tiers);
    expect(c.tiers).not.toEqual(a.tiers);
  });

  it("dry run persists nothing", async () => {
    const { ticketRows } = participants(50);
    const { payload, created, prizes, giveaway } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 5,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 10)],
    });

    await makeEngine(payload).runDraw("g1", { dryRun: true });

    expect(created["giveaway-winners"]).toBeUndefined();
    expect(created["giveaway-audit-log"]).toBeUndefined();
    expect(prizes[0]!.unitsAwarded).toBe(0);
    expect(giveaway.status).toBe("active");
  });

  it("persists winners, unit counters and audit records on a real run", async () => {
    const { ticketRows } = participants(100);
    const { payload, created, prizes, giveaway } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 5,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 10)],
    });

    const result = await makeEngine(payload).runDraw("g1");

    expect(result.totalWinners).toBe(5);
    expect(created["giveaway-winners"]).toHaveLength(5);
    expect(prizes[0]!.unitsAwarded).toBe(5);
    expect(giveaway.status).toBe("completed");
    expect(giveaway.totalValidParticipants).toBe(100);
    expect(giveaway.drawSeed).toBeTruthy();

    const events = (created["giveaway-audit-log"] ?? []).map(
      (row) => row.eventType
    );
    expect(events).toContain("participants_snapshot");
    expect(events).toContain("candidate_pool_built");
    expect(events).toContain("winner_selected");
    expect(events).toContain("prize_allocated");
    expect(events).toContain("draw_completed");
  });

  it("records the winning ticket and participation snapshot on each winner", async () => {
    const { ticketRows, boostRows, offerRows } = participants(10, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });
    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [prizeRow("p1", "tier1", 3, "Laptop")],
    });

    await makeEngine(payload).runDraw("g1");

    for (const winner of created["giveaway-winners"] ?? []) {
      expect(winner.winningTicket).toBeTruthy();
      expect(winner.validTicketCount).toBe(10);
      expect(winner.boostCount).toBe(3);
      expect(winner.featuredOfferCount).toBe(1);
      expect(winner.prizeName).toBe("Laptop");
      expect(winner.claimStatus).toBe("unclaimed");
    }
  });
});

describe("fairness and anti-abuse in a real draw (spec 22)", () => {
  /** A completed giveaway that ended `daysAgo` days back. */
  const priorGiveaway = (id: string, daysAgo: number) => ({
    id,
    status: "completed",
    endDate: new Date(Date.now() - daysAgo * 864e5).toISOString(),
  });

  it("bars last draw's Tier 1 winner from Tier 1 and Tier 2, but not Tier 3", async () => {
    // Everyone qualifies for all three tiers, so any exclusion is fairness.
    const { ticketRows, boostRows, offerRows } = participants(20, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });

    const { payload } = createFakePayload({
      giveaway: {
        // All zero: pool sizes are still computed, but nobody wins, so no one
        // is removed between tiers. That isolates the fairness exclusion from
        // the one-prize-per-user rule.
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [
        prizeRow("p1", "tier1", 50),
        prizeRow("p2", "tier2", 50),
        prizeRow("p3", "tier3", 50),
      ],
      priorGiveaways: [priorGiveaway("g0", 14)],
      // u0 won Tier 1 in the previous giveaway.
      priorWinners: [{ id: "w0", giveaway: "g0", user: "u0", tier: "tier1" }],
      priorTickets: [
        { id: "pt0", giveaway: "g0", user: "u0", quantity: 5, status: "valid" },
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    const pool = (tier: string) =>
      result.tiers.find((t) => t.tier === tier)?.candidatePoolSize;

    // 19 of 20 for the high tiers: u0 is serving 22.1 and 22.2.
    expect(pool("tier1")).toBe(19);
    expect(pool("tier2")).toBe(19);

    // Tier 3 stays fully open: the spec is explicit that a high-tier winner
    // may still win Tier 3 during the cooldown.
    expect(pool("tier3")).toBe(20);
  });

  it("keeps last draw's Tier 1 winner out of the high tiers when they do run", async () => {
    const { ticketRows, boostRows, offerRows } = participants(20, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 100,
        tier3WinnerPercentage: 0,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [prizeRow("p1", "tier1", 50), prizeRow("p2", "tier2", 50)],
      priorGiveaways: [priorGiveaway("g0", 14)],
      priorWinners: [{ id: "w0", giveaway: "g0", user: "u0", tier: "tier1" }],
      priorTickets: [
        { id: "pt0", giveaway: "g0", user: "u0", quantity: 5, status: "valid" },
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    const winners = result.tiers.flatMap((t) =>
      t.winners.map((w) => w.userKey)
    );
    expect(winners).not.toContain("u0");
    expect(winners).toHaveLength(19);
  });

  it("waives the Featured Offer for a user who has gone four draws without a prize", async () => {
    // "loyal" meets Tier 1's ticket and boost bars but has NO featured offer,
    // so only the 22.4 waiver can put them in the pool.
    const tickets = [
      {
        id: "t0",
        user: "loyal",
        giveaway: "g1",
        quantity: 10,
        status: "valid",
      },
    ];
    const boosts = [1, 2, 3].map((n) => ({
      id: `b${n}`,
      user: "loyal",
      giveaway: "g1",
      completionStatus: "completed",
    }));

    const priorIds = ["g0", "g-1", "g-2", "g-3"];
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets,
      boosts,
      prizes: [prizeRow("p1", "tier1", 5)],
      priorGiveaways: priorIds.map((id, i) => priorGiveaway(id, (i + 1) * 14)),
      priorWinners: [],
      // Took part in all four, won nothing.
      priorTickets: priorIds.map((gid, i) => ({
        id: `pt${i}`,
        giveaway: gid,
        user: "loyal",
        quantity: 3,
        status: "valid",
      })),
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(
      result.tiers.find((t) => t.tier === "tier1")?.candidatePoolSize
    ).toBe(1);
  });

  it("does not waive the Featured Offer when a draw was sat out", async () => {
    const tickets = [
      {
        id: "t0",
        user: "gappy",
        giveaway: "g1",
        quantity: 10,
        status: "valid",
      },
    ];
    const boosts = [1, 2, 3].map((n) => ({
      id: `b${n}`,
      user: "gappy",
      giveaway: "g1",
      completionStatus: "completed",
    }));

    const priorIds = ["g0", "g-1", "g-2", "g-3"];
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 100,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets,
      boosts,
      prizes: [prizeRow("p1", "tier1", 5)],
      priorGiveaways: priorIds.map((id, i) => priorGiveaway(id, (i + 1) * 14)),
      // Sat out "g-1", so there is no run of four.
      priorTickets: ["g0", "g-2", "g-3"].map((gid, i) => ({
        id: `pt${i}`,
        giveaway: gid,
        user: "gappy",
        quantity: 3,
        status: "valid",
      })),
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(
      result.tiers.find((t) => t.tier === "tier1")?.candidatePoolSize
    ).toBe(0);
  });

  it("excludes a disqualified account from the pool and from the participant count", async () => {
    const { ticketRows } = participants(10);

    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 50)],
      accountFlags: [
        { id: "f1", user: "u0", trustStatus: "disqualified", reason: "Bots" },
        {
          id: "f2",
          user: "u1",
          trustStatus: "ok",
          duplicateAccountGroup: "DUP-1",
        },
      ],
    });

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    // Both come out of the denominator, not just the pool.
    expect(result.totalValidParticipants).toBe(8);

    const winners = result.tiers.flatMap((t) =>
      t.winners.map((w) => w.userKey)
    );
    expect(winners).not.toContain("u0");
    expect(winners).not.toContain("u1");
  });

  it("lets a suspicious account win, but holds the prize for review", async () => {
    const { ticketRows } = participants(3);

    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 10)],
      accountFlags: [
        {
          id: "f1",
          user: "u0",
          trustStatus: "suspicious",
          reason: "Unusual purchase pattern",
        },
      ],
    });

    const result = await makeEngine(payload).runDraw("g1");

    // Suspicion must never alter the selection (22.8): u0 still competes.
    expect(result.totalValidParticipants).toBe(3);

    const rows = created["giveaway-winners"] ?? [];
    const flagged = rows.find((r) => r.user === "u0");
    const clean = rows.find((r) => r.user !== "u0");

    expect(flagged?.fulfilmentStatus).toBe("on_hold");
    expect(flagged?.reviewNote).toContain("review");
    expect(clean?.fulfilmentStatus).toBe("pending");
  });
});

describe("pool lock and replacement winners (spec 12)", () => {
  /**
   * Runs a real Tier 3 draw over `count` participants producing exactly
   * `maxUnits` winners. Tier 3 is set to 100% so the prize stock is what caps
   * the winner count, deriving a percentage instead runs into floating point
   * (a 1-in-6 share evaluates to 0.9999…, which floors to zero winners).
   */
  async function drawnGiveaway(count: number, maxUnits: number) {
    const { ticketRows } = participants(count);
    const fake = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", maxUnits)],
    });

    const result = await makeEngine(fake.payload).runDraw("g1");
    return { ...fake, result };
  }

  it("locks a pool snapshot per tier, even when the tier awards nobody", async () => {
    const { ticketRows } = participants(6);
    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 50,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 10)],
    });

    await makeEngine(payload).runDraw("g1");

    const snapshots = created["giveaway-pool-snapshots"] ?? [];
    // One per tier, including the two that awarded nothing.
    expect(snapshots).toHaveLength(3);

    const tier3 = snapshots.find((s) => s.tier === "tier3");
    expect(tier3?.candidateCount).toBe(6);
    expect(tier3?.entries).toHaveLength(6);

    // Tier 1 and Tier 2 have empty pools: nobody met their thresholds.
    expect(snapshots.find((s) => s.tier === "tier1")?.candidateCount).toBe(0);
  });

  it("does not lock a pool on a dry run", async () => {
    const { ticketRows } = participants(5);
    const { payload, created } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 50,
      },
      tickets: ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    await makeEngine(payload).runDraw("g1", { dryRun: true });
    expect(created["giveaway-pool-snapshots"]).toBeUndefined();
  });

  it("replaces a disqualified winner from the locked pool", async () => {
    const { payload, created, seed } = await drawnGiveaway(10, 2);

    const winners = created["giveaway-winners"] ?? [];
    expect(winners).toHaveLength(2);

    // The fake serves finds from `collections`, so mirror the draw's writes.
    seed("giveaway-winners", winners);
    seed("giveaway-pool-snapshots", created["giveaway-pool-snapshots"] ?? []);

    const target = winners[0]!;
    const outcome = await makeEngine(payload).replaceWinner(target.id, {
      reason: "Ticket charged back",
    });

    expect(outcome.replaced).toBe(true);

    // Original is kept, marked disqualified, and its prize withheld.
    expect(target.claimStatus).toBe("disqualified");
    expect(target.fulfilmentStatus).toBe("cancelled");
    expect(target.disqualificationReason).toBe("Ticket charged back");

    const replacement = (created["giveaway-winners"] ?? []).at(-1);
    expect(replacement?.replaces).toBe(target.id);
    expect(replacement?.prizeName).toBe(target.prizeName);
    expect(replacement?.tier).toBe(target.tier);
  });

  it("never draws a replacement who already holds a prize", async () => {
    const { payload, created, seed } = await drawnGiveaway(6, 3);

    const winners = created["giveaway-winners"] ?? [];
    seed("giveaway-winners", winners);
    seed("giveaway-pool-snapshots", created["giveaway-pool-snapshots"] ?? []);

    const existingWinnerIds = winners.map((w) => w.user);

    const outcome = await makeEngine(payload).replaceWinner(winners[0]!.id, {
      reason: "Fraud confirmed",
    });

    expect(outcome.replaced).toBe(true);
    if (outcome.replaced) {
      expect(existingWinnerIds).not.toContain(outcome.userKey);
    }
  });

  it("refuses to disqualify a prize that has already been fulfilled", async () => {
    const { payload, created, seed } = await drawnGiveaway(6, 1);

    const winners = created["giveaway-winners"] ?? [];
    winners[0]!.fulfilmentStatus = "fulfilled";
    seed("giveaway-winners", winners);
    seed("giveaway-pool-snapshots", created["giveaway-pool-snapshots"] ?? []);

    const outcome = await makeEngine(payload).replaceWinner(winners[0]!.id, {
      reason: "Too late",
    });

    expect(outcome.replaced).toBe(false);
    if (!outcome.replaced) {
      expect(outcome.message).toMatch(/already been fulfilled/);
    }
    expect(winners[0]?.claimStatus).not.toBe("disqualified");
  });

  it("still disqualifies when the pool has nobody left to draw", async () => {
    // Every participant wins, so no replacement is available.
    const { payload, created, seed } = await drawnGiveaway(3, 3);

    const winners = created["giveaway-winners"] ?? [];
    seed("giveaway-winners", winners);
    seed("giveaway-pool-snapshots", created["giveaway-pool-snapshots"] ?? []);

    const outcome = await makeEngine(payload).replaceWinner(winners[0]!.id, {
      reason: "Refunded",
    });

    expect(outcome.replaced).toBe(false);
    // The disqualification must still stand: the prize is withheld either way.
    expect(winners[0]?.claimStatus).toBe("disqualified");
    expect(winners[0]?.fulfilmentStatus).toBe("cancelled");
  });

  it("will not disqualify the same winner twice", async () => {
    const { payload, created, seed } = await drawnGiveaway(8, 2);

    const winners = created["giveaway-winners"] ?? [];
    seed("giveaway-winners", winners);
    seed("giveaway-pool-snapshots", created["giveaway-pool-snapshots"] ?? []);

    const drawEngine = makeEngine(payload);
    await drawEngine.replaceWinner(winners[0]!.id, { reason: "First" });
    const second = await drawEngine.replaceWinner(winners[0]!.id, {
      reason: "Second",
    });

    expect(second.replaced).toBe(false);
    if (!second.replaced) {
      expect(second.message).toMatch(/already been disqualified/);
    }
  });
});

describe("resuming an interrupted draw (spec 19)", () => {
  /**
   * A giveaway whose Tier 1 completed and awarded `tier1Winners`, then was
   * interrupted before Tier 2: the state a mid-draw crash leaves behind.
   */
  function partiallyDrawn(tier1Winners: string[]) {
    const { ticketRows, boostRows, offerRows } = participants(100, {
      tickets: 10,
      boosts: 3,
      offers: 1,
    });

    const fake = createFakePayload({
      giveaway: {
        status: "interrupted",
        drawSeed: "original-seed",
        drawExecutionId: "exec-1",
        lastCheckpoint: "tier1_prizes_allocated",
        drawError: "database unavailable",
        totalValidParticipants: 100,
        tier1WinnerPercentage: 5,
        tier2WinnerPercentage: 5,
        tier3WinnerPercentage: 5,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [
        { ...prizeRow("p1", "tier1", 50), unitsAwarded: tier1Winners.length },
        prizeRow("p2", "tier2", 50),
        prizeRow("p3", "tier3", 50),
      ],
    });

    // Winner rows and the tier_completed marker the failed attempt left behind.
    fake.seed(
      "giveaway-winners",
      tier1Winners.map((user, i) => ({
        id: `w${i}`,
        giveaway: "g1",
        user,
        tier: "tier1",
        prize: "cat-p1",
        prizeName: "prize-p1",
        winningTicket: `t${i}`,
      }))
    );
    fake.seed("giveaway-audit-log", [
      {
        id: "a1",
        giveaway: "g1",
        eventType: "tier_completed",
        tier: "tier1",
        message: "tier1 complete",
      },
    ]);

    return fake;
  }

  /**
   * The 19 workflow in full: an administrator reviews the interruption and
   * authorizes it, and only then may the draw continue.
   */
  async function authorizeAndResume(payload: any) {
    const drawEngine = makeEngine(payload);
    await drawEngine.authorizeResumption("g1", {
      authorizedBy: "admin@newsspend.com",
    });
    return drawEngine.runDraw("g1", { resume: true });
  }

  it("refuses to re-run an interrupted draw as a fresh draw", async () => {
    const { payload } = partiallyDrawn(["u0", "u1", "u2", "u3", "u4"]);

    await expect(makeEngine(payload).runDraw("g1")).rejects.toThrow(
      /administrator must authorize its resumption/
    );
  });

  it("refuses to resume without authorization", async () => {
    const { payload } = partiallyDrawn(["u0"]);

    // Asking to resume is not the same as being allowed to: the giveaway is
    // still INTERRUPTED, so the gate holds.
    await expect(
      makeEngine(payload).runDraw("g1", { resume: true })
    ).rejects.toThrow(/resumption has been authorized/);
  });

  it("records the authorization and keeps the execution id across attempts", async () => {
    const { payload, giveaway, created } = partiallyDrawn(["u0"]);

    const result = await authorizeAndResume(payload);

    expect(result.executionId).toBe("exec-1");
    expect(giveaway.resumptionAuthorizedBy).toBe("admin@newsspend.com");

    const attempt = (created["giveaway-draw-attempts"] ?? [])[0];
    expect(attempt?.kind).toBe("resumption");
    expect(attempt?.executionId).toBe("exec-1");
    expect(attempt?.seed).toBe("original-seed");
    expect(attempt?.authorizedBy).toBe("admin@newsspend.com");
    expect(attempt?.outcome).toBe("completed");

    const events = (created["giveaway-audit-log"] ?? []).map(
      (e) => e.eventType
    );
    expect(events).toContain("resumption_authorized");
  });

  it("continues from the checkpoint the interruption left behind", async () => {
    const { payload, giveaway } = partiallyDrawn(["u0"]);

    const result = await authorizeAndResume(payload);

    // Tier 1's checkpoints were already passed, so they are not rewritten; the
    // draw runs on to the end of the sequence.
    expect(result.lastCheckpoint).toBe("winner_report_generated");
    expect(giveaway.lastCheckpoint).toBe("winner_report_generated");
  });

  it("does not award a second prize to an existing winner", async () => {
    const priorWinners = ["u0", "u1", "u2", "u3", "u4"];
    const { payload, created } = partiallyDrawn(priorWinners);

    const result = await authorizeAndResume(payload);

    // Nobody who already won appears again in the newly drawn tiers.
    const freshWinners = result.tiers
      .filter((tier) => !tier.skipped)
      .flatMap((tier) => tier.winners.map((winner) => winner.userKey));

    for (const prior of priorWinners) {
      expect(freshWinners).not.toContain(prior);
    }

    // And no duplicate winner rows were written for them.
    const writtenUsers = (created["giveaway-winners"] ?? []).map((w) => w.user);
    for (const prior of priorWinners) {
      expect(writtenUsers).not.toContain(prior);
    }
  });

  it("replays the completed tier from records instead of re-drawing it", async () => {
    const priorWinners = ["u0", "u1", "u2", "u3", "u4"];
    const { payload, created, prizes } = partiallyDrawn(priorWinners);

    const result = await authorizeAndResume(payload);

    const tier1 = result.tiers.find((t) => t.tier === "tier1")!;
    expect(tier1.skipped).toBe(true);
    expect(tier1.winners.map((w) => w.userKey).sort()).toEqual(
      [...priorWinners].sort()
    );

    // Tier 1's unit counter is untouched; Tier 2 and 3 draw fresh.
    expect(prizes[0]?.unitsAwarded).toBe(5);
    expect(
      (created["giveaway-winners"] ?? []).every((w) => w.tier !== "tier1")
    ).toBe(true);
  });

  it("reuses the original seed and participant snapshot", async () => {
    const { payload, created, giveaway } = partiallyDrawn(["u0"]);

    const result = await authorizeAndResume(payload);

    expect(result.seed).toBe("original-seed");
    expect(giveaway.drawSeed).toBe("original-seed");
    expect(result.totalValidParticipants).toBe(100);

    // The snapshot is not retaken on a resume.
    const events = (created["giveaway-audit-log"] ?? []).map(
      (e) => e.eventType
    );
    expect(events).not.toContain("participants_snapshot");
    expect(events).toContain("draw_resumed");
  });

  it("completes the giveaway and clears the error", async () => {
    const { payload, giveaway } = partiallyDrawn(["u0"]);

    await authorizeAndResume(payload);

    expect(giveaway.status).toBe("completed");
    expect(giveaway.drawError).toBeNull();
  });

  it("refuses to authorize a resumption for a giveaway that is running normally", async () => {
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 5,
      },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const authorization = await makeEngine(payload).authorizeResumption("g1", {
      authorizedBy: "admin@newsspend.com",
    });

    expect(authorization.authorized).toBe(false);
    expect(authorization.message).toMatch(/Only an interrupted or failed draw/);
  });

  it("counts a half-drawn tier's winners against its percentage cap", async () => {
    const { ticketRows } = participants(100);

    const fake = createFakePayload({
      giveaway: {
        status: "interrupted",
        drawSeed: "original-seed",
        lastCheckpoint: "tier2_prizes_allocated",
        totalValidParticipants: 100,
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        // 5% of 100 = 5 winners for the whole giveaway, not per attempt.
        tier3WinnerPercentage: 5,
      },
      tickets: ticketRows,
      prizes: [{ ...prizeRow("p3", "tier3", 50), unitsAwarded: 2 }],
    });

    // Tier 3 awarded two winners and then stopped: no completion marker, so
    // it will be drawn again. Its allowance is 3, not another 5.
    fake.seed(
      "giveaway-winners",
      ["u0", "u1"].map((user, i) => ({
        id: `w${i}`,
        giveaway: "g1",
        user,
        tier: "tier3",
        prize: "cat-p3",
        prizeName: "prize-p3",
        winningTicket: `t${i}`,
      }))
    );

    const result = await authorizeAndResume(fake.payload);

    const tier3 = result.tiers.find((t) => t.tier === "tier3")!;
    expect(tier3.effectiveCap).toBe(3);
    expect(tier3.winners).toHaveLength(5);
    expect((fake.created["giveaway-winners"] ?? []).length).toBe(3);
  });

  it("does not advance a streak twice across a resume", async () => {
    const { ticketRows, boostRows, offerRows } = participants(3, {
      tickets: 3,
      boosts: 3,
      offers: 1,
    });

    const streaks = [
      {
        id: "s0",
        user: "u0",
        tier: "tier1",
        consecutiveCount: 2,
        // Already advanced by this giveaway during the failed attempt.
        lastEvaluatedGiveaway: "g1",
      },
    ];

    const fake = createFakePayload({
      giveaway: {
        status: "interrupted",
        drawSeed: "original-seed",
        lastCheckpoint: "tier1_prizes_allocated",
        totalValidParticipants: 3,
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
      },
      tickets: ticketRows,
      boosts: boostRows,
      offers: offerRows,
      prizes: [prizeRow("p3", "tier3", 10)],
      streaks,
    });

    await authorizeAndResume(fake.payload);

    expect(streaks[0]?.consecutiveCount).toBe(2);
  });
});

describe("GiveawayEngine.validateDraw (spec 19)", () => {
  it("refuses to start when no prizes are configured", async () => {
    const { payload } = createFakePayload({
      tickets: participants(10).ticketRows,
      prizes: [],
    });

    await expect(makeEngine(payload).runDraw("g1")).rejects.toThrow(
      GiveawayEngineError
    );

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/No prizes have been configured/);
  });

  it("refuses to start when an enabled tier has an empty prize pool", async () => {
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 1,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 0,
      },
      tickets: participants(10).ticketRows,
      // Only a tier3 prize exists, but tier1 is enabled.
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/tier1 is enabled .* Prize Pool is empty/);
  });

  it("refuses to start before the countdown ends", async () => {
    const { payload } = createFakePayload({
      giveaway: { endDate: new Date(Date.now() + 3_600_000).toISOString() },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/countdown has not ended/);
  });

  it("refuses to repeat a completed draw", async () => {
    const { payload } = createFakePayload({
      giveaway: { status: "completed" },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/cannot be repeated/);
  });

  it("rejects a prize row with a non-integer Maximum Units", async () => {
    const { payload } = createFakePayload({
      tickets: participants(10).ticketRows,
      prizes: [{ ...prizeRow("p3", "tier3", 5), maxUnits: 2.5 }],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/valid Maximum Units/);
  });

  it("interrupts rather than fails when a draw throws part-way through", async () => {
    const { payload, giveaway } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 50,
      },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    payload.create = async ({ collection }: Row) => {
      if (collection === "giveaway-winners") {
        throw new Error("database unavailable");
      }
      return { id: "x" };
    };

    await expect(makeEngine(payload).runDraw("g1")).rejects.toThrow(
      /database unavailable/
    );
    // An interruption preserves everything and waits for an administrator; it
    // is not a failure, because the draw can be picked up where it stopped.
    expect(giveaway.status).toBe("interrupted");
    expect(giveaway.drawError).toMatch(/database unavailable/);
    expect(giveaway.lastCheckpoint).toBeTruthy();
  });

  it("fails outright when the integrity check finds a broken invariant", async () => {
    const { payload, giveaway, prizes } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 50,
      },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    // Something outside the draw has overspent this prize's stock. Resuming
    // would build on a result that is already wrong, so 19's "recovery cannot
    // safely continue" applies and the draw is FAILED, not INTERRUPTED.
    const original = payload.update;
    payload.update = async (args: Row) => {
      const result = await original(args);
      if (args.collection === "giveaway-prizes" && prizes[0]) {
        prizes[0].unitsAwarded = 99;
      }
      return result;
    };

    await expect(makeEngine(payload).runDraw("g1")).rejects.toThrow(
      /Draw integrity check failed/
    );
    expect(giveaway.status).toBe("failed");
  });

  it("refuses a second prize to one user before confirming the result", async () => {
    const { payload } = createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 50,
      },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const drawEngine = makeEngine(payload);
    const result = await drawEngine.runDraw("g1", { dryRun: true });

    // Every winner is distinct: the check that guards this has nothing to
    // report on a sound draw, which is the point of asserting it here.
    const users = result.tiers.flatMap((t) => t.winners.map((w) => w.userKey));
    expect(new Set(users).size).toBe(users.length);
  });
});

describe("budget reserve (administrator setting, not in the spec)", () => {
  /** 100 participants, tier 3 at 10% → 10 winners before any budget limit. */
  function tenPercentOfHundred(giveaway: Row = {}, prizes?: Row[]) {
    return createFakePayload({
      giveaway: {
        totalValidParticipants: 100,
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 10,
        ...giveaway,
      },
      tickets: participants(100).ticketRows,
      prizes: prizes ?? [prizeRow("p3", "tier3", 40)],
    });
  }

  it("awards the full stock when utilisation is left at its default", async () => {
    const { payload } = tenPercentOfHundred();

    const result = await makeEngine(payload).runDraw("g1");

    // Nothing is held back: the percentage cap is the only ceiling, exactly as
    // 9 describes.
    expect(result.totalWinners).toBe(10);
  });

  it("holds stock back when utilisation is reduced", async () => {
    const { payload, created } = tenPercentOfHundred({
      budgetUtilizationPct: 10,
    });

    const result = await makeEngine(payload).runDraw("g1");

    // 10% of 40 units = 4, below the 10 the percentage cap would allow.
    expect(result.totalWinners).toBe(4);

    const events = (created["giveaway-audit-log"] ?? []).map(
      (e) => e.eventType
    );
    expect(events).toContain("budget_limit_reached");
  });

  it("stops once the monetary cap cannot cover another prize", async () => {
    const { payload } = tenPercentOfHundred({ maxBudgetCapNaira: 25_000 }, [
      {
        ...prizeRow("p3", "tier3", 40),
        prize: { id: "cat-p3", name: "prize-p3", valueNaira: 10_000 },
      },
    ]);

    const result = await makeEngine(payload).runDraw("g1");

    // ₦25,000 buys two ₦10,000 prizes; the third would overspend.
    expect(result.totalWinners).toBe(2);
  });

  it("refuses to draw with a monetary cap over unpriced prizes", async () => {
    const { payload } = tenPercentOfHundred({ maxBudgetCapNaira: 25_000 });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");

    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/no Value \(₦\)/);
  });

  it("counts an interrupted attempt's spend against the budget", async () => {
    const fake = tenPercentOfHundred({
      status: "interrupted",
      drawSeed: "original-seed",
      lastCheckpoint: "tier2_prizes_allocated",
      budgetUtilizationPct: 10,
    });

    // A previous attempt already awarded 3 of the 4 units the reserve allows.
    (fake.prizes[0] as Row).unitsAwarded = 3;
    fake.seed(
      "giveaway-winners",
      ["u0", "u1", "u2"].map((user, i) => ({
        id: `w${i}`,
        giveaway: "g1",
        user,
        tier: "tier3",
        prize: "cat-p3",
        prizeName: "prize-p3",
        winningTicket: `t${i}`,
      }))
    );

    const drawEngine = makeEngine(fake.payload);
    await drawEngine.authorizeResumption("g1", { authorizedBy: "admin" });
    const result = await drawEngine.runDraw("g1", { resume: true });

    // One unit of budget left, so exactly one more winner: not another four.
    expect((fake.created["giveaway-winners"] ?? []).length).toBe(1);
    expect(result.totalWinners).toBe(4);
  });
});

describe("draw state machine (spec 19)", () => {
  function readyToDraw() {
    return createFakePayload({
      giveaway: {
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 50,
      },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });
  }

  it("walks the full checkpoint sequence and ends on audit completion", async () => {
    const { payload, giveaway, created } = readyToDraw();

    const result = await makeEngine(payload).runDraw("g1");

    const checkpoints = (created["giveaway-audit-log"] ?? [])
      .filter((e) => e.eventType === "checkpoint_reached")
      .map((e) => e.detail.checkpoint);

    expect(checkpoints).toEqual([
      "config_validated",
      "pool_generated",
      "pool_locked",
      "tier1_winners_selected",
      "tier1_prizes_allocated",
      "tier2_winners_selected",
      "tier2_prizes_allocated",
      "tier3_winners_selected",
      "tier3_prizes_allocated",
      "final_validation",
      "result_confirmed",
      "audit_completed",
      "winner_report_generated",
    ]);

    expect(result.lastCheckpoint).toBe("winner_report_generated");
    expect(giveaway.status).toBe("completed");
  });

  it("leaves the report checkpoint open when the report cannot be sent", async () => {
    const { payload, giveaway, created } = readyToDraw();

    await makeEngine(payload, async () => {
      throw new Error("provider unavailable");
    }).runDraw("g1");

    const checkpoints = (created["giveaway-audit-log"] ?? [])
      .filter((e) => e.eventType === "checkpoint_reached")
      .map((e) => e.detail.checkpoint);

    // 21: a delivery failure never invalidates the draw, so the giveaway is
    // still completed. But the checkpoint stays open rather than being papered
    // over, so an unsent report remains visible.
    expect(giveaway.status).toBe("completed");
    expect(checkpoints).not.toContain("winner_report_generated");
    expect(created["giveaway-report-deliveries"]?.[0]?.status).toBe("failed");
  });

  it("emails the winner report once the draw completes", async () => {
    const { payload } = readyToDraw();
    const sender = stubReportSender();

    await makeEngine(payload, sender.send).runDraw("g1");

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe("rewards@newsspend.com");
    expect(sender.sent[0]?.attachment.filename).toEndWith(".csv");
  });

  it("opens an initial attempt carrying the execution id and seed", async () => {
    const { payload, giveaway, created } = readyToDraw();

    const result = await makeEngine(payload).runDraw("g1");
    const attempt = (created["giveaway-draw-attempts"] ?? [])[0];

    expect(attempt?.attemptNumber).toBe(1);
    expect(attempt?.kind).toBe("initial");
    expect(attempt?.outcome).toBe("completed");
    expect(attempt?.executionId).toBe(result.executionId);
    expect(attempt?.seed).toBe(result.seed);
    expect(giveaway.drawExecutionId).toBe(result.executionId);
  });

  it("persists nothing on a dry run", async () => {
    const { payload, giveaway, created } = readyToDraw();

    const result = await makeEngine(payload).runDraw("g1", {
      dryRun: true,
    });

    expect(result.totalWinners).toBeGreaterThan(0);
    expect(created["giveaway-draw-attempts"]).toBeUndefined();
    expect(giveaway.status).toBe("active");
    expect(giveaway.lastCheckpoint).toBeUndefined();
  });

  it("refuses to start a draw that is already in progress", async () => {
    const { payload } = createFakePayload({
      giveaway: { status: "draw_in_progress" },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/already in progress/);
  });

  it("refuses to restart a draw that was authorized only to resume", async () => {
    const { payload } = createFakePayload({
      giveaway: { status: "resumption_authorized" },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/authorized to resume, not to restart/);
  });

  it("refuses to draw a cancelled giveaway", async () => {
    const { payload } = createFakePayload({
      giveaway: { status: "cancelled" },
      tickets: participants(10).ticketRows,
      prizes: [prizeRow("p3", "tier3", 5)],
    });

    const { valid, errors } = await makeEngine(payload).validateDraw("g1");
    expect(valid).toBe(false);
    expect(errors.join(" ")).toMatch(/was cancelled/);
  });

  it("cancels a giveaway that has not been drawn", async () => {
    const { payload, giveaway } = readyToDraw();

    const outcome = await makeEngine(payload).cancelGiveaway("g1", {
      reason: "Sponsor withdrew the prizes",
      cancelledBy: "admin@newsspend.com",
    });

    expect(outcome.cancelled).toBe(true);
    expect(giveaway.status).toBe("cancelled");
  });

  it("refuses to cancel a completed draw", async () => {
    const { payload } = createFakePayload({
      giveaway: { status: "completed" },
    });

    const outcome = await makeEngine(payload).cancelGiveaway("g1", {
      reason: "changed our minds",
    });

    expect(outcome.cancelled).toBe(false);
    expect(outcome.message).toMatch(/prizes are allocated/);
  });

  it("refuses to cancel while a draw is unresolved", async () => {
    const { payload } = createFakePayload({
      giveaway: { status: "interrupted" },
    });

    const outcome = await makeEngine(payload).cancelGiveaway("g1", {
      reason: "changed our minds",
    });

    expect(outcome.cancelled).toBe(false);
    expect(outcome.message).toMatch(/Resolve it before cancelling/);
  });
});
