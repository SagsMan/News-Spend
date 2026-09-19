import { describe, expect, it, mock } from "bun:test";
import { call } from "@orpc/server";

import {
  createFakePayload,
  expectError,
  type FakePayload,
  mockContext,
} from "../test-utils";

// ---------------------------------------------------------------------------
// Mock content filter. Must be set up before importing the router so that
// comment.ts resolves screenText / CONTENT_FILTER_MESSAGE from this stub.
// ---------------------------------------------------------------------------
mock.module("../lib/content-filter", () => ({
  screenText: (text: string) => {
    if (text === "REJECTED") {
      return {
        ok: false,
        severity: "profanity" as const,
        matched: "test-term",
      };
    }
    return { ok: true };
  },
  CONTENT_FILTER_MESSAGE:
    "Your comment couldn't be posted because it appears to violate our community guidelines. Please revise it and try again.",
}));

import { commentRouter } from "./comment";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

/** The drizzle execute stub shape used by moderation-filters.ts. */
type DrizzlePayload = FakePayload & {
  db: {
    drizzle: {
      execute: (sql: unknown) => Promise<{ rows: unknown[] }>;
    };
  };
};

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };
const guestUser = { id: "guest-1", isAnonymous: true, username: "guest" };

/**
 * Create a FakePayload with a drizzle.execute stub that returns the given rows
 * for every moderation SQL query. Avoids `as any` by asserting the extended shape.
 *
 * The reaction lookups query dot-notation paths (`"target.relationTo"`); the
 * fake resolves those against the nested `target` object a created doc carries,
 * so no reshaping is needed here.
 */
function payloadWithDrizzle(
  options: Parameters<typeof createFakePayload>[0] = {},
  drizzleRows: unknown[] = []
): DrizzlePayload {
  const payload = createFakePayload(options);
  const p = payload as DrizzlePayload;
  p.db.drizzle = { execute: async () => ({ rows: drizzleRows }) };

  return p;
}

// ---------------------------------------------------------------------------
// commentRouter.all
// ---------------------------------------------------------------------------
describe("commentRouter.all", () => {
  it("returns top-level comments for an anonymous user", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            "news.id": "news-1",
            user: "user-1",
            text: "First",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        users: [{ id: "user-1", username: "tester" }],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      commentRouter.all,
      { newsId: "news-1" },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toMatchObject({
      id: "c1",
      text: "First",
      user: { id: "user-1", username: "tester" },
      userReaction: "none",
    });
  });

  it("excludes hidden comments via the visible filter", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            "news.id": "news-1",
            user: "user-1",
            text: "Visible",
            moderationStatus: "visible",
          },
          {
            id: "c2",
            "news.id": "news-1",
            user: "user-1",
            text: "Hidden",
            moderationStatus: "hidden",
          },
          {
            id: "c3",
            "news.id": "news-1",
            user: "user-1",
            text: "No status (legacy)",
          },
        ],
        users: [{ id: "user-1", username: "tester" }],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      commentRouter.all,
      { newsId: "news-1" },
      { context: ctx }
    );

    const ids = result.docs.map((d: { id: string }) => d.id);
    expect(ids).toContain("c1");
    expect(ids).toContain("c3");
    expect(ids).not.toContain("c2");
  });

  it("filters comments from blocked users when authenticated", async () => {
    const payload = payloadWithDrizzle(
      {
        collections: {
          comments: [
            {
              id: "c1",
              "news.id": "news-1",
              "user.id": "blocked-user",
              user: "blocked-user",
              text: "Blocked user comment",
            },
            {
              id: "c2",
              "news.id": "news-1",
              "user.id": "user-1",
              user: "user-1",
              text: "Normal comment",
            },
          ],
          users: [
            { id: "blocked-user", username: "spammer" },
            { id: "user-1", username: "tester" },
          ],
        },
      },
      // Return a blocked user id
      [{ id: "blocked-user" }]
    );
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      commentRouter.all,
      { newsId: "news-1" },
      { context: ctx }
    );

    const ids = result.docs.map((d: { id: string }) => d.id);
    expect(ids).not.toContain("c1");
    expect(ids).toContain("c2");
  });

  it("returns child comments when parentId is given", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c-parent",
            "news.id": "news-1",
            user: "user-1",
            text: "Parent",
          },
          {
            id: "c-child",
            "news.id": "news-1",
            parent: "c-parent",
            user: "user-2",
            text: "Child",
          },
        ],
        users: [
          { id: "user-1", username: "tester" },
          { id: "user-2", username: "other" },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      commentRouter.all,
      { newsId: "news-1", parentId: "c-parent" },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toMatchObject({ id: "c-child", text: "Child" });
  });

  it("returns paginated results", async () => {
    const comments = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i + 1}`,
      "news.id": "news-1",
      user: "user-1",
      text: `Comment ${i + 1}`,
      createdAt: `2026-01-0${i + 1}T00:00:00.000Z`,
    }));
    const payload = payloadWithDrizzle({
      collections: { comments, users: [{ id: "user-1", username: "tester" }] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      commentRouter.all,
      { newsId: "news-1", limit: 2, page: 1 },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(2);
    expect(result).toMatchObject({
      totalDocs: 5,
      totalPages: 3,
      hasNextPage: true,
      nextPage: 2,
    });
  });
});

// ---------------------------------------------------------------------------
// commentRouter.one
// ---------------------------------------------------------------------------
describe("commentRouter.one", () => {
  it("returns a comment by id", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            "news.id": "news-1",
            user: "user-1",
            text: "Hello",
          },
        ],
        users: [{ id: "user-1", username: "tester" }],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(commentRouter.one, "c1", { context: ctx });

    expect(result).toMatchObject({
      id: "c1",
      text: "Hello",
      user: { id: "user-1", username: "tester" },
      userReaction: "none",
    });
  });

  it("returns NOT_FOUND for a hidden comment", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            "news.id": "news-1",
            user: "user-1",
            text: "Hidden",
            moderationStatus: "hidden",
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(commentRouter.one, "c1", { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("returns NOT_FOUND for a removed comment", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            "news.id": "news-1",
            user: "user-1",
            text: "Removed",
            moderationStatus: "removed",
          },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(commentRouter.one, "c1", { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("returns NOT_FOUND when the viewer has blocked the author", async () => {
    // drizzle stub returns a row → hasBlockedUser returns true
    const payload = payloadWithDrizzle(
      {
        collections: {
          comments: [
            {
              id: "c1",
              "news.id": "news-1",
              user: "other-user",
              text: "From blocked user",
            },
          ],
          users: [{ id: "other-user", username: "blocked" }],
        },
      },
      [{ id: "1" }]
    );
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(commentRouter.one, "c1", { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("allows anonymous users to view any visible comment", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            "news.id": "news-1",
            user: "user-1",
            text: "Public",
          },
        ],
        users: [{ id: "user-1", username: "tester" }],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(commentRouter.one, "c1", { context: ctx });

    expect(result).toMatchObject({ id: "c1", text: "Public" });
  });
});

// ---------------------------------------------------------------------------
// commentRouter.create
// ---------------------------------------------------------------------------
describe("commentRouter.create", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(
        commentRouter.create,
        { text: "Hello", newsId: "news-1" },
        { context: mockContext() }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a guest caller", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: guestUser as never, payload });

    const error = await expectError(
      call(
        commentRouter.create,
        { text: "Hello", newsId: "news-1" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Guest users cannot perform this action",
    });
  });

  it("creates a comment and returns it", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      commentRouter.create,
      { text: "Hello world", newsId: "news-1" },
      { context: ctx }
    );

    expect(result).toMatchObject({
      text: "Hello world",
      news: "news-1",
      user: "user-1",
    });
    expect(result.id).toBeDefined();
    expect(payload.docs("comments")).toHaveLength(1);
  });

  it("stores parentId and replyingTo when provided", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: authedUser as never, payload });

    await call(
      commentRouter.create,
      {
        text: "Reply",
        newsId: "news-1",
        parentId: "c-parent",
        replyingTo: "user-2",
      },
      { context: ctx }
    );

    expect(payload.docs("comments")[0]).toMatchObject({
      parent: "c-parent",
      replyingTo: "user-2",
    });
  });

  it("rejects text that triggers the content filter", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        commentRouter.create,
        { text: "REJECTED", newsId: "news-1" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect(error.message).toContain("community guidelines");
    // The comment should not be created
    expect(payload.docs("comments")).toHaveLength(0);
    // A content report should be recorded
    expect(payload.docs("contentReports")).toHaveLength(1);
  });

  it("rate limits after 10 requests in the window", async () => {
    const payload = createFakePayload();
    const user = {
      id: `rl-${Date.now()}`,
      isAnonymous: false,
      username: "rl",
    };
    const ctx = mockContext({ user: user as never, payload });

    const attempts = await Promise.all(
      Array.from({ length: 12 }, () =>
        call(
          commentRouter.create,
          { text: "Hello", newsId: "news-1" },
          { context: ctx }
        ).then(
          () => "ok",
          (error: { code: string }) => error.code
        )
      )
    );

    expect(attempts.filter((a) => a === "ok")).toHaveLength(10);
    expect(attempts.filter((a) => a === "TOO_MANY_REQUESTS")).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// commentRouter.update
// ---------------------------------------------------------------------------
describe("commentRouter.update", () => {
  it("returns NOT_FOUND when the comment does not exist", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        commentRouter.update,
        { commentId: "nonexistent", text: "Updated" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("returns NOT_FOUND when the user does not own the comment", async () => {
    const payload = createFakePayload({
      collections: {
        comments: [
          {
            id: "c1",
            user: "other-user",
            text: "Their comment",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        commentRouter.update,
        { commentId: "c1", text: "Hijacked" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("updates the comment text within the edit window", async () => {
    const payload = createFakePayload({
      collections: {
        comments: [
          {
            id: "c1",
            user: "user-1",
            text: "Original",
            createdAt: new Date().toISOString(), // just now, within 15 min
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    await call(
      commentRouter.update,
      { commentId: "c1", text: "Updated" },
      { context: ctx }
    );

    expect(payload.docs("comments")[0]).toMatchObject({ text: "Updated" });
  });

  it("rejects an update after the 15-minute edit window expires", async () => {
    const payload = createFakePayload({
      collections: {
        comments: [
          {
            id: "c1",
            user: "user-1",
            text: "Old",
            createdAt: "2020-01-01T00:00:00.000Z", // way past the window
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        commentRouter.update,
        { commentId: "c1", text: "Too late" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Delete window has expired",
    });
    // The original text should be unchanged
    expect(payload.docs("comments")[0]).toMatchObject({ text: "Old" });
  });

  it("rejects text that triggers the content filter on edit", async () => {
    const payload = createFakePayload({
      collections: {
        comments: [
          {
            id: "c1",
            user: "user-1",
            text: "Original",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        commentRouter.update,
        { commentId: "c1", text: "REJECTED" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    expect(error.message).toContain("community guidelines");
    // The original text should be unchanged
    expect(payload.docs("comments")[0]).toMatchObject({ text: "Original" });
  });
});

// ---------------------------------------------------------------------------
// commentRouter.delete
// ---------------------------------------------------------------------------
describe("commentRouter.delete", () => {
  it("returns NOT_FOUND when the comment does not exist", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(commentRouter.delete, "nonexistent", { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("returns NOT_FOUND when the user does not own the comment", async () => {
    const payload = createFakePayload({
      collections: {
        comments: [{ id: "c1", user: "other-user", text: "Not yours" }],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(commentRouter.delete, "c1", { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Comment not found",
    });
  });

  it("deletes the comment and returns success", async () => {
    const payload = createFakePayload({
      collections: {
        comments: [{ id: "c1", user: "user-1", text: "Delete me" }],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.delete, "c1", { context: ctx });

    expect(result).toEqual({ success: true });
    expect(payload.docs("comments")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// commentRouter.like
// ---------------------------------------------------------------------------
describe("commentRouter.like", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(commentRouter.like, "c1", { context: mockContext() })
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("creates a new like when no prior reaction exists", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            likesCount: 0,
            dislikesCount: 0,
          },
        ],
        reactions: [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.like, "c1", { context: ctx });

    expect(result).toMatchObject({
      userReaction: "like",
      likesCount: 0,
      dislikesCount: 0,
    });
    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]).toMatchObject({
      type: "like",
      user: "user-1",
    });
  });

  it("toggles off an existing like", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            likesCount: 1,
            dislikesCount: 0,
          },
        ],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "comments",
            "target.value": "c1",
            user: "user-1",
            type: "like",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.like, "c1", { context: ctx });

    expect(result).toMatchObject({ userReaction: "none" });
    expect(payload.docs("reactions")).toHaveLength(0);
  });

  it("switches a dislike to a like", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            likesCount: 0,
            dislikesCount: 1,
          },
        ],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "comments",
            "target.value": "c1",
            user: "user-1",
            type: "dislike",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.like, "c1", { context: ctx });

    expect(result).toMatchObject({ userReaction: "like" });
    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]).toMatchObject({ type: "like" });
  });
});

// ---------------------------------------------------------------------------
// commentRouter.dislike
// ---------------------------------------------------------------------------
describe("commentRouter.dislike", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(commentRouter.dislike, "c1", { context: mockContext() })
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("creates a new dislike when no prior reaction exists", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            likesCount: 0,
            dislikesCount: 0,
          },
        ],
        reactions: [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.dislike, "c1", { context: ctx });

    expect(result).toMatchObject({
      userReaction: "dislike",
      likesCount: 0,
      dislikesCount: 0,
    });
    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]).toMatchObject({
      type: "dislike",
      user: "user-1",
    });
  });

  it("toggles off an existing dislike", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            likesCount: 0,
            dislikesCount: 1,
          },
        ],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "comments",
            "target.value": "c1",
            user: "user-1",
            type: "dislike",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.dislike, "c1", { context: ctx });

    expect(result).toMatchObject({ userReaction: "none" });
    expect(payload.docs("reactions")).toHaveLength(0);
  });

  it("switches a like to a dislike", async () => {
    const payload = payloadWithDrizzle({
      collections: {
        comments: [
          {
            id: "c1",
            likesCount: 1,
            dislikesCount: 0,
          },
        ],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "comments",
            "target.value": "c1",
            user: "user-1",
            type: "like",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(commentRouter.dislike, "c1", { context: ctx });

    expect(result).toMatchObject({ userReaction: "dislike" });
    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]).toMatchObject({ type: "dislike" });
  });
});
