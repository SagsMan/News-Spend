import { describe, expect, it } from "bun:test";
import { processGiveawayTask } from "@news-spend-media/payload/tasks/processGiveaway";

type Row = Record<string, any>;

const HOUR = 3_600_000;

/**
 * Enough of Payload for the task: giveaways it can find and update, prize and
 * ticket rows for the draw, and a delivery log for the report retry step.
 */
function createFakePayload({
  giveaways = [],
  tickets = [],
  prizes = [],
  deliveries = [],
}: {
  giveaways?: Row[];
  tickets?: Row[];
  prizes?: Row[];
  deliveries?: Row[];
} = {}) {
  const collections: Record<string, Row[]> = {
    giveaways,
    "giveaway-tickets": tickets,
    "giveaway-prizes": prizes,
    "giveaway-report-deliveries": deliveries,
  };

  const created: Record<string, Row[]> = {};
  const logs: string[] = [];

  const payload: any = {
    logger: {
      info: (m: unknown) => logs.push(String(m)),
      warn: () => undefined,
      error: () => undefined,
    },
    /**
     * The winner-report retry claims a delivery with a conditional UPDATE
     * before sending, so a fake without this reports nothing to retry.
     */
    db: {
      drizzle: {
        execute: async () => {
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
    findByID: async ({ collection, id }: Row) =>
      collections[collection]?.find((row) => row.id === id) ?? null,
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
      const row = collections[collection]?.find((item) => item.id === id);
      if (row) {
        Object.assign(row, data);
      }
      return row ?? { id, ...data };
    },
  };

  return { payload, collections, created, logs };
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
    if (clause?.less_than_equal !== undefined) {
      return String(key) <= String(clause.less_than_equal);
    }
    if (clause?.less_than !== undefined) {
      return String(key) < String(clause.less_than);
    }
    if (Array.isArray(clause?.in)) {
      return clause.in.some((v: unknown) => String(v) === String(key));
    }
    return true;
  });
}

function giveawayRow(overrides: Row = {}): Row {
  return {
    id: "g1",
    name: "Week 33",
    status: "active",
    startDate: new Date(Date.now() - 14 * 24 * HOUR).toISOString(),
    endDate: new Date(Date.now() - HOUR).toISOString(),
    ticketPrice: 50,
    tier1WinnerPercentage: 0,
    tier2WinnerPercentage: 0,
    tier3WinnerPercentage: 50,
    budgetUtilizationPct: 100,
    ...overrides,
  };
}

function ticketsFor(giveawayId: string, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${giveawayId}-t${i}`,
    giveaway: giveawayId,
    user: `${giveawayId}-u${i}`,
    quantity: 1,
    status: "valid",
  }));
}

function prizeFor(giveawayId: string, id: string, maxUnits: number): Row {
  return {
    id,
    giveaway: giveawayId,
    tier: "tier3",
    maxUnits,
    unitsAwarded: 0,
    prize: { id: `cat-${id}`, name: `prize-${id}` },
  };
}

/** Invoke the task the way Payload's job runner would. */
function runTask(payload: unknown) {
  const handler = processGiveawayTask.handler as (args: {
    req: { payload: unknown };
  }) => Promise<{ output: Record<string, number> }>;
  return handler({ req: { payload } });
}

describe("processGiveaway task", () => {
  it("draws a giveaway whose countdown has ended", async () => {
    const { payload, collections, created } = createFakePayload({
      giveaways: [giveawayRow()],
      tickets: ticketsFor("g1", 10),
      prizes: [prizeFor("g1", "p1", 5)],
    });

    const { output } = await runTask(payload);

    expect(output.drawn).toBe(1);
    expect(collections.giveaways?.[0]?.status).toBe("completed");
    expect(created["giveaway-winners"]).toHaveLength(5);
  });

  it("leaves a giveaway that is still running", async () => {
    const { payload, collections, created } = createFakePayload({
      giveaways: [
        giveawayRow({
          endDate: new Date(Date.now() + HOUR).toISOString(),
        }),
      ],
      tickets: ticketsFor("g1", 10),
      prizes: [prizeFor("g1", "p1", 5)],
    });

    const { output } = await runTask(payload);

    expect(output.drawn).toBe(0);
    expect(collections.giveaways?.[0]?.status).toBe("active");
    expect(created["giveaway-winners"]).toBeUndefined();
  });

  it("is safe to run twice: the second run finds nothing to draw", async () => {
    const { payload, created } = createFakePayload({
      giveaways: [giveawayRow()],
      tickets: ticketsFor("g1", 10),
      prizes: [prizeFor("g1", "p1", 5)],
    });

    await runTask(payload);
    const second = await runTask(payload);

    expect(second.output.drawn).toBe(0);
    // No extra winners: the giveaway left `active` on the first pass.
    expect(created["giveaway-winners"]).toHaveLength(5);
  });

  it("never resumes an interrupted draw by itself", async () => {
    const { payload, collections } = createFakePayload({
      // 19: only an administrator may authorize a resumption.
      giveaways: [
        giveawayRow({
          status: "interrupted",
          lastCheckpoint: "tier1_prizes_allocated",
          drawSeed: "seed",
        }),
      ],
      tickets: ticketsFor("g1", 10),
      prizes: [prizeFor("g1", "p1", 5)],
    });

    const { output } = await runTask(payload);

    expect(output.drawn).toBe(0);
    expect(collections.giveaways?.[0]?.status).toBe("interrupted");
  });

  it("carries on after one giveaway fails to draw", async () => {
    const { payload, collections } = createFakePayload({
      giveaways: [
        // No prizes configured, so validation refuses this one.
        giveawayRow({ id: "g0", name: "Broken" }),
        giveawayRow({ id: "g1", name: "Sound" }),
      ],
      tickets: [...ticketsFor("g0", 4), ...ticketsFor("g1", 10)],
      prizes: [prizeFor("g1", "p1", 5)],
    });

    const { output } = await runTask(payload);

    // The failure of the first must not deny the second its draw.
    expect(output.drawn).toBe(1);
    expect(collections.giveaways?.[1]?.status).toBe("completed");
  });

  it("retries a winner report that previously failed", async () => {
    const { payload, collections } = createFakePayload({
      giveaways: [
        giveawayRow({
          status: "completed",
          drawCompletedAt: new Date().toISOString(),
          totalValidParticipants: 10,
        }),
      ],
      deliveries: [
        {
          id: "d1",
          giveaway: "g1",
          kind: "original",
          status: "failed",
          recipient: "rewards@newsspend.com",
          attempts: 3,
        },
      ],
    });

    const { output } = await runTask(payload);

    expect(output.reportsRetried).toBe(1);
    // No mail provider is configured in a test, so the send fails again: the
    // point is that the task picked it up and did not throw.
    expect(collections["giveaway-report-deliveries"]?.[0]?.status).toBe(
      "failed"
    );
  });

  it("reports nothing to do on an idle run", async () => {
    const { payload } = createFakePayload();

    const { output } = await runTask(payload);

    expect(output).toEqual({
      drawn: 0,
      prizesFulfilled: 0,
      prizesFailed: 0,
      claimsExpired: 0,
      reportsRetried: 0,
      reportsSent: 0,
    });
  });
});
