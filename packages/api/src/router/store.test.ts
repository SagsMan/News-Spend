import { describe, expect, it, mock } from "bun:test";
import { call } from "@orpc/server";

import {
  createFakePayload,
  type Doc,
  expectError,
  mockContext,
} from "../test-utils";
import { storeRouter } from "./store";

// Mock redis for popular/trackView/trackClick
const fakeRedis: {
  zrevrange: () => Promise<string[]>;
  zincrby: (key: string, weight: number, member: string) => Promise<number>;
} = {
  zrevrange: async () => [],
  zincrby: async () => 1,
};

mock.module("../lib/redis", () => ({
  getRedis: () => fakeRedis,
}));

function store(overrides: Doc = {}): Doc {
  return {
    id: "s1",
    websiteUrl: "https://example.com",
    logo: "logo.png",
    description: "A store",
    cashBack: 5,
    slug: "example",
    companyName: "Example",
    createdAt: "2026-01-01T00:00:00.000Z",
    popularityScore: 10,
    inShopTab: true,
    ...overrides,
  };
}

describe("storeRouter.all", () => {
  it("uses default sort by popularity", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    await call(storeRouter.all, {}, { context: ctx });

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.sort).toBe("-popularityScore");
  });

  it("maps newest sortBy to -createdAt", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    await call(storeRouter.all, { sortBy: "newest" }, { context: ctx });

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.sort).toBe("-createdAt");
  });

  it("maps cashback sortBy to -cashBack", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    await call(storeRouter.all, { sortBy: "cashback" }, { context: ctx });

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.sort).toBe("-cashBack");
  });

  it("passes page and limit through to payload.find", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    await call(storeRouter.all, { page: 3, limit: 25 }, { context: ctx });

    const findCall = payload.calls.find((c) => c.op === "find");
    expect(findCall?.args.page).toBe(3);
    expect(findCall?.args.limit).toBe(25);
  });

  it("filters by inShopTab equals true", async () => {
    const payload = createFakePayload({
      collections: {
        partners: [
          store({ id: "s1", inShopTab: true }),
          store({ id: "s2", slug: "hidden", inShopTab: false }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(storeRouter.all, {}, { context: ctx });

    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]?.id).toBe("s1");
  });
});

describe("storeRouter.popular", () => {
  it("returns empty array when redis has no ids", async () => {
    fakeRedis.zrevrange = async () => [];
    const payload = createFakePayload({ collections: { partners: [store()] } });
    const ctx = mockContext({ payload });

    const result = await call(storeRouter.popular, {}, { context: ctx });

    expect(result).toEqual([]);
    // Should not call payload.find if no redis ids
    expect(payload.calls.filter((c) => c.op === "find")).toHaveLength(0);
  });

  it("preserves redis ranking order", async () => {
    fakeRedis.zrevrange = async () => ["s2", "s1", "s3"];
    const payload = createFakePayload({
      collections: {
        partners: [
          store({ id: "s1" }),
          store({ id: "s2", slug: "second" }),
          store({ id: "s3", slug: "third" }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(storeRouter.popular, {}, { context: ctx });

    expect(result.map((d) => d?.id)).toEqual(["s2", "s1", "s3"]);
  });

  it("filters out stores not in shop tab", async () => {
    fakeRedis.zrevrange = async () => ["s1", "s2"];
    const payload = createFakePayload({
      collections: {
        partners: [
          store({ id: "s1", inShopTab: true }),
          store({ id: "s2", slug: "hidden", inShopTab: false }),
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(storeRouter.popular, {}, { context: ctx });

    // s2 filtered out by inShopTab, s1 present
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("s1");
  });
});

describe("storeRouter.one", () => {
  it("returns a store by slug", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      storeRouter.one,
      { slug: "example" },
      { context: ctx }
    );

    expect(result?.slug).toBe("example");
  });

  it("throws NOT_FOUND when slug does not exist", async () => {
    const payload = createFakePayload({ collections: { partners: [] } });
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(storeRouter.one, { slug: "nonexistent" }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Store not found",
    });
  });
});

describe("storeRouter.trackView", () => {
  it("creates a shop-analytics doc with type view", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      storeRouter.trackView,
      { storeId: "s1" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true });
    const analyticsDoc = payload.docs("shop-analytics")[0];
    expect(analyticsDoc).toMatchObject({
      store: "s1",
      type: "view",
      device: "unknown",
      platform: "web",
    });
  });

  it("passes userId, device and platform", async () => {
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    await call(
      storeRouter.trackView,
      { storeId: "s1", userId: "u1", device: "mobile", platform: "ios" },
      { context: ctx }
    );

    const analyticsDoc = payload.docs("shop-analytics")[0];
    expect(analyticsDoc).toMatchObject({
      userId: "u1",
      device: "mobile",
      platform: "ios",
    });
  });

  it("swallows redis errors gracefully", async () => {
    const original = fakeRedis.zincrby;
    fakeRedis.zincrby = () => Promise.reject(new Error("redis down"));
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      storeRouter.trackView,
      { storeId: "s1" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true });
    // Analytics doc still created
    expect(payload.docs("shop-analytics")).toHaveLength(1);
    fakeRedis.zincrby = original;
  });
});

describe("storeRouter.trackClick", () => {
  it("creates a shop-analytics doc with type click", async () => {
    fakeRedis.zincrby = async () => 1;
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    const result = await call(
      storeRouter.trackClick,
      { storeId: "s1" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true });
    const analyticsDoc = payload.docs("shop-analytics")[0];
    expect(analyticsDoc).toMatchObject({
      store: "s1",
      type: "click",
      device: "unknown",
      platform: "web",
    });
  });

  it("updates popularity score via redis zincrby", async () => {
    let capturedKey = "";
    let capturedWeight = 0;
    let capturedMember = "";
    fakeRedis.zincrby = (key: string, weight: number, member: string) => {
      capturedKey = key;
      capturedWeight = weight;
      capturedMember = member;
      return Promise.resolve(42);
    };
    const payload = createFakePayload({
      collections: { partners: [store()] },
    });
    const ctx = mockContext({ payload });

    await call(storeRouter.trackClick, { storeId: "s1" }, { context: ctx });

    expect(capturedKey).toBe("store:popularity");
    expect(capturedWeight).toBe(0.7);
    expect(capturedMember).toBe("s1");
    // Also updates partner doc
    const updateCall = payload.calls.find(
      (c) => c.op === "update" && c.collection === "partners"
    );
    expect(updateCall?.args.data).toMatchObject({ popularityScore: 42 });
  });
});
