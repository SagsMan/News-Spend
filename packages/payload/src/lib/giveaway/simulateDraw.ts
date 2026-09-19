import type { BasePayload } from "payload";

import {
  type PrizeTier,
  TIER_PROCESSING_ORDER,
} from "../../collections/giveaway/constants";
import { maxTierWinners } from "./eligibility";

/**
 * Answer "what could this giveaway actually award?" before running it.
 *
 * The engine already refuses to award a prize that is not in the pool, and
 * already caps each prize at its Maximum Units: but neither fact is visible
 * until a draw has run, and by then it is not a question any more. A giveaway
 * with a generator in the catalogue and no budget to honour it is a decision
 * made at configuration time, and the operator deserves to see the
 * consequences at configuration time too.
 *
 * WHAT THIS IS NOT. It does not sample, shuffle or pick anybody: it reports
 * the CAPS, which is the part that determines what is possible. Who wins is
 * random; how many can win, and of what, is arithmetic: and the arithmetic is
 * what nobody could see.
 *
 * Reuses `maxTierWinners`, the same function the draw applies, rather than
 * restating the percentage rule. A simulator that computes its answer
 * differently from the engine is worse than none: it would be believed.
 */

export type TierSimulation = {
  tier: PrizeTier;
  winnerPercentage: number;
  /** Participants meeting this tier's eligibility bar, as supplied. */
  eligible: number;
  /** 9: the percentage cap, applied to TOTAL participants, not eligible ones. */
  maxByPercentage: number;
  /** Sum of Maximum Units across the prizes pooled at this tier. */
  unitsAvailable: number;
  /** What the draw would actually be limited to. */
  effectiveCap: number;
  /** Which of the three limits is the binding one. */
  limitedBy: "percentage" | "units" | "candidates" | "nothing";
  prizes: { name: string; maxUnits: number }[];
};

export type DrawSimulation = {
  giveawayName: string;
  participants: number;
  tiers: TierSimulation[];
  totalWinners: number;
  /** Prizes in the catalogue that this giveaway can never award. */
  excluded: { name: string; tier: string }[];
  warnings: string[];
};

export async function simulateDraw(
  payload: BasePayload,
  giveawayId: string,
  {
    participants,
    eligible,
  }: {
    participants: number;
    /** Per-tier eligible counts. Defaults to every participant. */
    eligible?: Partial<Record<PrizeTier, number>>;
  }
): Promise<DrawSimulation> {
  const giveaway = await payload.findByID({
    collection: "giveaways",
    id: giveawayId,
    depth: 0,
  });

  const pool = await payload.find({
    collection: "giveaway-prizes",
    where: { giveaway: { equals: giveawayId } },
    pagination: false,
    depth: 1,
  });

  const catalogue = await payload.find({
    collection: "prize-catalogue",
    where: { active: { equals: true } },
    pagination: false,
    depth: 0,
  });

  const pooledPrizeIds = new Set(
    pool.docs.map((row) =>
      typeof row.prize === "string" ? row.prize : String(row.prize?.id)
    )
  );

  const warnings: string[] = [];
  const tiers: TierSimulation[] = [];

  /**
   * A winner is removed from consideration for every later tier (22), so the
   * pool each tier draws from is what the ones before it left behind. Walking
   * the tiers in the engine's own order keeps that shrinkage honest.
   */
  let remaining = participants;

  for (const tier of TIER_PROCESSING_ORDER) {
    const winnerPercentage = Number(
      tier === "tier1"
        ? giveaway?.tier1WinnerPercentage
        : tier === "tier2"
          ? giveaway?.tier2WinnerPercentage
          : giveaway?.tier3WinnerPercentage
    );

    const tierRows = pool.docs.filter((row) => row.tier === tier);
    const unitsAvailable = tierRows.reduce(
      (sum, row) =>
        sum + (Number(row.maxUnits ?? 0) - Number(row.unitsAwarded ?? 0)),
      0
    );

    // Percentage is applied to TOTAL participants: never to the eligible
    // subset, and never reduced by earlier tiers. That is 9, and getting it
    // wrong here would make the simulation flatter than the real draw.
    const maxByPercentage = maxTierWinners(participants, winnerPercentage);

    const eligibleHere = Math.min(eligible?.[tier] ?? participants, remaining);

    const effectiveCap = Math.min(
      maxByPercentage,
      unitsAvailable,
      eligibleHere
    );

    const limitedBy =
      effectiveCap === 0 && winnerPercentage <= 0
        ? "nothing"
        : effectiveCap === maxByPercentage
          ? "percentage"
          : effectiveCap === unitsAvailable
            ? "units"
            : "candidates";

    if (winnerPercentage > 0 && tierRows.length === 0) {
      warnings.push(
        `${tier} is enabled at ${winnerPercentage}% but has no prizes pooled: the draw will refuse to start.`
      );
    }
    if (winnerPercentage > 0 && maxByPercentage === 0) {
      warnings.push(
        `${tier} awards nothing at ${participants} participants: ${winnerPercentage}% of ${participants} rounds down to zero. It needs ${Math.ceil(100 / winnerPercentage)}.`
      );
    }
    if (unitsAvailable > 0 && maxByPercentage > unitsAvailable) {
      warnings.push(
        `${tier} could award ${maxByPercentage} by percentage but only ${unitsAvailable} unit(s) are pooled, so units are the real limit.`
      );
    }

    tiers.push({
      tier,
      winnerPercentage,
      eligible: eligibleHere,
      maxByPercentage,
      unitsAvailable,
      effectiveCap,
      limitedBy,
      prizes: tierRows.map((row) => ({
        name: String(
          typeof row.prize === "object" && row.prize
            ? ((row.prize as { name?: string }).name ?? "Unnamed prize")
            : "Unnamed prize"
        ),
        maxUnits: Number(row.maxUnits ?? 0),
      })),
    });

    remaining = Math.max(0, remaining - effectiveCap);
  }

  /**
   * The reassurance the operator actually asked for: everything in the
   * catalogue that this giveaway CANNOT award, however the draw falls.
   */
  const excluded = catalogue.docs
    .filter((prize) => !pooledPrizeIds.has(String(prize.id)))
    .map((prize) => ({
      name: String(prize.name ?? ""),
      tier: String(prize.tier ?? ""),
    }));

  return {
    giveawayName: String(giveaway?.name ?? ""),
    participants,
    tiers,
    totalWinners: tiers.reduce((sum, tier) => sum + tier.effectiveCap, 0),
    excluded,
    warnings,
  };
}
