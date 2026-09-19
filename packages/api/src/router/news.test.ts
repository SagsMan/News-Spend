import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { createFakePayload, expectError, mockContext } from "../test-utils";
import { newsRouter } from "./news";

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };

function makeNews(overrides = {}) {
  return {
    id: "news-1",
    slug: "test-article",
    title: "Test Article",
    type: "article",
    _status: "published",
    views: 10,
    likesCount: 2,
    dislikesCount: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// all
// ---------------------------------------------------------------------------
describe("newsRouter.all", () => {
  it("returns published articles with default pagination (includeAds: false)", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({ id: "n1", slug: "article-1" }),
          makeNews({ id: "n2", slug: "article-2" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.all,
      { includeAds: false },
      {
        context: ctx,
      }
    );

    expect(result.docs).toHaveLength(2);
    expect(result.totalDocs).toBe(2);
  });

  it("filters by category when provided", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({ id: "n1", slug: "a1", category: "politics" }),
          makeNews({ id: "n2", slug: "a2", category: "sports" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.all,
      { category: "politics", includeAds: false },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toMatchObject({ slug: "a1" });
  });

  it("respects limit and page", async () => {
    const news = Array.from({ length: 5 }, (_, i) =>
      makeNews({
        id: `n${i}`,
        slug: `a${i}`,
        createdAt: `2026-01-0${i + 1}T00:00:00.000Z`,
      })
    );
    const payload = createFakePayload({ collections: { news } });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.all,
      { limit: 2, page: 2, includeAds: false },
      { context: ctx }
    );

    expect(result.docs).toHaveLength(2);
    expect(result.page).toBe(2);
  });

  it("defaults to type article", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({ id: "n1", type: "article" }),
          makeNews({ id: "n2", type: "video", slug: "vid-1" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.all,
      { includeAds: false },
      {
        context: ctx,
      }
    );

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.type).toBe("article");
  });

  it("includes ads by default without throwing", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "n1" }), makeNews({ id: "n2", slug: "a2" })],
      },
    });
    const ctx = mockContext({ payload });

    // Redis is unavailable → ad pool is empty → Google ads injected
    const result = await call(newsRouter.all, {}, { context: ctx });

    expect(result.docs.length).toBeGreaterThan(2);
  });
});

// ---------------------------------------------------------------------------
// trending
// ---------------------------------------------------------------------------
describe("newsRouter.trending", () => {
  it("falls back to DB when Redis is unavailable", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({
            id: "n1",
            slug: "a1",
            createdAt: "2026-01-03T00:00:00.000Z",
          }),
          makeNews({
            id: "n2",
            slug: "a2",
            createdAt: "2026-01-02T00:00:00.000Z",
          }),
          makeNews({
            id: "n3",
            slug: "a3",
            createdAt: "2026-01-01T00:00:00.000Z",
          }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(newsRouter.trending, {}, { context: ctx });

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("n1");
    expect(result[1].id).toBe("n2");
    expect(result[2].id).toBe("n3");
  });

  it("respects the limit parameter", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({
            id: "n1",
            slug: "a1",
            createdAt: "2026-01-03T00:00:00.000Z",
          }),
          makeNews({
            id: "n2",
            slug: "a2",
            createdAt: "2026-01-02T00:00:00.000Z",
          }),
          makeNews({
            id: "n3",
            slug: "a3",
            createdAt: "2026-01-01T00:00:00.000Z",
          }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.trending,
      { limit: 1 },
      {
        context: ctx,
      }
    );

    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// recordView
// ---------------------------------------------------------------------------
describe("newsRouter.recordView", () => {
  it("rejects when neither newsId nor slug is provided", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(newsRouter.recordView, {}, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "newsId or slug is required to record view",
    });
  });

  it("returns NOT_FOUND when news does not exist", async () => {
    const payload = createFakePayload({ collections: { news: [] } });
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(newsRouter.recordView, { newsId: "nonexistent" }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "News not found",
    });
  });

  it("increments view count when Redis is unavailable", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", views: 10 })],
      },
    });
    // Stub drizzle for the raw SQL UPDATE
    Object.assign(payload.db, {
      drizzle: {
        execute: async () => ({ rows: [{ views: 11 }] }),
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.recordView,
      { newsId: "news-1" },
      { context: ctx }
    );

    expect(result.ok).toBe(true);
    expect(result.views).toBe(11);
    expect(result.incremented).toBe(true);
  });

  it("finds news by slug", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", slug: "my-article", views: 5 })],
      },
    });
    Object.assign(payload.db, {
      drizzle: {
        execute: async () => ({ rows: [{ views: 6 }] }),
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.recordView,
      { slug: "my-article" },
      { context: ctx }
    );

    expect(result.ok).toBe(true);
    expect(result.views).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// one
// ---------------------------------------------------------------------------
describe("newsRouter.one", () => {
  it("returns article with user reaction and comment count", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "n1", slug: "test-article", content: null })],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "news",
            "target.value": "n1",
            user: "user-1",
            type: "like",
          },
        ],
        comments: [
          { id: "c1", news: "n1" },
          { id: "c2", news: "n1" },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.one,
      { slug: "test-article" },
      { context: ctx }
    );

    expect(result.id).toBe("n1");
    expect(result.userReaction).toBe("like");
    expect(result.totalComments).toBe(2);
  });

  it("throws NOT_FOUND for non-existent slug", async () => {
    const payload = createFakePayload({ collections: { news: [] } });
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(newsRouter.one, { slug: "nonexistent" }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "News not found",
    });
  });

  it("returns 'none' for anonymous user reaction", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "n1", slug: "test-article" })],
        reactions: [],
        comments: [],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.one,
      { slug: "test-article" },
      { context: ctx }
    );

    expect(result.userReaction).toBe("none");
    expect(result.totalComments).toBe(0);
  });

  it("filters by type video", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({ id: "n1", slug: "vid-1", type: "article" }),
          makeNews({ id: "n2", slug: "vid-1", type: "video" }),
        ],
        reactions: [],
        comments: [],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      newsRouter.one,
      { slug: "vid-1", type: "video" },
      { context: ctx }
    );

    expect(result.type).toBe("video");
  });
});

// ---------------------------------------------------------------------------
// home
// ---------------------------------------------------------------------------
describe("newsRouter.home", () => {
  it("returns a feed with docs array and pagination metadata", async () => {
    const payload = createFakePayload({
      collections: {
        news: [
          makeNews({ id: "n1", slug: "a1" }),
          makeNews({ id: "n2", slug: "a2" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(newsRouter.home, {}, { context: ctx });

    expect(result).toHaveProperty("docs");
    expect(Array.isArray(result.docs)).toBe(true);
    expect(result.docs.length).toBeGreaterThan(0);
    expect(result).toHaveProperty("totalDocs");
    expect(result).toHaveProperty("page");
  });
});

// ---------------------------------------------------------------------------
// relatedNews
// ---------------------------------------------------------------------------
describe("newsRouter.relatedNews", () => {
  it("returns up to 3 items", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
      const payload = createFakePayload({
        collections: {
          news: [
            makeNews({ id: "n1", slug: "a1" }),
            makeNews({ id: "n2", slug: "a2" }),
            makeNews({ id: "n3", slug: "a3" }),
          ],
        },
      });
      const ctx = mockContext({ payload });

      const result = await call(newsRouter.relatedNews, undefined, {
        context: ctx,
      });

      expect(result.length).toBeLessThanOrEqual(3);
      expect(result.length).toBeGreaterThan(0);
    } finally {
      Math.random = originalRandom;
    }
  });
});

// ---------------------------------------------------------------------------
// like
// ---------------------------------------------------------------------------
describe("newsRouter.like", () => {
  it("rejects unauthenticated callers", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        newsRouter.like,
        { newsId: "news-1", userId: "user-1", slug: "test" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("creates a new like when no existing reaction", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", likesCount: 2, dislikesCount: 1 })],
        reactions: [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.like,
      { newsId: "news-1", userId: "user-1", slug: "test-article" },
      { context: ctx }
    );

    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]).toMatchObject({ type: "like" });
    expect(result.likesCount).toBe(2);
    expect(result.dislikesCount).toBe(1);
  });

  it("toggles off an existing like", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", likesCount: 2, dislikesCount: 1 })],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "news",
            "target.value": "news-1",
            user: "user-1",
            type: "like",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.like,
      { newsId: "news-1", userId: "user-1", slug: "test-article" },
      { context: ctx }
    );

    expect(payload.docs("reactions")).toHaveLength(0);
    expect(result.userReaction).toBe("none");
  });

  it("switches a dislike to a like", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", likesCount: 2, dislikesCount: 1 })],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "news",
            "target.value": "news-1",
            user: "user-1",
            type: "dislike",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.like,
      { newsId: "news-1", userId: "user-1", slug: "test-article" },
      { context: ctx }
    );

    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]?.type).toBe("like");
    expect(result.userReaction).toBe("like");
  });
});

// ---------------------------------------------------------------------------
// dislike
// ---------------------------------------------------------------------------
describe("newsRouter.dislike", () => {
  it("rejects unauthenticated callers", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        newsRouter.dislike,
        { newsId: "news-1", userId: "user-1", slug: "test" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("creates a new dislike when no existing reaction", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", likesCount: 2, dislikesCount: 1 })],
        reactions: [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.dislike,
      { newsId: "news-1", userId: "user-1", slug: "test-article" },
      { context: ctx }
    );

    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]).toMatchObject({ type: "dislike" });
    expect(result.likesCount).toBe(2);
    expect(result.dislikesCount).toBe(1);
  });

  it("toggles off an existing dislike", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", likesCount: 2, dislikesCount: 1 })],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "news",
            "target.value": "news-1",
            user: "user-1",
            type: "dislike",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.dislike,
      { newsId: "news-1", userId: "user-1", slug: "test-article" },
      { context: ctx }
    );

    expect(payload.docs("reactions")).toHaveLength(0);
    expect(result.userReaction).toBe("none");
  });

  it("switches a like to a dislike", async () => {
    const payload = createFakePayload({
      collections: {
        news: [makeNews({ id: "news-1", likesCount: 2, dislikesCount: 1 })],
        reactions: [
          {
            id: "r1",
            "target.relationTo": "news",
            "target.value": "news-1",
            user: "user-1",
            type: "like",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      newsRouter.dislike,
      { newsId: "news-1", userId: "user-1", slug: "test-article" },
      { context: ctx }
    );

    expect(payload.docs("reactions")).toHaveLength(1);
    expect(payload.docs("reactions")[0]?.type).toBe("dislike");
    expect(result.userReaction).toBe("dislike");
  });
});

// ---------------------------------------------------------------------------
// categories
// ---------------------------------------------------------------------------
describe("newsRouter.categories", () => {
  it("returns items from findGlobal", async () => {
    const payload = createFakePayload();
    Object.assign(payload, {
      findGlobal: async () => ({
        items: [
          { title: "Politics", slug: "politics" },
          { title: "Sports", slug: "sports" },
        ],
      }),
    });
    const ctx = mockContext({ payload });

    const result = await call(newsRouter.categories, undefined, {
      context: ctx,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ title: "Politics" });
  });

  it("returns empty array when no categories", async () => {
    const payload = createFakePayload();
    Object.assign(payload, {
      findGlobal: async () => ({ items: [] }),
    });
    const ctx = mockContext({ payload });

    const result = await call(newsRouter.categories, undefined, {
      context: ctx,
    });

    expect(result).toEqual([]);
  });
});
