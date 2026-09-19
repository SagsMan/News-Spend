import { describe, expect, it } from "bun:test";

import { createFakePayload } from "../../test-utils";
import { type AdConfig, createAdManager } from "./ad-manager";

const PLACEMENT = "homepage-ads-banner";

/** Always draw in-house, so the tests measure selection rather than the coin flip. */
const CONFIG: AdConfig = {
  inHouseAdProbability: 1,
  googleAdSlot: "banner_1",
  placements: [PLACEMENT],
  poolSize: 10,
};

type Seed = { id: string; weight?: number | null };

function payloadWith(seeds: Seed[]) {
  return createFakePayload({
    collections: {
      "partner-content": seeds.map((seed) => ({
        id: seed.id,
        title: seed.id,
        status: "active",
        placements: [PLACEMENT],
        ...(seed.weight === undefined ? {} : { weight: seed.weight }),
      })),
    },
  });
}

/**
 * One manager per request, mirroring the handler: `createAdManager` is called
 * per feed request, so share of voice is decided across requests, not within
 * one long-lived instance.
 */
async function drawFirstAcrossRequests(seeds: Seed[], requests: number) {
  const counts: Record<string, number> = {};
  for (let i = 0; i < requests; i++) {
    const manager = await createAdManager(payloadWith(seeds) as any, CONFIG);
    const item = manager.getPartnerContent();
    if (item) {
      counts[item.id] = (counts[item.id] ?? 0) + 1;
    }
  }
  return counts;
}

describe("AdManager weighted selection", () => {
  it("gives a heavier item proportionally more share of voice", async () => {
    const counts = await drawFirstAcrossRequests(
      [
        { id: "heavy", weight: 3 },
        { id: "a", weight: 1 },
        { id: "b", weight: 1 },
        { id: "c", weight: 1 },
      ],
      4000
    );

    // weight 3 of 6 total => ~50%. Wide band: this is a random draw.
    const heavyShare = (counts.heavy ?? 0) / 4000;
    expect(heavyShare).toBeGreaterThan(0.42);
    expect(heavyShare).toBeLessThan(0.58);

    // The light three split the rest, none starved.
    for (const id of ["a", "b", "c"]) {
      const share = (counts[id] ?? 0) / 4000;
      expect(share).toBeGreaterThan(0.1);
      expect(share).toBeLessThan(0.24);
    }
  });

  it("treats an unset weight as the default of 1", async () => {
    const counts = await drawFirstAcrossRequests(
      [{ id: "unset" }, { id: "explicit", weight: 1 }],
      2000
    );

    const unsetShare = (counts.unset ?? 0) / 2000;
    expect(unsetShare).toBeGreaterThan(0.4);
    expect(unsetShare).toBeLessThan(0.6);
  });

  it("never draws an item weighted 0", async () => {
    const counts = await drawFirstAcrossRequests(
      [
        { id: "withheld", weight: 0 },
        { id: "live", weight: 1 },
      ],
      500
    );

    expect(counts.withheld).toBeUndefined();
    expect(counts.live).toBe(500);
  });

  it("does not repeat an item until the pool is exhausted", async () => {
    const manager = await createAdManager(
      payloadWith([
        { id: "a", weight: 5 },
        { id: "b", weight: 1 },
        { id: "c", weight: 1 },
      ]) as any,
      CONFIG
    );

    // A single feed page must not show the same ad twice, however heavy it is.
    const cycle = [
      manager.getPartnerContent()?.id,
      manager.getPartnerContent()?.id,
      manager.getPartnerContent()?.id,
    ];
    expect(new Set(cycle).size).toBe(3);

    // Past the cycle it starts over rather than running dry.
    expect(manager.getPartnerContent()).toBeDefined();
  });

  it("reports no partner content when everything is withheld", async () => {
    const manager = await createAdManager(
      payloadWith([
        { id: "a", weight: 0 },
        { id: "b", weight: 0 },
      ]) as any,
      CONFIG
    );

    expect(manager.hasPartnerContent).toBe(false);
    expect(manager.getPartnerContent()).toBeUndefined();
    // With nothing in-house to serve, the slot falls back to Google.
    expect(manager.pickAd().type).toBe("gAd");
  });
});
