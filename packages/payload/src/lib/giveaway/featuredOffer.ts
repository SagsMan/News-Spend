import type { BasePayload } from "payload";

/**
 * Record a Featured Offer completion against the open giveaway (spec 8).
 *
 * Driven by a partner confirming a conversion, not by the tap that opened the
 * link. A tap is an intention; Section 8 counts completions, and treating the two as
 * the same would let anyone reach Tier 1 by opening one offer and closing it
 * again.
 *
 * NEVER THROWS. This runs inside the conversion webhook, after the partner has
 * been told the conversion succeeded and the user has been paid points. A
 * giveaway that is closed, a user with no ticket, or an offer already counted
 * are all ordinary outcomes, none of them is a reason to fail a payout that
 * has already happened.
 */
export async function recordFeaturedOffer(
  payload: BasePayload,
  { userId, contentId }: { userId: string; contentId: string }
): Promise<{ recorded: boolean; reason?: string }> {
  try {
    const found = await payload.find({
      collection: "giveaways",
      where: { status: { equals: "active" } },
      limit: 1,
      pagination: false,
      depth: 0,
    });

    const giveaway = found.docs[0];
    if (!giveaway) {
      return { recorded: false, reason: "no active giveaway" };
    }

    const now = Date.now();
    if (
      new Date(giveaway.startDate).getTime() > now ||
      new Date(giveaway.endDate).getTime() <= now
    ) {
      return { recorded: false, reason: "giveaway is not open" };
    }

    const content = await payload
      .findByID({ collection: "partner-content", id: contentId, depth: 0 })
      .catch(() => null);

    // Only the app wall counts as a Featured Offer: a Connect Brands video is
    // a Boost, and the two must not be interchangeable.
    const placements = (content?.placements ?? []) as string[];
    if (!placements.includes("lucky-app-wall")) {
      return { recorded: false, reason: "not a Featured Offer placement" };
    }

    // Section 8 contributes to eligibility, and eligibility starts with a ticket.
    const tickets = await payload.count({
      collection: "giveaway-tickets",
      where: {
        and: [
          { giveaway: { equals: giveaway.id } },
          { user: { equals: userId } },
          { status: { equals: "valid" } },
        ],
      },
    });

    if (tickets.totalDocs === 0) {
      return { recorded: false, reason: "no valid ticket" };
    }

    const existing = await payload.count({
      collection: "giveaway-engagements",
      where: {
        and: [
          { giveaway: { equals: giveaway.id } },
          { user: { equals: userId } },
          { type: { equals: "featured_offer" } },
          { content: { equals: contentId } },
          { completionStatus: { equals: "completed" } },
        ],
      },
    });

    if (existing.totalDocs > 0) {
      return { recorded: false, reason: "already counted" };
    }

    await payload.create({
      collection: "giveaway-engagements",
      data: {
        giveaway: giveaway.id,
        user: userId,
        type: "featured_offer",
        content: contentId,
        completionStatus: "completed",
        completedAt: new Date().toISOString(),
      },
    });

    return { recorded: true };
  } catch (error) {
    payload.logger.error(
      { err: error, userId, contentId },
      "[giveaway] could not record a Featured Offer from a conversion"
    );
    return { recorded: false, reason: "error" };
  }
}
