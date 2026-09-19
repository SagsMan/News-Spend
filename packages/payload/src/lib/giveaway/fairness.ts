import {
  HIGH_TIER_COOLDOWN_DRAWS,
  LOYALTY_WAIVER_AFTER_DRAWS,
  MAX_CONSECUTIVE_TIER1_WINS,
  type PrizeTier,
  TIER1_COOLDOWN_DRAWS,
  TIER1_SUSPENSION_DRAWS,
} from "../../collections/giveaway/constants";

/**
 * What a user did in each previous completed giveaway, most recent first.
 *
 * `null` means the user did not take part in that giveaway at all, which
 * matters, because a gap breaks the runs that 22.3 and 22.4 depend on.
 */
export type DrawOutcome = PrizeTier | "participated_no_win" | null;

export type UserDrawHistory = {
  /**
   * Outcomes for the last N completed giveaways, most recent first.
   *
   * Only *completed* giveaways appear here, which is what makes 11's streak
   * exceptions fall out for free: a round that was cancelled, never published
   * or invalidated by the platform never reaches `completed`, so it is absent
   * from the sequence rather than counting as a round the user missed.
   */
  outcomes: DrawOutcome[];
};

export type FairnessVerdict =
  | { eligible: true; loyaltyWaiver: boolean }
  | { eligible: false; reason: string; rule: string };

/** How many draws ago the user last won this tier. `null` if not in window. */
function drawsSinceWin(
  history: UserDrawHistory,
  predicate: (outcome: DrawOutcome) => boolean
): number | null {
  const index = history.outcomes.findIndex(predicate);
  // Index 0 is the immediately preceding draw, which is "1 draw ago".
  return index === -1 ? null : index + 1;
}

/** Leading run of consecutive draws whose outcome satisfies `predicate`. */
function leadingRun(
  history: UserDrawHistory,
  predicate: (outcome: DrawOutcome) => boolean
): number {
  let run = 0;
  for (const outcome of history.outcomes) {
    if (!predicate(outcome)) {
      break;
    }
    run += 1;
  }
  return run;
}

/**
 * Whether a Tier 1 suspension from 22.3 is still in force.
 *
 * The rule is "two Tier 1 wins running suspends Tier 1 for the next two
 * draws". So the two wins must sit far enough back that the suspension has not
 * yet elapsed: a run of wins ending 1 or 2 draws ago is still serving it, a run
 * ending 3 draws ago has finished.
 *
 * NOTE: 22.3 is unreachable as the specification stands, and that is a
 * defect in the specification rather than in this code. 22.2 bars Tier 1 for
 * four draws after any Tier 1 win, so a user cannot win Tier 1 in two
 * consecutive draws for 22.3 to react to. The worked examples contradict each
 * other outright: 22.3's shows a user winning Tier 1 in Draw 1 and again in
 * Draw 2, which 22.2 forbids, and restores eligibility at Draw 5 where 22.2
 * would bar until Draw 6.
 *
 * DECISION, pending the specification's author: 22.2 governs. It is the
 * stricter of the two, its own worked example is self-consistent, and treating
 * it as authoritative fails safe, a user barred for four draws is a smaller
 * problem than one who wins Tier 1 twice running because the looser rule was
 * chosen. 22.3 stays implemented as a backstop, so that shortening or
 * removing the 22.2 cooldown brings it into force with no further work.
 */
function isUnderTier1Suspension(history: UserDrawHistory): boolean {
  const { outcomes } = history;

  for (let start = 0; start < outcomes.length; start += 1) {
    let run = 0;
    while (start + run < outcomes.length && outcomes[start + run] === "tier1") {
      run += 1;
    }

    if (run >= MAX_CONSECUTIVE_TIER1_WINS) {
      // `start` draws have elapsed since that run of wins ended.
      return start < TIER1_SUSPENSION_DRAWS;
    }

    if (run > 0) {
      start += run - 1;
    }
  }

  return false;
}

/**
 * Whether the user has earned 22.4's Featured Offer waiver: participating in
 * `LOYALTY_WAIVER_AFTER_DRAWS` consecutive draws and winning nothing in any of
 * them. A draw the user sat out breaks the run, as does any win.
 */
export function hasLoyaltyWaiver(history: UserDrawHistory): boolean {
  const run = leadingRun(history, (o) => o === "participated_no_win");
  return run >= LOYALTY_WAIVER_AFTER_DRAWS;
}

/**
 * Apply the fairness rules for one tier (spec 22.1–22.4).
 *
 * Returns whether the user may enter this tier's candidate pool, and whether
 * the loyalty waiver should relax the Featured Offer requirement for them.
 * Eligibility thresholds themselves are evaluated separately. This only
 * answers the fairness question.
 */
export function evaluateFairness(
  tier: PrizeTier,
  history: UserDrawHistory
): FairnessVerdict {
  const loyaltyWaiver = tier === "tier1" && hasLoyaltyWaiver(history);

  // 22.1: a Tier 1 or Tier 2 win bars both high tiers for one draw.
  if (tier === "tier1" || tier === "tier2") {
    const sinceHighTierWin = drawsSinceWin(
      history,
      (o) => o === "tier1" || o === "tier2"
    );

    if (
      sinceHighTierWin !== null &&
      sinceHighTierWin <= HIGH_TIER_COOLDOWN_DRAWS
    ) {
      return {
        eligible: false,
        rule: "22.1",
        reason: `Won a high-tier prize ${sinceHighTierWin} draw(s) ago; Tier 1 and Tier 2 are barred for ${HIGH_TIER_COOLDOWN_DRAWS} draw(s).`,
      };
    }
  }

  if (tier === "tier1") {
    // 22.2: a Tier 1 win bars Tier 1 for four subsequent draws.
    const sinceTier1Win = drawsSinceWin(history, (o) => o === "tier1");
    if (sinceTier1Win !== null && sinceTier1Win <= TIER1_COOLDOWN_DRAWS) {
      return {
        eligible: false,
        rule: "22.2",
        reason: `Won Tier 1 ${sinceTier1Win} draw(s) ago; Tier 1 is barred for ${TIER1_COOLDOWN_DRAWS} draws.`,
      };
    }

    // 22.3: two Tier 1 wins running suspends Tier 1 for two draws.
    if (isUnderTier1Suspension(history)) {
      return {
        eligible: false,
        rule: "22.3",
        reason: `Won Tier 1 in ${MAX_CONSECUTIVE_TIER1_WINS} consecutive draws; Tier 1 is suspended for ${TIER1_SUSPENSION_DRAWS} draws.`,
      };
    }
  }

  return { eligible: true, loyaltyWaiver };
}
