import { randomUUID } from "node:crypto";
import { recordFeaturedOffer } from "@news-spend-media/payload/lib/giveaway/featuredOffer";

import { openapi } from "@orpc/openapi";
import type { BasePayload } from "payload";
import z from "zod";

import { protectedNoGuestProcedure, publicProcedure } from "../index";
import { verifyPartnerSignature } from "../lib/partnerWebhookSignature";

// Input schema for tracking a click
const trackClickInput = z.object({
  partnerContentId: z.string(),
  /**
   * Optional caller-minted click id, so a client can put the id into the
   * outbound URL and report the click without waiting on this round trip.
   *
   * Safe to accept because `clickId` is `unique: true` with a DB index on
   * partner-conversions: replaying somebody else's id fails the constraint
   * and writes nothing, so it cannot hijack or overwrite their conversion.
   * The format is pinned so the value stays a recognisable click id.
   *
   * Omitted, one is generated here as before.
   */
  clickId: z
    .string()
    .regex(/^clk_[0-9a-f]{16}$/, "Invalid click id")
    .optional(),
});

// Track a click on CPA content
export const trackClick = protectedNoGuestProcedure
  .input(trackClickInput)
  .handler(async ({ input, context, errors }) => {
    const { payload, user } = context;

    // Get PartnerContent with partner info
    const content = await payload.findByID({
      collection: "partner-content",
      id: input.partnerContentId,
      depth: 1,
    });

    if (!content) {
      throw errors.NOT_FOUND({
        message: "Partner content not found",
      });
    }

    // Get partner ID from content
    if (!content.partner) {
      throw errors.BAD_REQUEST({
        message: "Partner content has no associated partner",
      });
    }
    const partnerId =
      typeof content.partner === "string"
        ? content.partner
        : content.partner.id;

    // Caller-minted when the client needed the id before this call returned.
    const clickId =
      input.clickId ?? `clk_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

    // Create conversion record
    const created = await payload.create({
      collection: "partner-conversions",
      data: {
        user: user.id,
        partner: partnerId,
        content: input.partnerContentId,
        clickId,
        status: "clicked",
        pointsAwarded: 0,
        clickedAt: new Date().toISOString(),
      },
    });

    // Get redirect URL
    const partner = await payload.findByID({
      collection: "partners",
      id: partnerId,
    });

    const redirectUrl = content.links?.website || partner?.websiteUrl;

    /**
     * Settle the conversion here, for a partner who cannot post back yet.
     *
     * 8 counts completions rather than intentions, and a tap is only an
     * intention. That is why a Featured Offer normally waits for the
     * partner's confirmation. But a partner with no working postback will
     * never send one, so every offer of theirs is uncompletable, and Tier 1
     * and Tier 2 are then unreachable for everybody: both require a Featured
     * Offer, and only Tier 1 has a waiver, after four barren draws.
     *
     * So this is a deliberate, temporary and NARROW relaxation: per partner,
     * off by default, and described in the CMS in terms of what it costs. Not
     * a global switch, because a global switch is the one nobody remembers to
     * turn off. This stops applying the moment that partner's record is
     * corrected.
     *
     * Never throws. The person has tapped a link and is waiting on a
     * redirect; a bookkeeping failure must not strand them on a spinner.
     */
    if (partner?.awardOnClick) {
      try {
        /**
         * Once per person per offer, ever.
         *
         * `trackClick` deliberately records every tap (that is what click
         * tracking is), so nothing stops the same offer being opened fifty
         * times. Under a real postback that is harmless, because the partner
         * confirms one genuine action; with award-on-click there is no such
         * bound, and each tap would credit the points again.
         *
         * Points buy giveaway tickets, so an uncapped version of this is not
         * a points leak but an unlimited supply of draw entries. The Featured
         * Offer itself was already safe (`recordFeaturedOffer` refuses a
         * repeat), which is exactly why this gap would have been easy to miss:
         * eligibility looked correct while the points quietly multiplied.
         */
        const settled = await payload.count({
          collection: "partner-conversions",
          where: {
            and: [
              { user: { equals: user.id } },
              { content: { equals: input.partnerContentId } },
              { status: { in: ["converted", "awarded"] } },
            ],
          },
        });

        if (settled.totalDocs === 0) {
          await settleConversion(payload, {
            conversion: created,
            content,
            partnerOrderId: `click:${clickId}`,
          });
        }
      } catch (error) {
        payload.logger.error(
          { err: error, clickId },
          "[partner] could not settle an award-on-click conversion"
        );
      }
    }

    return {
      clickId,
      redirectUrl,
      success: true,
    };
  });

// Webhook input schema
const webhookInput = z.object({
  clickId: z.string(),
  status: z.enum(["success", "failed"]),
  partnerOrderId: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

/**
 * Turn a click into a completed, paid-for conversion.
 *
 * One implementation for both ways a conversion can settle: a verified
 * partner postback, and the award-on-click relaxation for a partner who
 * cannot post back yet. They award the same points and record the same
 * Featured Offer because they mean the same thing; two copies would be two
 * things to keep in step.
 *
 * Returns the points credited.
 */
async function settleConversion(
  payload: BasePayload,
  {
    conversion,
    content,
    partnerOrderId,
  }: {
    conversion: Record<string, any>;
    content: Record<string, any> | null;
    partnerOrderId?: string;
  }
): Promise<number> {
  const pointsToAward = Number(content?.points ?? 0);

  await payload.update({
    collection: "partner-conversions",
    id: conversion.id,
    data: {
      status: "converted",
      partnerOrderId,
      convertedAt: new Date().toISOString(),
    },
  });

  const userId =
    typeof conversion.user === "string" ? conversion.user : conversion.user?.id;

  if (pointsToAward > 0 && userId) {
    await payload.create({
      collection: "activities",
      data: {
        user: userId,
        type: "point",
        action: "partnerContentTask",
        point: pointsToAward,
        description: `Completed task: ${content?.title || "Partner task"}`,
      },
    });

    await payload.update({
      collection: "partner-conversions",
      id: conversion.id,
      data: {
        status: "awarded",
        pointsAwarded: pointsToAward,
        awardedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * A settled conversion on an app-wall item is a Featured Offer (8).
   *
   * Deliberately last and deliberately incapable of throwing: the points are
   * already credited, so a giveaway that is closed, or an offer already
   * counted, must not turn a settled conversion into a failure.
   */
  const contentId =
    typeof conversion.content === "string"
      ? conversion.content
      : conversion.content?.id;

  if (contentId && userId) {
    await recordFeaturedOffer(payload, { userId, contentId });
  }

  return pointsToAward;
}

// Webhook for partner to confirm conversions
export const handleWebhook = publicProcedure
  .meta(
    openapi({
      method: "POST",
      path: "/partner-conversions/webhook",
      tags: ["Partner Conversions"],
      summary: "Partner Conversion Webhook",
      description:
        "Webhook endpoint for partners to confirm CPA conversions. Call this when a user completes a task (install, purchase, etc.).",
    })
  )
  .input(webhookInput)
  .handler(async ({ input, context, errors }) => {
    const { payload } = context;

    // Find the conversion by clickId
    const conversions = await payload.find({
      collection: "partner-conversions",
      where: {
        clickId: { equals: input.clickId },
      },
      depth: 2,
      limit: 1,
    });

    const conversion = conversions.docs[0];
    if (!conversion) {
      throw errors.NOT_FOUND({
        message: "Click ID not found",
      });
    }

    /**
     * Prove the postback came from the partner before acting on it.
     *
     * The partner is identified by the click, not by anything the caller
     * says, so a forged request cannot choose whose secret it is checked
     * against. Verified before any write: the whole point is that an
     * unsigned call changes nothing.
     */
    const partnerRef = conversion.partner;
    const partnerDoc =
      typeof partnerRef === "object" && partnerRef !== null
        ? partnerRef
        : await payload
            .findByID({ collection: "partners", id: String(partnerRef) })
            .catch(() => null);

    const verdict = verifyPartnerSignature({
      headers: {
        signature: context.headers?.get("x-signature") ?? null,
        timestamp: context.headers?.get("x-timestamp") ?? null,
      },
      secret: String(partnerDoc?.webhookSecret ?? ""),
      clickId: input.clickId,
      status: input.status,
    });

    if (!verdict.valid) {
      payload.logger.warn(
        { clickId: input.clickId, reason: verdict.reason },
        "[partner] rejected an unverified conversion postback"
      );
      // Deliberately not saying which check failed; that is a tuning guide
      // for anyone probing it. The partner's own logs have the detail.
      throw errors.UNAUTHORIZED({
        message: "This conversion could not be verified.",
      });
    }

    // Check if already converted
    if (conversion.status === "converted" || conversion.status === "awarded") {
      return {
        success: true,
        message: "Already processed",
        clickId: input.clickId,
      };
    }

    // Get content to determine points
    const contentId =
      typeof conversion.content === "string"
        ? conversion.content
        : conversion.content.id;

    const content = await payload.findByID({
      collection: "partner-content",
      id: contentId,
    });

    if (input.status !== "success") {
      await payload.update({
        collection: "partner-conversions",
        id: conversion.id,
        data: {
          status: "failed",
          partnerOrderId: input.partnerOrderId,
          convertedAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        clickId: input.clickId,
        status: "failed" as const,
        pointsAwarded: 0,
      };
    }

    const pointsToAward = await settleConversion(payload, {
      conversion,
      content,
      partnerOrderId: input.partnerOrderId,
    });

    return {
      success: true,
      clickId: input.clickId,
      status: "converted" as const,
      pointsAwarded: pointsToAward,
    };
  });

export const partnerConversionRouter = {
  trackClick,
  webhook: handleWebhook,
};
