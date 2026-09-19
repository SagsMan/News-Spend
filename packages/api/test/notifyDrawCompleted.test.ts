import { describe, expect, it } from "bun:test";
import { notifyDrawCompleted } from "@news-spend-media/payload/lib/giveaway/notifyDrawCompleted";

type Row = Record<string, any>;

function createFakePayload({
  giveaway = { id: "g1", name: "Week 33" },
  tickets = [{ user: "u1" }, { user: "u2" }],
  onCreate,
}: Partial<{
  giveaway: Row | null;
  tickets: Row[];
  onCreate: (data: Row) => void;
}> = {}) {
  const created: Row[] = [];

  const payload: any = {
    logger: { error: () => undefined, warn: () => undefined },
    findByID: async ({ collection }: Row) =>
      collection === "giveaways" ? giveaway : null,
    find: async ({ collection }: Row) =>
      collection === "giveaway-tickets"
        ? { docs: tickets, totalDocs: tickets.length }
        : { docs: [], totalDocs: 0 },
    create: async ({ data }: Row) => {
      onCreate?.(data);
      created.push(data);
      return { id: "n1", ...data };
    },
  };

  return { payload, created };
}

describe("notifyDrawCompleted", () => {
  it("notifies everyone who entered, not only the winners", async () => {
    const { payload, created } = createFakePayload();

    const result = await notifyDrawCompleted(payload, "g1");

    expect(result.notified).toBe(2);
    expect(created[0].specificUsers).toEqual(["u1", "u2"]);
  });

  it("targets the entrants rather than the whole platform", async () => {
    // `targetType` defaults to "all", and `specificUsers` is only read when it
    // is "specific". Without this the notification reaches every user on the
    // platform. On staging that was one person, in production everybody.
    const { payload, created } = createFakePayload();

    await notifyDrawCompleted(payload, "g1");

    expect(created[0].targetType).toBe("specific");
  });

  it("publishes it, or nothing is ever sent", async () => {
    // The collection has drafts enabled and the send hook returns early on
    // anything unpublished. Two draws' notifications sat in the database as
    // drafts with `sentAt` null and no error to explain it.
    const { payload, created } = createFakePayload();

    await notifyDrawCompleted(payload, "g1");

    expect(created[0]._status).toBe("published");
    expect(created[0].deliveryAction).toBe("send-now");
  });

  it("says nothing about the outcome", async () => {
    // The reveal opens with a sealed card and shows the result after an
    // advertisement. A notification that named a winner or a prize would give
    // that away on the lock screen and leave the card with nothing to reveal.
    const { payload, created } = createFakePayload();

    await notifyDrawCompleted(payload, "g1");

    const text = `${created[0].title} ${created[0].body}`.toLowerCase();
    for (const spoiler of ["won", "winner", "congratulations", "prize"]) {
      expect(text).not.toContain(spoiler);
    }
  });

  it("notifies a person once however many tickets they bought", async () => {
    const { payload, created } = createFakePayload({
      tickets: [{ user: "u1" }, { user: "u1" }, { user: "u2" }],
    });

    const result = await notifyDrawCompleted(payload, "g1");

    expect(result.notified).toBe(2);
    expect(created[0].specificUsers).toEqual(["u1", "u2"]);
  });

  it("resolves a populated user relationship", async () => {
    const { payload, created } = createFakePayload({
      tickets: [{ user: { id: "u9" } }],
    });

    await notifyDrawCompleted(payload, "g1");

    expect(created[0].specificUsers).toEqual(["u9"]);
  });

  it("does nothing when nobody entered", async () => {
    const { payload, created } = createFakePayload({ tickets: [] });

    const result = await notifyDrawCompleted(payload, "g1");

    expect(result.notified).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("never throws, so a notification cannot fail a completed draw", async () => {
    // It runs after the prizes have been awarded. 21 makes the same argument
    // about the Winner Report: a delivery failure does not invalidate a draw.
    const { payload } = createFakePayload();
    payload.create = async () => {
      throw new Error("notification service is down");
    };

    const result = await notifyDrawCompleted(payload, "g1");

    expect(result.notified).toBe(0);
    expect(result.reason).toBe("error");
  });
});
