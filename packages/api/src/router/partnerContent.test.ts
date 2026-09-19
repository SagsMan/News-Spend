import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import {
  createFakePayload,
  type Doc,
  expectError,
  mockContext,
} from "../test-utils";
import { partnerContentRouter } from "./partnerContent";

function content(overrides: Doc = {}): Doc {
  return {
    id: "pc1",
    title: "Test Content",
    status: "active",
    placements: ["homepage-ads-banner"],
    type: "app",
    adSize: "BANNER",
    ...overrides,
  };
}

describe("partnerContentRouter.all", () => {
  it("returns all partner-content docs", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [content(), content({ id: "pc2" })],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(partnerContentRouter.all, undefined, {
      context: ctx,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("pc1");
    expect(result[1]?.id).toBe("pc2");
  });

  it("returns empty array when no docs exist", async () => {
    const payload = createFakePayload({
      collections: { "partner-content": [] },
    });
    const ctx = mockContext({ payload });

    const result = await call(partnerContentRouter.all, undefined, {
      context: ctx,
    });

    expect(result).toEqual([]);
  });
});

describe("partnerContentRouter.byId", () => {
  it("returns a doc by id", async () => {
    const payload = createFakePayload({
      collections: { "partner-content": [content()] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.byId,
      { id: "pc1" },
      { context: ctx }
    );

    expect(result.id).toBe("pc1");
  });

  it("throws NOT_FOUND when id does not exist", async () => {
    const payload = createFakePayload({
      collections: { "partner-content": [] },
    });
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(partnerContentRouter.byId, { id: "missing" }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Partner content with id missing not found",
    });
  });
});

describe("partnerContentRouter.filtered", () => {
  it("builds where with status filter", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          content({ id: "a", status: "active" }),
          content({ id: "b", status: "draft" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.filtered,
      { status: "active" },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.id).toBe("a");
  });

  it("builds where with placement array filter", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          content({ id: "a", placements: ["shop-tab"] }),
          content({ id: "b", placements: ["discover-tab"] }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.filtered,
      { placement: ["shop-tab"] },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.id).toBe("a");
  });

  it("builds where with type array filter", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          content({ id: "a", type: "app" }),
          content({ id: "b", type: "book" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.filtered,
      { type: ["app"] },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.id).toBe("a");
  });

  it("builds where with adSize filter", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          content({ id: "a", adSize: "BANNER" }),
          content({ id: "b", adSize: "LEADERBOARD" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.filtered,
      { adSize: "BANNER" },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.id).toBe("a");
  });

  it("passes limit and page to payload.find", async () => {
    const docs = Array.from({ length: 5 }, (_, i) => content({ id: `pc${i}` }));
    const payload = createFakePayload({
      collections: { "partner-content": docs },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.filtered,
      { limit: 2, page: 1 },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(2);
    expect(result.totalDocs).toBe(5);
    expect(result.totalPages).toBe(3);
  });

  it("defaults limit to 10 and page to 1", async () => {
    const payload = createFakePayload({
      collections: { "partner-content": [content()] },
    });
    const ctx = mockContext({ payload });

    await call(partnerContentRouter.filtered, {}, { context: ctx });

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.limit).toBe(10);
    expect(findCall?.args.page).toBe(1);
  });
});

describe("partnerContentRouter.getOne", () => {
  it("returns a random active doc", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const payload = createFakePayload({
        collections: {
          "partner-content": [
            content({ id: "a", status: "active" }),
            content({ id: "b", status: "active" }),
          ],
        },
      });
      const ctx = mockContext({ payload });

      const result = await call(
        partnerContentRouter.getOne,
        {},
        { context: ctx }
      );

      expect(result).not.toBeNull();
      // Math.random() = 0 → index 0 → first doc
      expect(result?.id).toBe("a");
    } finally {
      Math.random = originalRandom;
    }
  });

  it("returns null when no active docs exist", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [content({ id: "a", status: "draft" })],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.getOne,
      {},
      { context: ctx }
    );

    expect(result).toBeNull();
  });

  it("always filters by status active", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          content({ id: "active1", status: "active" }),
          content({ id: "draft1", status: "draft" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    await call(partnerContentRouter.getOne, {}, { context: ctx });

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.where?.status?.equals).toBe("active");
  });

  it("passes placement, type, and adSize filters", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [content({ status: "active" })],
      },
    });
    const ctx = mockContext({ payload });

    await call(
      partnerContentRouter.getOne,
      { placement: ["shop-tab"], type: ["app"], adSize: "BANNER" },
      { context: ctx }
    );

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.where?.placements?.in).toEqual(["shop-tab"]);
    expect(findCall?.args.where?.type?.in).toEqual(["app"]);
    expect(findCall?.args.where?.adSize?.equals).toBe("BANNER");
  });
});

describe("partnerContentRouter.random", () => {
  it("returns shuffled docs from active content", async () => {
    // Mock Math.random for deterministic behavior:
    // count → randomOffset calculation → sort shuffle
    const originalRandom = Math.random;
    let callCount = 0;
    const randomValues = [
      0.5, // randomOffset calculation (maxOffset=0, so 0.5*0=0)
      0, // sort for first pair: 0-0.5=-0.5 → negative → keep order
    ];
    Math.random = () => randomValues[callCount++] ?? 0;
    try {
      const payload = createFakePayload({
        collections: {
          "partner-content": [
            content({ id: "a", status: "active" }),
            content({ id: "b", status: "active" }),
          ],
        },
      });
      const ctx = mockContext({ payload });

      const result = await call(
        partnerContentRouter.random,
        {},
        { context: ctx }
      );

      expect(result).toHaveLength(2);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("returns empty array when no active docs exist", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [content({ id: "a", status: "draft" })],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      partnerContentRouter.random,
      {},
      { context: ctx }
    );

    expect(result).toEqual([]);
  });

  it("always uses status active in where", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [content({ status: "active" })],
      },
    });
    const ctx = mockContext({ payload });

    await call(partnerContentRouter.random, {}, { context: ctx });

    const countCall = payload.calls.find((c) => c.op === "count");
    expect(countCall?.args.where?.status?.equals).toBe("active");
  });

  it("passes optional filters to payload.find", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          content({
            status: "active",
            placements: ["shop-tab"],
            type: "app",
            adSize: "BANNER",
          }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    await call(
      partnerContentRouter.random,
      { placement: ["shop-tab"], type: ["app"], adSize: "BANNER", limit: 5 },
      { context: ctx }
    );

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.where?.placements?.in).toEqual(["shop-tab"]);
    expect(findCall?.args.where?.type?.in).toEqual(["app"]);
    expect(findCall?.args.where?.adSize?.equals).toBe("BANNER");
    expect(findCall?.args.limit).toBe(5);
  });
});

describe("partnerContentRouter.getOne: Boost exclusion", () => {
  function boostPayload(engagements: Doc[]) {
    return createFakePayload({
      collections: {
        "partner-content": [
          content({ id: "a", status: "active" }),
          content({ id: "b", status: "active" }),
        ],
        giveaways: [{ id: "g1", status: "active" }],
        "giveaway-engagements": engagements,
      },
    });
  }

  it("skips an item whose Boost this person already earned", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const payload = boostPayload([
        {
          id: "e1",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
          content: "a",
        },
      ]);
      const ctx = mockContext({ payload, user: { id: "u1" } as never });

      const result = await call(
        partnerContentRouter.getOne,
        { forBoost: true },
        { context: ctx }
      );

      // Math.random() = 0 would otherwise pick "a". Watching that ad again
      // earns nothing; recordEngagement refuses it as already completed.
      expect(result?.id).toBe("b");
    } finally {
      Math.random = originalRandom;
    }
  });

  it("does not narrow the inventory when the ad is not for a Boost", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const payload = boostPayload([
        {
          id: "e1",
          giveaway: "g1",
          user: "u1",
          type: "boost",
          completionStatus: "completed",
          content: "a",
        },
      ]);
      const ctx = mockContext({ payload, user: { id: "u1" } as never });

      const result = await call(
        partnerContentRouter.getOne,
        {},
        { context: ctx }
      );

      // The reveal plays an advertisement for suspense, not for credit, and
      // has no reason to shrink its inventory.
      expect(result?.id).toBe("a");
    } finally {
      Math.random = originalRandom;
    }
  });

  it("ignores another person's Boosts", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const payload = boostPayload([
        {
          id: "e1",
          giveaway: "g1",
          user: "someone-else",
          type: "boost",
          completionStatus: "completed",
          content: "a",
        },
      ]);
      const ctx = mockContext({ payload, user: { id: "u1" } as never });

      const result = await call(
        partnerContentRouter.getOne,
        { forBoost: true },
        { context: ctx }
      );

      expect(result?.id).toBe("a");
    } finally {
      Math.random = originalRandom;
    }
  });

  it("still serves an ad when nobody is signed in", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const payload = boostPayload([]);
      const ctx = mockContext({ payload });

      const result = await call(
        partnerContentRouter.getOne,
        { forBoost: true },
        { context: ctx }
      );

      // A refinement of which ad to show, never a reason to show none.
      expect(result?.id).toBe("a");
    } finally {
      Math.random = originalRandom;
    }
  });
});
