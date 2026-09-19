import {
  CONSECUTIVE_ELIGIBILITY,
  CONSECUTIVE_GIVEAWAYS_REQUIRED,
  PRIMARY_ELIGIBILITY,
  type PrizeTier,
} from "../../collections/giveaway/constants";

/** Everything known about one user's participation in the active giveaway. */
export type Participation = {
  userId: string | number;
  /** Sum of quantities across all valid tickets. */
  validTickets: number;
  /** Successful Boost Your Luck interactions. */
  boosts: number;
  /** Successful Featured Offer completions. */
  featuredOffers: number;
  /** Persisted consecutive-giveaway streak per tier, before this giveaway. */
  streaks: Partial<Record<PrizeTier, number>>;
};

export type EligibilityResult = {
  eligible: boolean;
  /** Which path qualified the user, if any. */
  path: "primary" | "consecutive" | "loyalty" | null;
};

/**
 * Determine whether a user qualifies for a tier (spec 11).
 *
 * A user qualifies through either the Primary Eligibility Path or the
 * Consecutive Giveaway Eligibility Path; meeting either is sufficient.
 */
export function evaluateEligibility(
  tier: PrizeTier,
  participation: Participation,
  /**
   * 22.4 loyalty waiver. Waives the Featured Offer requirement only: the
   * ticket and Boost Your Luck requirements still apply in full, and the
   * waiver applies to Tier 1 alone.
   */
  loyaltyWaiver = false
): EligibilityResult {
  const primary = PRIMARY_ELIGIBILITY[tier];
  const offersRequired = loyaltyWaiver ? 0 : primary.featuredOffers;

  if (
    participation.validTickets >= primary.tickets &&
    participation.boosts >= primary.boosts &&
    participation.featuredOffers >= offersRequired
  ) {
    return { eligible: true, path: loyaltyWaiver ? "loyalty" : "primary" };
  }

  const consecutive = CONSECUTIVE_ELIGIBILITY[tier];
  if (!consecutive) {
    return { eligible: false, path: null };
  }

  // The streak is counted from previous giveaways; the user must also meet the
  // consecutive bar in this one for the run to be unbroken through today.
  const priorStreak = participation.streaks[tier] ?? 0;
  const meetsBarThisGiveaway =
    participation.validTickets >= consecutive.tickets &&
    participation.boosts >= consecutive.boosts &&
    participation.featuredOffers >= consecutive.featuredOffers;

  if (
    meetsBarThisGiveaway &&
    priorStreak + 1 >= CONSECUTIVE_GIVEAWAYS_REQUIRED
  ) {
    return { eligible: true, path: "consecutive" };
  }

  return { eligible: false, path: null };
}

/**
 * The streak value to persist after this giveaway (spec 11): incremented when
 * the user met the tier's consecutive bar, reset to zero on any miss.
 */
export function nextStreakValue(
  tier: PrizeTier,
  participation: Participation
): number | null {
  const consecutive = CONSECUTIVE_ELIGIBILITY[tier];
  if (!consecutive) {
    return null;
  }

  const met =
    participation.validTickets >= consecutive.tickets &&
    participation.boosts >= consecutive.boosts &&
    participation.featuredOffers >= consecutive.featuredOffers;

  return met ? (participation.streaks[tier] ?? 0) + 1 : 0;
}

/**
 * Maximum winners for a tier (spec 3).
 *
 * Always rounded down. The percentage is applied to Total Valid Participants,
 * which is never filtered by tier eligibility and never reduced as higher tiers
 * award winners.
 */
export function maxTierWinners(
  totalValidParticipants: number,
  winnerPercentage: number
): number {
  if (winnerPercentage <= 0 || totalValidParticipants <= 0) {
    return 0;
  }
  return Math.floor((totalValidParticipants * winnerPercentage) / 100);
}
