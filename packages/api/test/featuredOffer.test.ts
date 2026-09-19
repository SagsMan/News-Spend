import { describe, expect, it } from "bun:test";
import { recordFeaturedOffer } from "@news-spend-media/payload/lib/giveaway/featuredOffer";

type Row = Record<string, any>;

const OPEN_GIVEAWAY = {
  id: "g1",
  status: "active",
  startDate: new Date(Date.now() - 86_400_000).toISOString(),
  endDate: new Date(Date.now() + 86_400_000).toISOString(),
};

function createFakePayload({
  giveaways = [OPEN_GIVEAWAY],
  content = { id: "c1", placements: ["lucky-app-wall"] },
  tickets = 1,
  engagements = 0,
}: Partial<{
  giveaways: Row[];
  content: Row | null;
  tickets: number;
  engagements: number;
}> = {}) {
  const created: Row[] = [];

  const payload: any = {
    logger: { error: () => undefined, warn: () => undefined },
    find: async ({ collection }: Row) =>
      collection === "giveaways"
        ? { docs: giveaways, totalDocs: giveaways.length }
        : { docs: [], totalDocs: 0 },
    findByID: async ({ collection }: Row) => {
      if (collection === "partner-content") {
        if (!content) {
          throw new Error("not found");
        }
        return content;
      }
      return null;
    },
    count: async ({ collection }: Row) => ({
      totalDocs:
        collection === "giveaway-tickets"
          ? tickets
          : collection === "giveaway-engagements"
            ? engagements
            : 0,
    }),
    create: async ({ data }: Row) => {
      created.push(data);
      return { id: "e1", ...data };
    },
  };

  return { payload, created };
}

const ARGS = { userId: "u1", contentId: "c1" };

describe("recordFeaturedOffer", () => {
  it("records a completion for an app-wall offer", async () => {
    const { payload, created } = createFakePayload();

    const result = await recordFeaturedOffer(payload, ARGS);

    expect(result.recorded).toBe(true);
    expect(created[0]).toMatchObject({
      type: "featured_offer",
      content: "c1",
      completionStatus: "completed",
    });
  });

  it("ignores an offer that is not an app-wall placement", async () => {
    const { payload, created } = createFakePayload({
      content: { id: "c1", placements: ["connect-brand-video"] },
    });

    const result = await recordFeaturedOffer(payload, ARGS);

    // A Connect Brands video is a Boost. Letting it count here would make the
    // two interchangeable and Tier 1 reachable from one surface.
    expect(result.recorded).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("does nothing without a valid ticket", async () => {
    const { payload, created } = createFakePayload({ tickets: 0 });

    const result = await recordFeaturedOffer(payload, ARGS);

    expect(result.recorded).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("does not count the same offer twice", async () => {
    const { payload, created } = createFakePayload({ engagements: 1 });

    const result = await recordFeaturedOffer(payload, ARGS);

    expect(result.recorded).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("does nothing when no giveaway is running", async () => {
    const { payload } = createFakePayload({ giveaways: [] });

    expect((await recordFeaturedOffer(payload, ARGS)).recorded).toBe(false);
  });

  it("does nothing once the giveaway has closed", async () => {
    const { payload } = createFakePayload({
      giveaways: [
        {
          ...OPEN_GIVEAWAY,
          endDate: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    });

    // The pool locks at draw time, so an engagement recorded afterwards could
    // never have counted anyway.
    expect((await recordFeaturedOffer(payload, ARGS)).recorded).toBe(false);
  });

  it("never throws, so a settled conversion cannot be undone", async () => {
    const { payload } = createFakePayload();
    payload.create = async () => {
      throw new Error("database is on fire");
    };

    // The partner has been answered and the points already credited by the
    // time this runs. Throwing here would fail a payout that already happened.
    const result = await recordFeaturedOffer(payload, ARGS);

    expect(result.recorded).toBe(false);
    expect(result.reason).toBe("error");
  });
});
