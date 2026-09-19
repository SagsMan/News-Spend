import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import {
  createFakePayload,
  createTestClient,
  type Doc,
  expectError,
  mockContext,
} from "../test-utils";
import { activityRouter } from "./activity";

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };
const guestUser = { id: "guest-1", isAnonymous: true, username: "guest" };

function activity(overrides: Doc = {}): Doc {
  return {
    id: "a1",
    user: "user-1",
    type: "point",
    action: "read",
    point: 5,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function contextWith(activities: Doc[] = [], user = authedUser) {
  const payload = createFakePayload({
    collections: {
      activities,
      users: [{ id: user.id }],
    },
  });
  return { ctx: mockContext({ user: user as never, payload }), payload };
}

describe("activity.add", () => {
  it("rejects a guest caller", async () => {
    const { ctx } = contextWith([], guestUser);

    const error = await expectError(
      call(
        activityRouter.add,
        { point: 5, action: "read", newsId: "news-1" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("FORBIDDEN");
  });

  it("awards a read once per article", async () => {
    const { ctx, payload } = contextWith([
      activity({ action: "read", news: "news-1" }),
    ]);

    const result = await call(
      activityRouter.add,
      { point: 5, action: "read", newsId: "news-1" },
      { context: ctx }
    );

    expect(result).toMatchObject({ message: "ALREADY_READ" });
    expect(payload.docs("activities")).toHaveLength(1);
  });

  it("records a read for an article the user has not seen", async () => {
    const { ctx, payload } = contextWith([
      activity({ action: "read", news: "news-1" }),
    ]);

    await call(
      activityRouter.add,
      { point: 5, action: "read", newsId: "news-2" },
      { context: ctx }
    );

    expect(payload.docs("activities")).toHaveLength(2);
    expect(payload.docs("activities")[1]).toMatchObject({
      news: "news-2",
      user: "user-1",
      point: 5,
    });
  });

  it("stops awarding shares once the daily cap is reached", async () => {
    const today = new Date().toISOString();
    const { ctx, payload } = contextWith(
      Array.from({ length: 5 }, (_, i) =>
        activity({ id: `share-${i}`, action: "share", createdAt: today })
      )
    );

    const result = await call(
      activityRouter.add,
      { point: 2, action: "share" },
      { context: ctx }
    );

    expect(result).toEqual({ message: "CAP_REACHED" });
    expect(payload.docs("activities")).toHaveLength(5);
  });

  it("still awards a share below the cap", async () => {
    const today = new Date().toISOString();
    const { ctx, payload } = contextWith(
      Array.from({ length: 4 }, (_, i) =>
        activity({ id: `share-${i}`, action: "share", createdAt: today })
      )
    );

    await call(
      activityRouter.add,
      { point: 2, action: "share" },
      { context: ctx }
    );

    expect(payload.docs("activities")).toHaveLength(5);
  });
});

describe("activity.byNewsId", () => {
  it("returns only the caller's activities for that article", async () => {
    const { ctx } = contextWith([
      activity({ id: "a1", news: "news-1" }),
      activity({ id: "a2", news: "news-2" }),
      activity({ id: "a3", news: "news-1", user: "user-2" }),
    ]);

    const result = await call(
      activityRouter.byNewsId,
      { newsId: "news-1" },
      { context: ctx }
    );

    expect(result.map((doc) => doc.id)).toEqual(["a1"]);
  });

  it("narrows further when an action is given", async () => {
    const { ctx } = contextWith([
      activity({ id: "a1", news: "news-1", action: "read" }),
      activity({ id: "a2", news: "news-1", action: "share" }),
    ]);

    const result = await call(
      activityRouter.byNewsId,
      { newsId: "news-1", action: "share" },
      { context: ctx }
    );

    expect(result.map((doc) => doc.id)).toEqual(["a2"]);
  });
});

describe("activity.byUserId", () => {
  // Exercised through a server-side router client rather than `call()`. Same
  // middleware and validation, less ceremony per case.
  it("returns an empty page for a category the endpoint does not serve", async () => {
    const { ctx } = contextWith([activity()]);
    const client = createTestClient(activityRouter, ctx);

    const result = await client.byUserId({
      category: "referrals",
      type: "posted",
    });

    expect(result).toMatchObject({ docs: [], totalDocs: 0 });
  });

  it("paginates the caller's activities newest first", async () => {
    const { ctx } = contextWith([
      activity({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      activity({ id: "new", createdAt: "2026-01-03T00:00:00.000Z" }),
      activity({ id: "mid", createdAt: "2026-01-02T00:00:00.000Z" }),
      activity({ id: "other-user", user: "user-2" }),
    ]);
    const client = createTestClient(activityRouter, ctx);

    const result = await client.byUserId({
      category: "all",
      type: "posted",
      startDate: "2025-12-31",
      endDate: "2026-01-04",
      limit: 2,
      page: 1,
    });

    expect(result.docs.map((doc) => doc.id)).toEqual(["new", "mid"]);
    expect(result).toMatchObject({
      totalDocs: 3,
      totalPages: 2,
      hasNextPage: true,
      nextPage: 2,
    });
  });
});
