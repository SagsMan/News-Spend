import { describe, expect, it } from "bun:test";
import {
  isUserVerified,
  recordDecision,
  startVerification,
} from "@news-spend-media/payload/lib/giveaway/verification";

type Row = Record<string, any>;

function createFakePayload({
  checks = [],
  winners = [],
}: {
  checks?: Row[];
  winners?: Row[];
} = {}) {
  const collections: Record<string, Row[]> = {
    "identity-checks": checks,
    "giveaway-winners": winners,
    // `recordDecision` refuses a decision for an account that does not exist,
    // so the fixtures need the user the other tests act on.
    users: [{ id: "u1" }, { id: "someone-else" }],
  };

  const matches = (row: Row, where: Row | undefined): boolean => {
    if (!where) {
      return true;
    }
    if (Array.isArray(where.and)) {
      return where.and.every((clause: Row) => matches(row, clause));
    }
    return Object.entries(where).every(([field, condition]) => {
      const clause = condition as Row;
      return clause?.equals === undefined
        ? true
        : String(row[field]) === String(clause.equals);
    });
  };

  const payload: any = {
    logger: { warn: () => undefined, error: () => undefined },
    find: async ({ collection, where }: Row) => {
      const docs = (collections[collection] ?? []).filter((r) =>
        matches(r, where)
      );
      return { docs, totalDocs: docs.length };
    },
    count: async ({ collection, where }: Row) => ({
      totalDocs: (collections[collection] ?? []).filter((r) =>
        matches(r, where)
      ).length,
    }),
    create: async ({ collection, data }: Row) => {
      const row = {
        id: `${collection}-${collections[collection].length + 1}`,
        ...data,
      };
      collections[collection].push(row);
      return row;
    },
    update: async ({ collection, id, data }: Row) => {
      const row = collections[collection]?.find((r) => r.id === id);
      if (row) {
        Object.assign(row, data);
      }
      return row;
    },
  };

  return { payload, collections };
}

const fakeClient = (session: Row) =>
  ({ createSession: async () => session }) as any;

describe("isUserVerified", () => {
  it("is true only on an approved decision", async () => {
    const { payload } = createFakePayload({
      checks: [{ id: "c1", user: "u1", status: "Approved" }],
    });
    expect(await isUserVerified(payload, "u1")).toBe(true);
  });

  it("is false while a decision is still in review", async () => {
    const { payload } = createFakePayload({
      checks: [{ id: "c1", user: "u1", status: "In Review" }],
    });
    // In Review means the provider wants a human to look. Nothing ships yet.
    expect(await isUserVerified(payload, "u1")).toBe(false);
  });

  it("is false for a different user's approval", async () => {
    const { payload } = createFakePayload({
      checks: [{ id: "c1", user: "someone-else", status: "Approved" }],
    });
    expect(await isUserVerified(payload, "u1")).toBe(false);
  });
});

describe("startVerification", () => {
  it("records the session against the user", async () => {
    const { payload, collections } = createFakePayload();
    const client = fakeClient({
      sessionId: "sess_1",
      url: "https://v/1",
      token: "tok_1",
    });

    const session = await startVerification(payload, "u1", { client });

    expect(session.token).toBe("tok_1");
    expect(collections["identity-checks"][0]).toMatchObject({
      user: "u1",
      sessionId: "sess_1",
      status: "Not Started",
    });
  });

  it("refuses when no provider is configured", async () => {
    const { payload } = createFakePayload();
    await expect(startVerification(payload, "u1")).rejects.toThrow(
      /No identity verification provider/
    );
  });
});

describe("recordDecision", () => {
  it("releases a prize that was waiting on verification", async () => {
    const { payload, collections } = createFakePayload({
      checks: [
        { id: "c1", user: "u1", sessionId: "sess_1", status: "In Progress" },
      ],
      winners: [
        {
          id: "w1",
          user: "u1",
          claimStatus: "claimed",
          fulfilmentStatus: "awaiting_verification",
        },
      ],
    });

    const result = await recordDecision(payload, {
      sessionId: "sess_1",
      userId: "u1",
      status: "Approved",
    });

    expect(result.released).toBe(1);
    expect(collections["giveaway-winners"][0].fulfilmentStatus).toBe("pending");
    expect(collections["identity-checks"][0].status).toBe("Approved");
    expect(collections["identity-checks"][0].decidedAt).toBeTruthy();
  });

  it("leaves an on_hold prize held even after approval", async () => {
    const { payload, collections } = createFakePayload({
      checks: [
        { id: "c1", user: "u1", sessionId: "sess_1", status: "In Progress" },
      ],
      winners: [
        {
          id: "w1",
          user: "u1",
          claimStatus: "claimed",
          fulfilmentStatus: "on_hold",
        },
      ],
    });

    const result = await recordDecision(payload, {
      sessionId: "sess_1",
      userId: "u1",
      status: "Approved",
    });

    // A hold is an administrator's decision. Passing an identity check says
    // nothing about whatever made them hold it (22.8).
    expect(result.released).toBe(0);
    expect(collections["giveaway-winners"][0].fulfilmentStatus).toBe("on_hold");
  });

  it("releases nothing when the decision is a decline", async () => {
    const { payload, collections } = createFakePayload({
      checks: [
        { id: "c1", user: "u1", sessionId: "sess_1", status: "In Progress" },
      ],
      winners: [
        {
          id: "w1",
          user: "u1",
          claimStatus: "claimed",
          fulfilmentStatus: "awaiting_verification",
        },
      ],
    });

    const result = await recordDecision(payload, {
      sessionId: "sess_1",
      userId: "u1",
      status: "Declined",
    });

    expect(result.released).toBe(0);
    expect(collections["giveaway-winners"][0].fulfilmentStatus).toBe(
      "awaiting_verification"
    );
  });

  it("updates the existing row rather than adding a second decision", async () => {
    const { payload, collections } = createFakePayload({
      checks: [
        { id: "c1", user: "u1", sessionId: "sess_1", status: "In Progress" },
      ],
    });

    await recordDecision(payload, {
      sessionId: "sess_1",
      userId: "u1",
      status: "Approved",
    });
    await recordDecision(payload, {
      sessionId: "sess_1",
      userId: "u1",
      status: "Approved",
    });

    // Didit retries webhooks; two rows for one session would read as two
    // separate verifications of the same person.
    expect(collections["identity-checks"]).toHaveLength(1);
  });

  it("keeps a decision for a session it has never seen", async () => {
    const { payload, collections } = createFakePayload();

    await recordDecision(payload, {
      sessionId: "sess_unknown",
      userId: "u1",
      status: "Approved",
    });

    // Dropping it would strand a winner who did everything asked of them.
    expect(collections["identity-checks"][0]).toMatchObject({
      sessionId: "sess_unknown",
      status: "Approved",
    });
  });
});

describe("recordDecision with an unknown user", () => {
  it("acknowledges rather than throwing, so the provider stops retrying", async () => {
    const { payload, collections } = createFakePayload();
    // A uuid column rejects this outright: the lookup throws rather than
    // returning nothing, which is what `userExists` has to survive.
    payload.count = async ({ collection }: Row) => {
      if (collection === "users") {
        throw new Error('invalid input syntax for type uuid: "not-a-uuid"');
      }
      return { totalDocs: 0 };
    };

    const result = await recordDecision(payload, {
      sessionId: "sess_x",
      userId: "not-a-uuid",
      status: "Approved",
    });

    expect(result.unknownUser).toBe(true);
    expect(result.released).toBe(0);
    expect(collections["identity-checks"]).toHaveLength(0);
  });
});

describe("startVerification when a session already exists", () => {
  it("does not insert a second row for the same provider session", async () => {
    const { payload, collections } = createFakePayload({
      checks: [
        { id: "c1", user: "u1", sessionId: "sess_same", status: "Not Started" },
      ],
    });
    // Didit returns the session already open for this vendor_data rather than
    // minting a new one, so a second tap yields the same id. `sessionId` is
    // unique, so a blind insert throws and the person loses the flow.
    const client = fakeClient({
      sessionId: "sess_same",
      url: "https://v/1",
      token: "tok",
    });

    const session = await startVerification(payload, "u1", { client });

    expect(session.sessionId).toBe("sess_same");
    expect(collections["identity-checks"]).toHaveLength(1);
  });
});
