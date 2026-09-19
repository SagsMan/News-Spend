import type { BasePayload } from "payload";

import {
  ADDRESS_FULFILMENT_TYPES,
  CLAIM_WINDOW_DAYS,
  type FulfilmentStatus,
  type FulfilmentType,
  PHONE_FULFILMENT_TYPES,
} from "../../collections/giveaway/constants";

/** Milliseconds in the claim window. */
const CLAIM_WINDOW_MS = CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export function claimDeadlineFor(selectedAt: Date | string): string {
  const from =
    typeof selectedAt === "string" ? new Date(selectedAt) : selectedAt;
  return new Date(from.getTime() + CLAIM_WINDOW_MS).toISOString();
}

export type ClaimWindow =
  | { open: true }
  | { open: false; reason: "expired" | "superseded"; message: string };

/**
 * Whether a prize can still be claimed.
 *
 * Two independent closers, and the earlier one wins. The fourteen days are the
 * ordinary deadline. The other is the rule the app owner settled: once a
 * later giveaway exists, prizes from earlier ones are closed regardless of
 * how much of the fortnight is left. A giveaway that has been superseded is
 * finished, and leaving its prizes claimable would let unclaimed stock trail
 * across rounds indefinitely.
 *
 * `laterGiveawayExists` is passed in rather than queried here so a caller
 * expiring hundreds of winners does it with one query, not one per row.
 */
export function claimWindowFor(
  winner: { claimDeadline?: string | null; selectedAt?: string | null },
  {
    laterGiveawayExists,
    now = new Date(),
  }: {
    laterGiveawayExists: boolean;
    now?: Date;
  }
): ClaimWindow {
  if (laterGiveawayExists) {
    return {
      open: false,
      reason: "superseded",
      message:
        "This prize can no longer be claimed: a new giveaway has already started.",
    };
  }

  const deadline = winner.claimDeadline
    ? new Date(winner.claimDeadline)
    : winner.selectedAt
      ? new Date(claimDeadlineFor(winner.selectedAt))
      : null;

  if (deadline && now.getTime() > deadline.getTime()) {
    return {
      open: false,
      reason: "expired",
      message: `The ${CLAIM_WINDOW_DAYS}-day claim window for this prize has closed.`,
    };
  }

  return { open: true };
}

/** What the winner must supply for this kind of prize. */
export function claimRequirements(
  type: FulfilmentType,
  { requiresVerification = false }: { requiresVerification?: boolean } = {}
): {
  needsPhone: boolean;
  needsAddress: boolean;
  needsVerification: boolean;
  instant: boolean;
} {
  return {
    needsPhone: PHONE_FULFILMENT_TYPES.includes(type),
    needsAddress: ADDRESS_FULFILMENT_TYPES.includes(type),
    needsVerification: requiresVerification,
    // Points are the only prize the platform can settle by itself the instant
    // it is claimed; everything else waits on a provider or a person. A prize
    // gated on verification is never instant, whatever its type.
    instant: type === "points" && !requiresVerification,
  };
}

/**
 * The fulfilment state a prize enters the moment it is claimed.
 *
 * Verification deliberately gates delivery, not the claim itself. Claiming is
 * what stops the fourteen-day clock, so requiring identity first would mean a
 * winner who cannot finish verification in time loses a prize they legitimately
 * won. This way the claim is secured immediately and the dispatch waits.
 */
export function fulfilmentStateAfterClaim(
  requirements: ReturnType<typeof claimRequirements>,
  currentStatus: string | null | undefined
): FulfilmentStatus | null {
  // A held prize stays held: releasing it is the administrator's call (22.8).
  if (currentStatus === "on_hold") {
    return null;
  }
  if (requirements.needsVerification) {
    return "awaiting_verification";
  }
  return requirements.instant ? "fulfilled" : "pending";
}

/**
 * When the most recent giveaway started, or null if none has.
 *
 * "Started" means it exists and has left `draft`. An active giveaway has
 * superseded its predecessor even if its own draw has not run yet.
 *
 * This replaces a per-prize "is there anything later than me?" query. Asking
 * once for the newest start date answers that question for every prize at the
 * same time, so a list of any length costs one lookup rather than one per
 * giveaway the reader has ever won in.
 */
export async function latestGiveawayStart(
  payload: BasePayload
): Promise<string | null> {
  const latest = await payload.find({
    collection: "giveaways",
    where: {
      and: [
        { status: { not_equals: "draft" } },
        { status: { not_equals: "cancelled" } },
      ],
    },
    sort: "-startDate",
    limit: 1,
    pagination: false,
    depth: 0,
  });

  return (latest.docs[0]?.startDate as string | undefined) ?? null;
}

/** Whether a prize's giveaway has been superseded by a later one. */
export function isSuperseded(
  giveawayStartDate: string | null | undefined,
  latestStart: string | null
): boolean {
  if (!(giveawayStartDate && latestStart)) {
    return false;
  }
  return (
    new Date(latestStart).getTime() > new Date(giveawayStartDate).getTime()
  );
}

/** How many winners one `expireLapsedClaims` pass will look at. */
const EXPIRY_BATCH_SIZE = 200;

/**
 * Mark unclaimed prizes whose window has closed as `expired` (21).
 *
 * Runs from the scheduled task. Expiry is deliberately a stored state rather
 * than something derived on read: an expired prize is a business event that
 * reports and fulfilment both need to see, and deriving it would mean every
 * reader reimplementing the same two rules.
 *
 * Bounded to a batch per pass. A round can produce hundreds of winners, and an
 * unbounded sweep would grow with the platform forever while holding every row
 * in memory. Running hourly, a batch of this size clears far more than a round
 * can generate, and anything left over is simply picked up an hour later.
 *
 * Both lookups it needs (the newest giveaway, and the start dates of the
 * giveaways involved) are fetched once up front, so the cost does not scale
 * with the number of winners.
 *
 * Fulfilment is cancelled alongside the claim, because an unclaimed prize that
 * has expired must not still be sitting in someone's dispatch queue.
 */
export async function expireLapsedClaims(
  payload: BasePayload,
  {
    now = new Date(),
    limit = EXPIRY_BATCH_SIZE,
  }: { now?: Date; limit?: number } = {}
): Promise<number> {
  const unclaimed = await payload.find({
    collection: "giveaway-winners",
    where: { claimStatus: { equals: "unclaimed" } },
    sort: "selectedAt",
    limit,
    pagination: false,
    depth: 1,
  });

  if (unclaimed.docs.length === 0) {
    return 0;
  }

  const latestStart = await latestGiveawayStart(payload);
  let expired = 0;

  for (const winner of unclaimed.docs) {
    const giveaway = winner.giveaway;
    const startDate =
      typeof giveaway === "object" && giveaway !== null
        ? (giveaway.startDate as string)
        : null;

    const window = claimWindowFor(winner, {
      laterGiveawayExists: isSuperseded(startDate, latestStart),
      now,
    });

    if (window.open) {
      continue;
    }

    await payload.update({
      collection: "giveaway-winners",
      id: winner.id,
      data: {
        claimStatus: "expired",
        fulfilmentStatus: "cancelled",
        reviewNote: window.message,
      },
    });

    expired += 1;
  }

  return expired;
}
