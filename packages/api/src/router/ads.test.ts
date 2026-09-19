import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { createFakePayload, mockContext } from "../test-utils";
import { adsRouter } from "./ads";

describe("adsRouter.getPromoMedia", () => {
  it("returns promo-media documents from partner-content", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          { id: "ad-1", type: "promo-media", title: "Summer Sale" },
          { id: "ad-2", type: "promo-media", title: "Black Friday" },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(adsRouter.getPromoMedia, undefined, {
      context: ctx,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "ad-1", type: "promo-media" });
    expect(result[1]).toMatchObject({ id: "ad-2", type: "promo-media" });
  });

  it("filters out non-promo-media entries", async () => {
    const payload = createFakePayload({
      collections: {
        "partner-content": [
          { id: "ad-1", type: "promo-media", title: "Summer Sale" },
          { id: "ad-2", type: "banner", title: "Generic Banner" },
          { id: "ad-3", type: "sponsored", title: "Sponsored Post" },
        ],
      },
    });
    const ctx = mockContext({ payload });

    const result = await call(adsRouter.getPromoMedia, undefined, {
      context: ctx,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "ad-1", type: "promo-media" });
  });

  it("returns an empty array when the collection is empty", async () => {
    const payload = createFakePayload({
      collections: { "partner-content": [] },
    });
    const ctx = mockContext({ payload });

    const result = await call(adsRouter.getPromoMedia, undefined, {
      context: ctx,
    });

    expect(result).toEqual([]);
  });
});
