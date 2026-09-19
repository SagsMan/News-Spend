import { describe, expect, it } from "bun:test";
import { simulateDraw } from "@news-spend-media/payload/lib/giveaway/simulateDraw";

type Row = Record<string, any>;

function createPayload({
  giveaway = {},
  pool = [],
  catalogue = [],
}: {
  giveaway?: Row;
  pool?: Row[];
  catalogue?: Row[];
} = {}) {
  const collections: Record<string, Row[]> = {
    "giveaway-prizes": pool,
    "prize-catalogue": catalogue,
  };

  return {
    findByID: async () => ({
      id: "g1",
      name: "August 2026",
      tier1WinnerPercentage: 0.1,
      tier2WinnerPercentage: 0.5,
      tier3WinnerPercentage: 5,
      ...giveaway,
    }),
    find: async ({ collection }: Row) => ({
      docs: collections[collection] ?? [],
    }),
  } as never;
}

function poolRow(tier: string, name: string, maxUnits: number, id = name): Row {
  return {
    id: `p-${id}`,
    tier,
    maxUnits,
    unitsAwarded: 0,
    prize: { id, name },
  };
}

describe("simulateDraw", () => {
  it("shows a tier awarding nothing below its rounding threshold", async () => {
    const payload = createPayload({
      pool: [poolRow("tier3", "500 Airtime", 30)],
    });

    const result = await simulateDraw(payload, "g1", { participants: 10 });
    const tier3 = result.tiers.find((t) => t.tier === "tier3")!;

    // 5% of 10 is 0.5, which floors to zero. This is the surprise the owner
    // hit: a giveaway that ran and awarded nothing at that tier.
    expect(tier3.maxByPercentage).toBe(0);
    expect(tier3.effectiveCap).toBe(0);
    expect(result.warnings.join(" ")).toContain("needs 20");
  });

  it("caps a tier at its pooled units, not its percentage", async () => {
    const payload = createPayload({
      pool: [poolRow("tier3", "500 Airtime", 30)],
    });

    // 5% of 1000 is 50, but only 30 units exist.
    const result = await simulateDraw(payload, "g1", { participants: 1000 });
    const tier3 = result.tiers.find((t) => t.tier === "tier3")!;

    expect(tier3.maxByPercentage).toBe(50);
    expect(tier3.unitsAvailable).toBe(30);
    expect(tier3.effectiveCap).toBe(30);
    expect(tier3.limitedBy).toBe("units");
  });

  it("names every catalogue prize this giveaway cannot award", async () => {
    const payload = createPayload({
      pool: [poolRow("tier3", "500 Airtime", 30, "airtime")],
      catalogue: [
        { id: "airtime", name: "500 Airtime", tier: "tier3" },
        { id: "generator", name: "Generator", tier: "tier1" },
      ],
    });

    const result = await simulateDraw(payload, "g1", { participants: 500 });

    // The whole point: a prize left out of the pool is unwinnable, and the
    // operator can see that before the draw rather than after it.
    expect(result.excluded).toEqual([{ name: "Generator", tier: "tier1" }]);
  });

  it("sums units across several prizes at the same tier", async () => {
    const payload = createPayload({
      pool: [
        poolRow("tier3", "500 Airtime", 30, "a"),
        poolRow("tier3", "2GB Data", 10, "d"),
      ],
    });

    const result = await simulateDraw(payload, "g1", { participants: 1000 });
    const tier3 = result.tiers.find((t) => t.tier === "tier3")!;

    expect(tier3.unitsAvailable).toBe(40);
    expect(tier3.prizes).toHaveLength(2);
  });

  it("does not count units already awarded", async () => {
    const payload = createPayload({
      pool: [{ ...poolRow("tier3", "500 Airtime", 30), unitsAwarded: 25 }],
    });

    const result = await simulateDraw(payload, "g1", { participants: 1000 });

    expect(result.tiers.find((t) => t.tier === "tier3")!.unitsAvailable).toBe(
      5
    );
  });

  it("warns when an enabled tier has no prizes at all", async () => {
    const payload = createPayload({ pool: [] });

    const result = await simulateDraw(payload, "g1", { participants: 1000 });

    expect(result.warnings.join(" ")).toContain("refuse to start");
  });

  it("applies the percentage to total participants, not the eligible subset", async () => {
    const payload = createPayload({
      pool: [poolRow("tier1", "Generator", 5)],
      giveaway: { tier1WinnerPercentage: 10 },
    });

    // Only 20 of 100 meet tier 1's bar, but 9 applies the percentage to all
    // 100. Reducing it to the eligible subset would understate the draw.
    const result = await simulateDraw(payload, "g1", {
      participants: 100,
      eligible: { tier1: 20 },
    });
    const tier1 = result.tiers.find((t) => t.tier === "tier1")!;

    expect(tier1.maxByPercentage).toBe(10);
    expect(tier1.eligible).toBe(20);
    expect(tier1.effectiveCap).toBe(5);
  });

  it("shrinks the pool available to later tiers by earlier winners", async () => {
    const payload = createPayload({
      giveaway: { tier1WinnerPercentage: 50, tier3WinnerPercentage: 100 },
      pool: [
        poolRow("tier1", "Generator", 5, "gen"),
        poolRow("tier3", "500 Airtime", 100, "air"),
      ],
    });

    const result = await simulateDraw(payload, "g1", { participants: 10 });
    const tier1 = result.tiers.find((t) => t.tier === "tier1")!;
    const tier3 = result.tiers.find((t) => t.tier === "tier3")!;

    // A tier 1 winner cannot also win tier 3 (22), so the 5 who did are gone.
    expect(tier1.effectiveCap).toBe(5);
    expect(tier3.eligible).toBe(5);
  });
});
