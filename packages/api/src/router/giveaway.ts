import {
  CONSECUTIVE_ELIGIBILITY,
  CONSECUTIVE_GIVEAWAYS_REQUIRED,
  type EngagementType,
  type FulfilmentType,
  PRIMARY_ELIGIBILITY,
  PRIZE_TIERS,
  type PrizeTier,
} from "@news-spend-media/payload/collections/giveaway";
import {
  claimRequirements,
  claimWindowFor,
  fulfilmentStateAfterClaim,
  isSuperseded,
  latestGiveawayStart,
} from "@news-spend-media/payload/lib/giveaway/claim";
import { loadDrawHistories } from "@news-spend-media/payload/lib/giveaway/drawHistory";
import {
  evaluateEligibility,
  type Participation,
} from "@news-spend-media/payload/lib/giveaway/eligibility";
import {
  evaluateFairness,
  type UserDrawHistory,
} from "@news-spend-media/payload/lib/giveaway/fairness";
import { evaluateParticipant } from "@news-spend-media/payload/lib/giveaway/participantEligibility";
import {
  activities,
  users,
} from "@news-spend-media/payload/payload-generated-schema";
import type { Giveaway } from "@news-spend-media/payload/types";
import { eq, sql } from "@payloadcms/db-postgres/drizzle";
import type { BasePayload, Where } from "payload";
import z from "zod";

import {
  protectedNoGuestProcedure,
  protectedProcedure,
  publicProcedure,
} from "../index";
import { createRateLimitMiddleware } from "../lib/ratelimit";

/**
 * Upper bound on a single purchase. Not a business rule: the quantity is
 * multiplied by the ticket price to produce a points debit, so an absurd
 * value is worth rejecting outright rather than reasoning about.
 */
const MAX_TICKETS_PER_PURCHASE = 1000;

/**
 * Whether an account must have a date of birth on record to take part.
 *
 * Off for now, deliberately. The check itself works, but nothing in the app
 * can record a date of birth (the profile only displays one), so enabling it
 * tells people to supply something they have no way to supply. Turn this back
 * on in the same change that ships the capture flow, and un-skip the age-gate
 * block in giveawayRouter.test.ts with it.
 *
 * The under-18 rule is unchanged and still covered directly by
 * participantEligibility.test.ts; this only decides whether it is enforced.
 */
const AGE_GATE_ENABLED = false;

type Row = Record<string, any>;

/** Normalise a Payload relationship value to a comparable id. */
function relationId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
}

/**
 * Which app surfaces produce which kind of engagement (spec 7, 8).
 *
 * A Boost is a Connect Brand advertisement watched to completion; a Featured
 * Offer is an item on the Lucky App Wall. Checking the placement stops a
 * Lucky App Wall item being submitted as a Boost, which would otherwise be an
 * easy way to satisfy Tier 1's three-boost requirement from a single surface.
 */
const ENGAGEMENT_PLACEMENTS: Record<EngagementType, readonly string[]> = {
  boost: ["connect-brand-video", "connect-brands-tab"],
  featured_offer: ["lucky-app-wall"],
};

const ENGAGEMENT_LABELS: Record<EngagementType, string> = {
  boost: "Boost Your Luck",
  featured_offer: "Featured Offer",
};

/**
 * Engagements cost nothing, so without a limit a client could record enough
 * of them to reach Tier 1 in seconds. The per-item rule below is the real
 * defence; this is the cheap one that stops the attempt.
 */
const engagementRateLimit = createRateLimitMiddleware({
  maxRequests: 30,
  window: 60_000,
});

const purchaseRateLimit = createRateLimitMiddleware({
  maxRequests: 10,
  window: 60_000,
});

/**
 * Claiming gets its own budget. It shares nothing with buying: a winner
 * claiming three prizes in a row must not be throttled because they also
 * bought tickets a moment earlier, and the two have quite different natural
 * rates.
 */
const claimRateLimit = createRateLimitMiddleware({
  maxRequests: 20,
  window: 60_000,
});

type ErrorFactory = {
  NOT_FOUND: (args: { message: string }) => Error;
  CONFLICT: (args: { message: string }) => Error;
};

type ClaimErrorFactory = ErrorFactory & {
  BAD_REQUEST: (args: { message: string }) => Error;
};

/**
 * The giveaway an administrator has switched on, if any.
 *
 * `active` is an administrative state, not a statement about the clock: a
 * giveaway is switched on once and then opens and closes on its own dates.
 * Every reader goes through here so that "which giveaway" is answered in one
 * place, and only then asks `giveawayWindow` whether it is open right now.
 */
async function activeGiveaway(
  payload: BasePayload
): Promise<Giveaway | undefined> {
  const found = await payload.find({
    collection: "giveaways",
    where: { status: { equals: "active" } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  return found.docs[0];
}

type GiveawayWindow =
  | { isOpen: true }
  | { isOpen: false; state: "pending" | "closed"; message: string };

/**
 * Whether the active giveaway is open for participation at this instant.
 *
 * The single source of truth for "is it running", shared by the write paths
 * that refuse participation and by `current`, which tells the app what to
 * render. They used to decide it separately, and the app would offer a live
 * "Enter Giveaway" button for a giveaway switched on ahead of its start date
 * while every purchase behind that button was refused.
 *
 * Compared as epoch milliseconds throughout. `startDate` and `endDate` are
 * stored and returned as UTC instants, so parsing them back to a `Date` and
 * taking `getTime()` is offset-safe wherever this runs; nothing here reads a
 * local calendar field.
 */
function giveawayWindow(giveaway: Giveaway): GiveawayWindow {
  const now = Date.now();

  if (new Date(giveaway.startDate).getTime() > now) {
    return {
      isOpen: false,
      state: "pending",
      message: "This giveaway has not opened yet.",
    };
  }

  if (new Date(giveaway.endDate).getTime() <= now) {
    return {
      isOpen: false,
      state: "closed",
      message: "This giveaway has closed and is waiting for its draw.",
    };
  }

  return { isOpen: true };
}

/**
 * The giveaway currently accepting participation.
 *
 * Only a giveaway that is `active` and inside its own window takes tickets or
 * engagements. Once the draw begins the candidate pool is locked (12), so
 * anything recorded afterwards could never have counted anyway: better to
 * refuse it than to store a row that silently does nothing.
 */
async function openGiveaway(
  payload: BasePayload,
  errors: ErrorFactory
): Promise<Giveaway> {
  const giveaway = await activeGiveaway(payload);
  if (!giveaway) {
    throw errors.NOT_FOUND({
      message: "There is no giveaway running at the moment.",
    });
  }

  const window = giveawayWindow(giveaway);
  if (!window.isOpen) {
    throw errors.CONFLICT({ message: window.message });
  }

  return giveaway;
}

/**
 * Refuse a purchase from someone too young to take part.
 *
 * Checked here rather than only at signup, for two reasons: someone who
 * signed up under age becomes eligible on their birthday with no action
 * needed, and someone who lied at signup is caught again at the point where
 * it actually matters: money changing hands for a chance at a prize.
 *
 * Deliberately FORBIDDEN rather than BAD_REQUEST. This is not a malformed
 * request the caller can fix by sending different input; the account itself
 * is not permitted to do this yet.
 */
async function assertOldEnough(
  payload: BasePayload,
  userId: string,
  errors: ClaimErrorFactory & {
    FORBIDDEN: (args: { message: string }) => Error;
  }
) {
  if (!AGE_GATE_ENABLED) {
    return;
  }

  const user = await payload.findByID({
    collection: "users",
    id: userId,
    depth: 0,
  });

  const verdict = evaluateParticipant({
    dateOfBirth: user?.dateOfBirth ?? null,
  });

  if (!verdict.eligible) {
    throw errors.FORBIDDEN({ message: verdict.message });
  }
}

/**
 * Everything the eligibility rules need about one user in one giveaway.
 *
 * Tickets are summed by quantity rather than counted by row: 6 aggregates
 * every valid purchase in the period, and one purchase of ten tickets has to
 * weigh the same as ten purchases of one.
 */
async function loadParticipation(
  payload: BasePayload,
  giveawayId: string,
  userId: string
): Promise<Participation> {
  const scope: Where[] = [
    { giveaway: { equals: giveawayId } },
    { user: { equals: userId } },
  ];

  const [tickets, engagements, streaks] = await Promise.all([
    payload.find({
      collection: "giveaway-tickets",
      where: { and: [...scope, { status: { equals: "valid" } }] },
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: "giveaway-engagements",
      where: { and: [...scope, { completionStatus: { equals: "completed" } }] },
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: "giveaway-streaks",
      where: { user: { equals: userId } },
      pagination: false,
      depth: 0,
    }),
  ]);

  const participation: Participation = {
    userId,
    validTickets: tickets.docs.reduce(
      (sum, ticket) => sum + (ticket.quantity ?? 0),
      0
    ),
    boosts: engagements.docs.filter((row) => row.type === "boost").length,
    featuredOffers: engagements.docs.filter(
      (row) => row.type === "featured_offer"
    ).length,
    streaks: {},
  };

  for (const streak of streaks.docs) {
    if (streak.tier) {
      participation.streaks[streak.tier as PrizeTier] =
        streak.consecutiveCount ?? 0;
    }
  }

  return participation;
}

const NO_HISTORY: UserDrawHistory = { outcomes: [] };

/**
 * A user's participation this round together with their history, which is
 * everything the tier summary needs. Both write endpoints echo the caller's
 * new standing, so they load the same pair the progress endpoint does: a
 * summary that omitted the cooldowns would contradict it.
 */
async function loadStanding(
  payload: BasePayload,
  giveaway: Giveaway,
  userId: string
) {
  const [participation, histories] = await Promise.all([
    loadParticipation(payload, giveaway.id, userId),
    loadDrawHistories(payload, { before: giveaway.endDate, userId }),
  ]);

  return { participation, history: histories.get(userId) };
}

/**
 * Per-tier standing, shaped for the participation screen.
 *
 * Two separate questions are answered per tier, and keeping them apart matters
 * for what the app can honestly say. `requirementsMet` is whether the user has
 * done enough this round: the thing they can act on. `canWin` also accounts
 * for the 22 fairness cooldowns, which no amount of buying or boosting will
 * change: a recent Tier 1 winner is barred from Tier 1 whatever they do.
 *
 * Collapsing the two would mean either promising a tier the draw will exclude
 * them from, or showing an unmet requirement they cannot fix.
 */
function summariseTiers(
  participation: Participation,
  history: UserDrawHistory = NO_HISTORY
) {
  return PRIZE_TIERS.map((tier) => {
    const fairness = evaluateFairness(tier, history);
    const loyaltyWaiver = fairness.eligible && fairness.loyaltyWaiver;
    const verdict = evaluateEligibility(tier, participation, loyaltyWaiver);

    return {
      tier,
      /** Has this user done enough this round? */
      requirementsMet: verdict.eligible,
      /** Will the draw actually consider them? Requirements *and* cooldowns. */
      canWin: verdict.eligible && fairness.eligible,
      path: verdict.eligible ? verdict.path : null,
      cooldown: fairness.eligible
        ? null
        : { rule: fairness.rule, reason: fairness.reason },
      /** 22.4: the Featured Offer requirement is waived this round. */
      loyaltyWaiver,
      requirements: {
        primary: PRIMARY_ELIGIBILITY[tier],
        consecutive: CONSECUTIVE_ELIGIBILITY[tier],
        consecutiveGiveawaysRequired: CONSECUTIVE_GIVEAWAYS_REQUIRED,
      },
      consecutiveGiveawaysMet: participation.streaks[tier] ?? 0,
    };
  });
}

// --- Procedures ---

/** How many entrants to name on the giveaway screen. */
const PARTICIPANTS_SHOWN = 20;

/**
 * Who has entered the open giveaway, and how many people that is.
 *
 * The count is derived from valid tickets rather than read off the giveaway,
 * because `totalValidParticipants` is only written when the draw runs: it is
 * null for the whole period anyone is actually looking at this.
 *
 * Counts people, not tickets: somebody who bought ten tickets is one
 * participant, and showing the ticket total as a participant count would
 * overstate the field every entrant is judging their odds against.
 */
const participants = publicProcedure.handler(async ({ context }) => {
  const { payload } = context;

  const found = await payload.find({
    collection: "giveaways",
    where: { status: { equals: "active" } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  const giveaway = found.docs[0];
  if (!giveaway) {
    return { total: 0, recent: [] };
  }

  const tickets = await payload.find({
    collection: "giveaway-tickets",
    where: {
      and: [
        { giveaway: { equals: giveaway.id } },
        { status: { equals: "valid" } },
      ],
    },
    limit: 0,
    pagination: false,
    depth: 1,
    sort: "-purchasedAt",
  });

  // Fold to one row per person, newest first, summing their tickets.
  const byUser = new Map<string, { username: string; tickets: number }>();

  for (const ticket of tickets.docs as any[]) {
    const user = ticket.user;
    const id = typeof user === "object" && user ? user.id : user;
    if (!id) {
      continue;
    }
    const existing = byUser.get(String(id));
    const quantity = Number(ticket.quantity ?? 0);
    if (existing) {
      existing.tickets += quantity;
    } else {
      byUser.set(String(id), {
        username:
          (typeof user === "object" && (user.username || user.name)) ||
          "Someone",
        tickets: quantity,
      });
    }
  }

  return {
    total: byUser.size,
    recent: [...byUser.values()].slice(0, PARTICIPANTS_SHOWN),
  };
});

/**
 * The giveaway an administrator has switched on, or null. Safe to call when
 * signed out.
 *
 * Returns a giveaway that has not reached its `startDate` rather than hiding
 * it, so the app can count down to an opening it knows about. `isOpen` says
 * whether participation is currently possible, and is the same judgement the
 * write paths enforce, so the button the app offers and the request behind it
 * can no longer disagree.
 */
const current = publicProcedure.handler(async ({ context }) => {
  const { payload } = context;

  const giveaway = await activeGiveaway(payload);
  if (!giveaway) {
    return null;
  }

  const window = giveawayWindow(giveaway);

  return {
    id: giveaway.id,
    name: giveaway.name,
    description: giveaway.description ?? null,
    startDate: giveaway.startDate,
    endDate: giveaway.endDate,
    ticketPrice: giveaway.ticketPrice,
    minTicketsRequired: giveaway.minTicketsRequired ?? 1,
    isOpen: window.isOpen,
    state: window.isOpen ? ("open" as const) : window.state,
  };
});

/**
 * What the signed-in user has done in the open giveaway, and where that
 * leaves them for each tier.
 *
 * The fairness cooldowns are read from the same history reconstruction the
 * draw itself uses, so what the app shows and what the draw does cannot drift
 * apart: there is one implementation, not two.
 */
const progress = protectedProcedure.handler(async ({ context, errors }) => {
  const { payload, user } = context;
  const giveaway = await openGiveaway(payload, errors);

  const [{ participation, history }, account] = await Promise.all([
    loadStanding(payload, giveaway, user.id),
    payload.findByID({ collection: "users", id: user.id, depth: 0 }),
  ]);

  const participant = AGE_GATE_ENABLED
    ? evaluateParticipant({ dateOfBirth: account?.dateOfBirth ?? null })
    : ({ eligible: true } as const);

  return {
    giveawayId: giveaway.id,
    endDate: giveaway.endDate,
    ticketPrice: giveaway.ticketPrice,
    minTicketsRequired: giveaway.minTicketsRequired ?? 1,
    /**
     * Whether this account may take part at all, so the app can explain the
     * block up front rather than letting someone pick a quantity and only
     * then be refused at purchase.
     */
    canParticipate: participant.eligible,
    blockedReason: participant.eligible ? null : participant.reason,
    blockedMessage: participant.eligible ? null : participant.message,
    participation: {
      validTickets: participation.validTickets,
      boosts: participation.boosts,
      featuredOffers: participation.featuredOffers,
    },
    tiers: summariseTiers(participation, history),
  };
});

export const BuyTicketsInput = z.object({
  quantity: z
    .number()
    .int("Ticket quantity must be a whole number.")
    .min(1, "You must buy at least one ticket.")
    .max(
      MAX_TICKETS_PER_PURCHASE,
      `You cannot buy more than ${MAX_TICKETS_PER_PURCHASE} tickets at once.`
    ),
  paymentReference: z.string().max(200).optional(),
});

/**
 * Buy tickets for the open giveaway (spec 6).
 *
 * One row per purchase, never an upsert. The legacy lottery collapsed every
 * purchase by a user into a single row, which made the ticket count decorative:
 * the draw rolled once per user however many tickets they had bought. Here
 * each row is an independent weighted entry, so buying more tickets genuinely
 * improves the odds.
 *
 * The points debit follows the same shape as the lottery's: balance read and
 * write inside one transaction that first takes a row lock on the user, so two
 * concurrent purchases cannot both pass the check. The debit commits before
 * the tickets exist, and is refunded if creating them fails: the reverse
 * order would hand out tickets nobody paid for.
 */
const buyTickets = protectedNoGuestProcedure
  .use(purchaseRateLimit)
  .input(BuyTicketsInput)
  .handler(async ({ input, context, errors }) => {
    const { quantity, paymentReference } = input;
    const { user, payload } = context;
    const db = payload.db.drizzle;

    const giveaway = await openGiveaway(payload, errors);
    await assertOldEnough(payload, user.id, errors);

    const minimum = giveaway.minTicketsRequired ?? 1;
    if (quantity < minimum) {
      throw errors.BAD_REQUEST({
        message: `This giveaway has a minimum of ${minimum} ticket${minimum === 1 ? "" : "s"} per purchase.`,
      });
    }

    const unitPrice = giveaway.ticketPrice ?? 0;
    const cost = quantity * unitPrice;

    await db.transaction(async (tx: typeof db) => {
      await tx.execute(
        sql`SELECT 1 FROM ${users} WHERE ${users.id} = ${user.id} FOR UPDATE`
      );

      const balanceRows = await tx
        .select({
          totalPoints: sql`COALESCE(SUM(${activities.point}), 0)`.mapWith(
            Number
          ),
        })
        .from(activities)
        .where(eq(activities.user, user.id));

      const userPoints = balanceRows[0]?.totalPoints ?? 0;

      if (userPoints < cost) {
        throw errors.BAD_REQUEST({
          message: `Not enough points. ${quantity} ticket${quantity === 1 ? "" : "s"} costs ${cost} points and you have ${userPoints}.`,
        });
      }

      await tx.insert(activities).values({
        user: user.id,
        type: "point",
        action: "ticketPurchase",
        point: -cost,
        description: `Giveaway ticket purchase: ${giveaway.name}`,
      });
    });

    try {
      const ticket = await payload.create({
        collection: "giveaway-tickets",
        data: {
          giveaway: giveaway.id,
          user: user.id,
          quantity,
          unitPrice,
          status: "valid",
          paymentReference,
          purchasedAt: new Date().toISOString(),
        },
      });

      const { participation, history } = await loadStanding(
        payload,
        giveaway,
        user.id
      );

      return {
        ticketId: ticket.id,
        quantity,
        pointsSpent: cost,
        validTickets: participation.validTickets,
        tiers: summariseTiers(participation, history),
      };
    } catch (error) {
      // The points are already gone. Put them back rather than leave the user
      // charged for tickets they never received.
      await db
        .insert(activities)
        .values({
          user: user.id,
          type: "point",
          action: "ticketPurchase",
          point: cost,
          description: "Refund: giveaway ticket purchase failed",
        })
        .catch((refundError: unknown) => {
          payload.logger.error(
            { err: refundError, user: user.id, cost },
            "[giveaway] failed to refund points after a failed ticket purchase"
          );
        });

      throw error;
    }
  });

export const RecordEngagementInput = z.object({
  type: z.enum(["boost", "featured_offer"]),
  /**
   * The partner item engaged with. Required, not optional: 7 and 8 both
   * mandate recording the interaction's identity, and without it there is no
   * way to tell a second genuine engagement from the same one replayed.
   */
  contentId: z.string().min(1, "The item engaged with is required."),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Record a completed Boost Your Luck interaction or Featured Offer
 * (spec 7, 8).
 *
 * Neither creates a draw entry: both only contribute towards Tier 1 and
 * Tier 2 eligibility, which is why nothing here touches ticket counts.
 *
 * Three rules guard it. The user must already hold a valid ticket, because
 * engagement without participation is not participation. The item's placement
 * must match the kind of engagement claimed. And one partner item counts once
 * per giveaway per user: re-watching the same advertisement is not three
 * boosts, and without that rule Tier 1 is reachable from a single item.
 */
const recordEngagement = protectedNoGuestProcedure
  .use(engagementRateLimit)
  .input(RecordEngagementInput)
  .handler(async ({ input, context, errors }) => {
    const { type, contentId, metadata } = input;
    const { user, payload } = context;

    const giveaway = await openGiveaway(payload, errors);

    const tickets = await payload.find({
      collection: "giveaway-tickets",
      where: {
        and: [
          { giveaway: { equals: giveaway.id } },
          { user: { equals: user.id } },
          { status: { equals: "valid" } },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
    });

    if (tickets.docs.length === 0) {
      throw errors.FORBIDDEN({
        message: `Buy a ticket before completing a ${ENGAGEMENT_LABELS[type]}.`,
      });
    }

    const content = await payload
      .findByID({ collection: "partner-content", id: contentId, depth: 0 })
      .catch(() => null);

    if (!content) {
      throw errors.NOT_FOUND({ message: "That item no longer exists." });
    }

    const placements = (content.placements ?? []) as string[];
    const allowed = ENGAGEMENT_PLACEMENTS[type];

    if (!placements.some((placement) => allowed.includes(placement))) {
      throw errors.BAD_REQUEST({
        message: `That item does not count towards ${ENGAGEMENT_LABELS[type]}.`,
      });
    }

    const existing = await payload.find({
      collection: "giveaway-engagements",
      where: {
        and: [
          { giveaway: { equals: giveaway.id } },
          { user: { equals: user.id } },
          { type: { equals: type } },
          { content: { equals: contentId } },
          { completionStatus: { equals: "completed" } },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
    });

    if (existing.docs.length > 0) {
      throw errors.CONFLICT({
        message: `You have already completed this ${ENGAGEMENT_LABELS[type]}.`,
      });
    }

    const engagement = await payload.create({
      collection: "giveaway-engagements",
      data: {
        giveaway: giveaway.id,
        user: user.id,
        type,
        content: contentId,
        completionStatus: "completed",
        completedAt: new Date().toISOString(),
        metadata: metadata ?? null,
      },
    });

    const { participation, history } = await loadStanding(
      payload,
      giveaway,
      user.id
    );

    return {
      engagementId: engagement.id,
      type,
      boosts: participation.boosts,
      featuredOffers: participation.featuredOffers,
      tiers: summariseTiers(participation, history),
    };
  });

// --- Claiming prizes (spec 21) ---

/** Shape one winner row for the app, with everything the claim screen needs. */
/**
 * Fulfilment states in which the winner's own details may still be corrected.
 *
 * `fulfilled` is absent because the airtime has already gone to whatever
 * number was on record, and editing it afterwards would only rewrite history.
 * `in_progress` is absent because a dispatch is in flight and changing the
 * destination mid-attempt is a race with real money on the end of it.
 * `cancelled` is absent because there is nothing left to send.
 */
const EDITABLE_FULFILMENT_STATES = [
  "pending",
  "on_hold",
  "awaiting_verification",
];

function toWinning(winner: Row, window: ReturnType<typeof claimWindowFor>) {
  const prize = winner.prize as Row | string | null;
  const prizeDoc = typeof prize === "object" && prize !== null ? prize : null;
  const fulfilmentType = (prizeDoc?.fulfilmentType ??
    "physical") as FulfilmentType;
  const requirements = claimRequirements(fulfilmentType, {
    requiresVerification: Boolean(prizeDoc?.requiresVerification),
  });

  return {
    id: String(winner.id),
    tier: winner.tier as string,
    prizeName: String(winner.prizeName ?? ""),
    prizeImage: prizeDoc?.image ?? null,
    fulfilmentType,
    claimStatus: winner.claimStatus as string,
    fulfilmentStatus: winner.fulfilmentStatus as string,
    claimDeadline: (winner.claimDeadline as string | null) ?? null,
    selectedAt: (winner.selectedAt as string | null) ?? null,
    /** True only when the user can act on it right now. */
    claimable: winner.claimStatus === "unclaimed" && window.open,
    closedReason: window.open ? null : window.reason,
    closedMessage: window.open ? null : window.message,
    /**
     * 22.7/22.8: the win stands, but the payout waits on a review. The app
     * must say so rather than promise delivery.
     */
    underReview: winner.fulfilmentStatus === "on_hold",
    /**
     * The winner has an identity step left before this can be dispatched.
     * Distinct from `underReview`, where there is nothing for them to do.
     */
    awaitingVerification: winner.fulfilmentStatus === "awaiting_verification",
    needs: {
      phone: requirements.needsPhone,
      address: requirements.needsAddress,
      verification: requirements.needsVerification,
    },
    /**
     * What the winner supplied at claim time. Their own details, returned to
     * them: a top-up that went to a mistyped number is otherwise impossible
     * for them to diagnose, and impossible to correct.
     */
    sentTo: (winner.claimPhone as string | null) ?? null,
    recipientName: (winner.claimRecipientName as string | null) ?? null,
    shippingAddress: (winner.claimAddress as string | null) ?? null,
    /**
     * Whether the winner may still correct where this is going.
     *
     * Decided here, once, so the button and the procedure cannot drift into
     * disagreeing: a screen offering an edit the server then refuses is
     * worse than no button at all.
     */
    canEditDetails:
      winner.claimStatus === "claimed" &&
      (requirements.needsPhone || requirements.needsAddress) &&
      EDITABLE_FULFILMENT_STATES.includes(
        String(winner.fulfilmentStatus ?? "")
      ),
  };
}

/**
 * Turn a winner row into the shape the app renders, resolving its claim
 * window against the newest giveaway.
 */
function winningFrom(winner: Row, latestStart: string | null) {
  const giveaway = winner.giveaway as Row | string | null;
  const giveawayDoc =
    typeof giveaway === "object" && giveaway !== null ? giveaway : null;

  return toWinning(
    winner,
    claimWindowFor(winner, {
      laterGiveawayExists: isSuperseded(
        giveawayDoc?.startDate as string | undefined,
        latestStart
      ),
    })
  );
}

/**
 * A prize's own claim window bounds how long it can stay unresolved (14
 * days, or until the next giveaway starts), so the count of prizes genuinely
 * waiting on this user is naturally small. It never needs a page.
 *
 * This is the same pair `toWinning` derives `claimable` and
 * `awaitingVerification` from, kept here as a `where` clause so the query does
 * the filtering rather than the client.
 */
const ACTIONABLE_WHERE: Where = {
  or: [
    { claimStatus: { equals: "unclaimed" } },
    { fulfilmentStatus: { equals: "awaiting_verification" } },
  ],
};

/**
 * A defensive ceiling on `actionable`, not a real one.
 *
 * The claim window is what actually bounds this list to a handful of rows.
 * The limit only guards against the hourly expiry sweep having stopped
 * running: it should never be the thing doing the bounding.
 */
const ACTIONABLE_CEILING = 100;

/**
 * Every prize still waiting on this user: unclaimed within its window, or
 * claimed but pending the one-time identity check (spec 21).
 *
 * Deliberately unpaged. Unlike the full history, this list cannot grow
 * without bound: a prize leaves it the moment it is claimed (unless it also
 * needs verification) or its window closes, so there is nothing here for
 * pagination to protect against.
 */
const actionable = protectedProcedure.handler(async ({ context }) => {
  const { payload, user } = context;

  const [winners, latestStart] = await Promise.all([
    payload.find({
      collection: "giveaway-winners",
      where: { and: [{ user: { equals: user.id } }, ACTIONABLE_WHERE] },
      sort: "-selectedAt",
      limit: ACTIONABLE_CEILING,
      pagination: false,
      depth: 1,
    }),
    latestGiveawayStart(payload),
  ]);

  return winners.docs.map((winner) => winningFrom(winner as Row, latestStart));
});

const HISTORY_PAGE_SIZE = 20;

export const HistoryInput = z.object({
  page: z.number().int().min(1).max(500).default(1),
  limit: z.number().int().min(1).max(50).default(HISTORY_PAGE_SIZE),
});

/**
 * Everything else this user has won, newest first, a page at a time:
 * claimed, expired, disqualified, all of it.
 *
 * This is the list that only ever grows, so it is the one that is paged.
 * Excludes whatever `actionable` already covers, by the same two conditions,
 * so a prize is never listed in both places at once.
 */
const history = protectedProcedure
  .input(HistoryInput)
  .handler(async ({ input, context }) => {
    const { payload, user } = context;

    const [winners, latestStart] = await Promise.all([
      payload.find({
        collection: "giveaway-winners",
        where: {
          and: [
            { user: { equals: user.id } },
            { claimStatus: { not_equals: "unclaimed" } },
            { fulfilmentStatus: { not_equals: "awaiting_verification" } },
          ],
        },
        sort: "-selectedAt",
        page: input.page,
        limit: input.limit,
        depth: 1,
      }),
      latestGiveawayStart(payload),
    ]);

    return {
      items: winners.docs.map((winner) =>
        winningFrom(winner as Row, latestStart)
      ),
      page: winners.page ?? input.page,
      hasMore: Boolean(winners.hasNextPage),
      totalPrizes: winners.totalDocs ?? 0,
    };
  });

export const WinningInput = z.object({ winnerId: z.string().min(1) });

/**
 * One prize by id.
 *
 * The claim screen needs this rather than searching the list: once the list is
 * paged, a prize deep enough in someone's history is simply not in the page
 * the app happens to be holding.
 */
const winning = protectedProcedure
  .input(WinningInput)
  .handler(async ({ input, context, errors }) => {
    const { payload, user } = context;

    const winner = await payload
      .findByID({
        collection: "giveaway-winners",
        id: input.winnerId,
        depth: 1,
      })
      .catch(() => null);

    // Never leak the existence of someone else's prize.
    if (!winner || relationId(winner.user) !== user.id) {
      throw errors.NOT_FOUND({ message: "That prize could not be found." });
    }

    return winningFrom(winner as Row, await latestGiveawayStart(payload));
  });

/**
 * Everything a winner might want to know about one prize, after the fact.
 *
 * Separate from `winning`, which the claim screen uses and which deliberately
 * returns only what is needed to decide *what to ask for*. This is the record
 * of what happened: which giveaway produced it, what it was, and (for airtime
 * and data, the two that leave the platform) the number it was sent to and
 * what the provider said. Someone whose top-up has not arrived needs to see
 * the number that was actually used, which is otherwise only in the CMS.
 */
const prizeDetails = protectedProcedure
  .input(WinningInput)
  .handler(async ({ input, context, errors }) => {
    const { payload, user } = context;

    const winner = await payload
      .findByID({
        collection: "giveaway-winners",
        id: input.winnerId,
        depth: 1,
      })
      .catch(() => null);

    // Never leak the existence of someone else's prize.
    if (!winner || relationId(winner.user) !== user.id) {
      throw errors.NOT_FOUND({ message: "That prize could not be found." });
    }

    const base = winningFrom(winner as Row, await latestGiveawayStart(payload));

    const giveaway = (winner as Row).giveaway as Row | string | null;
    const giveawayDoc =
      typeof giveaway === "object" && giveaway !== null ? giveaway : null;

    const prize = (winner as Row).prize as Row | string | null;
    const prizeDoc = typeof prize === "object" && prize !== null ? prize : null;

    /**
     * The dispatch record, for the fulfilment types that actually dispatch.
     * Latest attempt only: a retry supersedes the one before it, and a winner
     * reading this wants the current state, not a history.
     */
    const attempts =
      base.fulfilmentType === "airtime" || base.fulfilmentType === "data"
        ? await payload.find({
            collection: "giveaway-fulfilment-attempts",
            where: { winner: { equals: input.winnerId } },
            sort: "-attemptedAt",
            limit: 1,
            pagination: false,
            depth: 0,
          })
        : null;

    const attempt = attempts?.docs[0] as Row | undefined;

    return {
      ...base,
      giveawayName: String(giveawayDoc?.name ?? "Giveaway"),
      giveawayEndedAt: (giveawayDoc?.endDate as string | null) ?? null,
      drawnAt: (giveawayDoc?.drawCompletedAt as string | null) ?? null,
      prizeDescription: (prizeDoc?.description as string | null) ?? null,
      /** Only meaningful for a points prize; null keeps the app from guessing. */
      pointsAmount: (prizeDoc?.pointsAmount as number | null) ?? null,
      claimedAt: ((winner as Row).claimedAt as string | null) ?? null,
      fulfilledAt: ((winner as Row).fulfilledAt as string | null) ?? null,
      /** 22.7/22.8: why a payout is being held, in the winner's own words. */
      reviewNote: ((winner as Row).reviewNote as string | null) ?? null,
      dispatch: attempt
        ? {
            outcome: String(attempt.outcome ?? ""),
            network: (attempt.operatorName as string | null) ?? null,
            amount: (attempt.localAmount as number | null) ?? null,
            sentTo: (attempt.recipientPhone as string | null) ?? null,
            reference: (attempt.providerTransactionId as string | null) ?? null,
            attemptedAt: (attempt.attemptedAt as string | null) ?? null,
            /** The provider's own words when it refused. */
            error: (attempt.error as string | null) ?? null,
          }
        : null,
    };
  });

export const ClaimPrizeInput = z.object({
  winnerId: z.string().min(1),
  /** Required for airtime and data. */
  phoneNumber: z
    .string()
    .trim()
    .min(7, "That does not look like a phone number.")
    .max(20)
    .optional(),
  /** Required for physical prizes. */
  recipientName: z.string().trim().min(2).max(120).optional(),
  shippingAddress: z.string().trim().min(10).max(500).optional(),
});

/**
 * Everything that can stop a claim before details are even collected: the
 * prize's own status, and whether its window is still open.
 */
async function assertClaimable(
  payload: BasePayload,
  winner: Row,
  errors: ClaimErrorFactory
) {
  if (winner.claimStatus === "claimed") {
    throw errors.CONFLICT({ message: "You have already claimed this prize." });
  }

  if (winner.claimStatus !== "unclaimed") {
    throw errors.CONFLICT({
      message: `This prize can no longer be claimed (${winner.claimStatus}).`,
    });
  }

  const giveaway = winner.giveaway as Row | string | null;
  const giveawayDoc =
    typeof giveaway === "object" && giveaway !== null ? giveaway : null;

  const window = claimWindowFor(winner, {
    laterGiveawayExists: isSuperseded(
      giveawayDoc?.startDate as string | undefined,
      await latestGiveawayStart(payload)
    ),
  });

  if (!window.open) {
    throw errors.CONFLICT({ message: window.message });
  }
}

/** What to tell the winner, given where their prize has landed. */
function claimMessage(
  next: ReturnType<typeof fulfilmentStateAfterClaim>,
  pointsAmount: number
): string {
  if (next === null) {
    return "Claimed. This prize is under review and will be released once checks are complete.";
  }
  if (next === "awaiting_verification") {
    return "Claimed and secured. Verify your identity to receive it. There is no rush, your prize is held for you.";
  }
  if (next === "fulfilled") {
    return `Claimed. ${pointsAmount} points have been added to your balance.`;
  }
  return "Claimed. We'll be in touch about delivery.";
}

/** The details this kind of prize cannot be delivered without. */
function assertDetailsSupplied(
  requirements: ReturnType<typeof claimRequirements>,
  input: {
    phoneNumber?: string;
    shippingAddress?: string;
    recipientName?: string;
  },
  errors: ClaimErrorFactory
) {
  if (requirements.needsPhone && !input.phoneNumber) {
    throw errors.BAD_REQUEST({
      message: "A phone number is needed to send this prize.",
    });
  }

  if (
    requirements.needsAddress &&
    !(input.shippingAddress && input.recipientName)
  ) {
    throw errors.BAD_REQUEST({
      message: "A delivery address and recipient name are needed.",
    });
  }
}

export const UpdateClaimDetailsInput = ClaimPrizeInput;

/**
 * Correct the details a prize is being sent to (15).
 *
 * A mistyped phone number is the commonest reason a payout is rejected, and
 * until now the winner could see that something had gone wrong and do nothing
 * about it: the number was captured once, at claim time, and never again.
 * The prize sat on hold waiting for an administrator to notice.
 *
 * Name and address work the same way for a physical prize, for the same
 * reason: a delivery to the wrong street is as stuck as a top-up to the wrong
 * number, and the person who can fix it fastest is the one it belongs to.
 *
 * A CORRECTED PRIZE GOES BACK IN THE QUEUE, but only if a payout was actually
 * attempted and failed. `on_hold` covers two very different things: a
 * fulfilment failure, and a 22.7/22.8 fraud review. Letting an edit
 * clear the second would hand anyone under review a one-tap way out of it. A
 * failed attempt leaves a `giveaway-fulfilment-attempts` row behind and a
 * fraud hold does not, which is what tells them apart.
 */
const updateClaimDetails = protectedNoGuestProcedure
  .use(claimRateLimit)
  .input(UpdateClaimDetailsInput)
  .handler(async ({ input, context, errors }) => {
    const { payload, user } = context;

    const winner = await payload
      .findByID({
        collection: "giveaway-winners",
        id: input.winnerId,
        depth: 1,
      })
      .catch(() => null);

    if (!winner) {
      throw errors.NOT_FOUND({ message: "That prize could not be found." });
    }

    // Never leak the existence of someone else's prize.
    if (relationId(winner.user) !== user.id) {
      throw errors.NOT_FOUND({ message: "That prize could not be found." });
    }

    if (winner.claimStatus !== "claimed") {
      throw errors.BAD_REQUEST({
        message: "Claim this prize first, then its details can be changed.",
      });
    }

    const fulfilmentStatus = String(winner.fulfilmentStatus ?? "");
    if (!EDITABLE_FULFILMENT_STATES.includes(fulfilmentStatus)) {
      throw errors.CONFLICT({
        message:
          fulfilmentStatus === "fulfilled"
            ? "This prize has already been sent, so its details can no longer be changed."
            : "This prize is being sent right now. Try again in a few minutes.",
      });
    }

    const prize = winner.prize as Row | string | null;
    const prizeDoc = typeof prize === "object" && prize !== null ? prize : null;
    const fulfilmentType = (prizeDoc?.fulfilmentType ??
      "physical") as FulfilmentType;
    const requirements = claimRequirements(fulfilmentType, {
      requiresVerification: Boolean(prizeDoc?.requiresVerification),
    });

    assertDetailsSupplied(requirements, input, errors);

    /**
     * Only send it back to the queue when a payout was tried and failed.
     * A fraud hold has no attempts against it, so it stays held.
     */
    let releasedForRetry = false;
    if (fulfilmentStatus === "on_hold") {
      const attempts = await payload.count({
        collection: "giveaway-fulfilment-attempts",
        where: { winner: { equals: String(winner.id) } },
      });
      releasedForRetry = attempts.totalDocs > 0;
    }

    await payload.update({
      collection: "giveaway-winners",
      id: String(winner.id),
      data: {
        ...(requirements.needsPhone ? { claimPhone: input.phoneNumber } : {}),
        ...(requirements.needsAddress
          ? {
              claimRecipientName: input.recipientName,
              claimAddress: input.shippingAddress,
            }
          : {}),
        ...(releasedForRetry
          ? { fulfilmentStatus: "pending", reviewNote: null }
          : {}),
      },
    });

    return {
      id: String(winner.id),
      releasedForRetry,
      message: releasedForRetry
        ? "Updated. We'll try sending it again shortly."
        : "Updated.",
    };
  });

/**
 * Claim a prize (spec 21).
 *
 * What the winner has to supply depends entirely on how the prize is
 * delivered, which is why the catalogue carries a fulfilment type: airtime
 * needs a number, a refrigerator needs an address, and points need nothing at
 * all because the account is already the destination.
 *
 * Points settle immediately: the credit and the claim are written together,
 * so there is no window in which a prize reads as claimed but unpaid.
 * Everything else moves to `pending` for a provider or a person to fulfil.
 */
const claimPrize = protectedNoGuestProcedure
  .use(claimRateLimit)
  .input(ClaimPrizeInput)
  .handler(async ({ input, context, errors }) => {
    const { payload, user } = context;

    const winner = await payload
      .findByID({
        collection: "giveaway-winners",
        id: input.winnerId,
        depth: 1,
      })
      .catch(() => null);

    if (!winner) {
      throw errors.NOT_FOUND({ message: "That prize could not be found." });
    }

    // Never leak the existence of someone else's prize.
    const ownerId = relationId(winner.user);
    if (ownerId !== user.id) {
      throw errors.NOT_FOUND({ message: "That prize could not be found." });
    }

    await assertClaimable(payload, winner as Row, errors);

    const prize = winner.prize as Row | string | null;
    const prizeDoc = typeof prize === "object" && prize !== null ? prize : null;
    const fulfilmentType = (prizeDoc?.fulfilmentType ??
      "physical") as FulfilmentType;
    const requirements = claimRequirements(fulfilmentType, {
      requiresVerification: Boolean(prizeDoc?.requiresVerification),
    });

    assertDetailsSupplied(requirements, input, errors);

    const claimedAt = new Date().toISOString();
    const pointsAmount = Number(prizeDoc?.pointsAmount ?? 0);
    const nextFulfilment = fulfilmentStateAfterClaim(
      requirements,
      winner.fulfilmentStatus as string | null
    );

    /**
     * A points prize is settled here and now. The credit is written before the
     * claim is recorded, so a failure leaves the prize unclaimed and
     * retryable: the reverse order would mark it claimed with nothing paid.
     */
    if (requirements.instant && pointsAmount > 0) {
      await payload.db.drizzle.insert(activities).values({
        user: user.id,
        type: "point",
        action: "lottery",
        point: pointsAmount,
        description: `Giveaway prize: ${winner.prizeName}`,
      });
    }

    const updated = await payload.update({
      collection: "giveaway-winners",
      id: winner.id,
      data: {
        claimStatus: "claimed",
        claimedAt,
        claimPhone: input.phoneNumber,
        claimRecipientName: input.recipientName,
        claimAddress: input.shippingAddress,
        ...(nextFulfilment ? { fulfilmentStatus: nextFulfilment } : {}),
      },
    });

    return {
      id: String(updated.id),
      claimStatus: "claimed" as const,
      fulfilmentType,
      fulfilmentStatus: nextFulfilment ?? "on_hold",
      pointsCredited: requirements.instant ? pointsAmount : 0,
      underReview: winner.fulfilmentStatus === "on_hold",
      awaitingVerification: nextFulfilment === "awaiting_verification",
      message: claimMessage(nextFulfilment, pointsAmount),
    };
  });

// --- Revealing the outcome of a draw ---

/**
 * The most recently completed giveaway, or null if none has ever been drawn.
 *
 * Sorted by when the draw finished rather than when the giveaway started,
 * because a giveaway that was interrupted and resumed can complete after one
 * that started later, and it is the completion that the reveal announces.
 */
async function lastCompletedGiveaway(payload: BasePayload) {
  const found = await payload.find({
    collection: "giveaways",
    where: {
      and: [
        { status: { equals: "completed" } },
        { drawCompletedAt: { exists: true } },
      ],
    },
    sort: "-drawCompletedAt",
    limit: 1,
    pagination: false,
    depth: 0,
  });

  return (found.docs[0] as Row | undefined) ?? null;
}

/**
 * The result of the last draw this user took part in, if they have not been
 * shown it yet.
 *
 * Returns null far more often than not, and every null is an ordinary case:
 * no draw has happened, this user did not enter it, or they have already seen
 * the result. The app treats all three the same way: show nothing.
 *
 * Unlike `actionable`, this answers for losers too. A draw that says nothing
 * to the people who did not win reads as though their entry was never
 * counted, so the reveal covers everyone who held a valid ticket.
 */
const lastResult = protectedProcedure.handler(async ({ context }) => {
  const { payload, user } = context;

  const giveaway = await lastCompletedGiveaway(payload);
  if (!giveaway) {
    return null;
  }

  const giveawayId = String(giveaway.id);

  // Already acknowledged. Checked before the ticket lookup because this is the
  // common case for anyone opening the app twice.
  const seen = await payload
    .findByID({ collection: "users", id: user.id, depth: 0 })
    .catch(() => null);

  if (seen && relationId(seen.lastGiveawayResultSeen) === giveawayId) {
    return null;
  }

  const [tickets, winners] = await Promise.all([
    payload.find({
      collection: "giveaway-tickets",
      where: {
        and: [
          { giveaway: { equals: giveawayId } },
          { user: { equals: user.id } },
          { status: { equals: "valid" } },
        ],
      },
      pagination: false,
      depth: 0,
    }),
    payload.find({
      collection: "giveaway-winners",
      where: {
        and: [
          { giveaway: { equals: giveawayId } },
          { user: { equals: user.id } },
        ],
      },
      sort: "-selectedAt",
      limit: ACTIONABLE_CEILING,
      pagination: false,
      depth: 1,
    }),
  ]);

  // A draw only speaks to the people it drew from. Someone who never bought a
  // ticket is not owed the news that they did not win.
  if (tickets.docs.length === 0) {
    return null;
  }

  /**
   * Summed by quantity, not counted by row: the same rule 6 applies
   * everywhere else. One purchase of ten tickets is ten entries, and telling
   * that person they entered with one would understate their own stake back
   * to them.
   */
  const ticketCount = tickets.docs.reduce(
    (sum, row) => sum + Number((row as Row).quantity ?? 0),
    0
  );

  const latestStart = await latestGiveawayStart(payload);
  const prizes = winners.docs.map((winner) =>
    winningFrom(winner as Row, latestStart)
  );

  return {
    giveawayId,
    giveawayName: String(giveaway.name ?? "the Giveaway"),
    drawCompletedAt: (giveaway.drawCompletedAt as string | null) ?? null,
    won: prizes.length > 0,
    prizes,
    /** The user's own stake in the draw, for the reveal to show. */
    tickets: ticketCount,
    /**
     * Captured on the giveaway when the pool locked, so it is the number the
     * draw actually ran against rather than a count taken later.
     */
    totalParticipants: (giveaway.totalValidParticipants as number | null) ?? 0,
  };
});

export const AcknowledgeResultInput = z.object({
  giveawayId: z.string().min(1),
});

/**
 * Record that this user has seen a draw's result, so it is never shown again.
 *
 * Idempotent, and deliberately forgiving about which giveaway is named: the
 * pointer only ever moves to the giveaway the app was actually told about, so
 * a stale client acknowledging an older result cannot rewind a newer one it
 * has not seen.
 */
const acknowledgeResult = protectedProcedure
  .input(AcknowledgeResultInput)
  .handler(async ({ input, context }) => {
    const { payload, user } = context;

    const giveaway = await lastCompletedGiveaway(payload);

    // Only the current reveal can be acknowledged. Anything else is a client
    // working from a result that has since been superseded.
    if (!giveaway || String(giveaway.id) !== input.giveawayId) {
      return { acknowledged: false };
    }

    await payload.update({
      collection: "users",
      id: user.id,
      data: { lastGiveawayResultSeen: input.giveawayId },
    });

    return { acknowledged: true };
  });

export const giveawayRouter = {
  current,
  participants,
  progress,
  buyTickets,
  recordEngagement,
  actionable,
  history,
  winning,
  prizeDetails,
  claimPrize,
  updateClaimDetails,
  lastResult,
  acknowledgeResult,
};
