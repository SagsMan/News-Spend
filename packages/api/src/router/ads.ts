import { openapi } from "@orpc/openapi";

import { publicProcedure } from "../index";

export const getPromoMedia = publicProcedure
  .meta(
    openapi({
      method: "GET",
      path: "/ads/promo-media",
      tags: ["Ads"],
      summary: "Get promo media",
      description: "Get promo media for the current user",
    })
  )
  .handler(async ({ context }) => {
    const { payload } = context;
    // Bounded and shallow. This was `pagination: false` at Payload's default
    // depth, so a public GET hydrated the whole partner-content table with
    // every relationship populated.
    const ads = await payload.find({
      collection: "partner-content",
      where: { type: { equals: "promo-media" } },
      depth: 1,
      limit: 50,
      sort: "-createdAt",
    });

    return ads.docs;
  });

export const adsRouter = {
  getPromoMedia,
};
