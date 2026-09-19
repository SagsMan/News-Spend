import type { BasePayload, Where } from "payload";

import {
  FAIRNESS_LOOKBACK_DRAWS,
  type PrizeTier,
} from "../../collections/giveaway/constants";
import type { DrawOutcome, UserDrawHistory } from "./fairness";

/**
 * Reconstruct what each user did in the previous completed giveaways, most
 * recent first (spec 22).
 *
 * Only giveaways that reached `completed` are included. That is what makes
 * Section 11's streak exceptions fall out for free: a round that was cancelled,
 * never published or invalidated never reaches `completed`, so it is absent
 * from the sequence rather than counting as a round the user missed.
 *
 * Nothing is stored: cooldowns and the loyalty waiver are derived from the
 * winner and ticket records that already exist, so there are no counters to
 * drift out of step with reality. That also means the draw and the app agree
 * by construction: both call this, rather than one of them keeping its own
 * tally.
 *
 * Pass `userId` to load one person's history. The app needs exactly that when
 * showing someone their own standing, and scoping the queries keeps it cheap.
 */
export async function loadDrawHistories(
  payload: BasePayload,
  { before, userId }: { before: string; userId?: string }
): Promise<Map<string, UserDrawHistory>> {
  const priorGiveaways = await payload.find({
    collection: "giveaways",
    where: {
      and: [
        { status: { equals: "completed" } },
        { endDate: { less_than: before } },
      ],
    },
    sort: "-endDate",
    limit: FAIRNESS_LOOKBACK_DRAWS,
    pagination: false,
    depth: 0,
  });

  const histories = new Map<string, UserDrawHistory>();
  if (priorGiveaways.docs.length === 0) {
    return histories;
  }

  const priorIds = priorGiveaways.docs.map((giveaway) => giveaway.id);
  const forUser: Where[] = userId ? [{ user: { equals: userId } }] : [];

  const [winners, tickets] = await Promise.all([
    payload.find({
      collection: "giveaway-winners",
      where: { and: [{ giveaway: { in: priorIds } }, ...forUser] },
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: "giveaway-tickets",
      where: {
        and: [
          { giveaway: { in: priorIds } },
          { status: { equals: "valid" } },
          ...forUser,
        ],
      },
      pagination: false,
      depth: 0,
    }),
  ]);

  // `${giveawayId}:${userKey}` -> tier won / took part
  const wonAt = new Map<string, PrizeTier>();
  for (const winner of winners.docs) {
    const userKey = relationKey(winner.user);
    const giveawayKey = relationKey(winner.giveaway);
    if (userKey && giveawayKey) {
      wonAt.set(`${giveawayKey}:${userKey}`, winner.tier as PrizeTier);
    }
  }

  const tookPart = new Set<string>();
  const everySeenUser = new Set<string>();
  for (const ticket of tickets.docs) {
    const userKey = relationKey(ticket.user);
    const giveawayKey = relationKey(ticket.giveaway);
    if (userKey && giveawayKey && (ticket.quantity ?? 0) > 0) {
      tookPart.add(`${giveawayKey}:${userKey}`);
      everySeenUser.add(userKey);
    }
  }

  /**
   * A user who won but holds no valid ticket in that round (because it was
   * refunded afterwards) still has a win to serve a cooldown for, so they
   * belong in the sequence too.
   */
  for (const winner of winners.docs) {
    const userKey = relationKey(winner.user);
    if (userKey) {
      everySeenUser.add(userKey);
    }
  }

  for (const userKey of everySeenUser) {
    const outcomes: DrawOutcome[] = priorGiveaways.docs.map((prior) => {
      const key = `${prior.id}:${userKey}`;
      const won = wonAt.get(key);
      if (won) {
        return won;
      }
      return tookPart.has(key) ? "participated_no_win" : null;
    });

    histories.set(userKey, { outcomes });
  }

  return histories;
}

/** Normalise a Payload relationship value to a comparable key. */
function relationKey(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && "id" in value) {
    return String((value as { id: string | number }).id);
  }
  return String(value);
}
