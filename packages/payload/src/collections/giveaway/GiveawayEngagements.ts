import type { CollectionConfig } from "payload";

import {
  ADMIN_GROUP_RECORDS,
  COMPLETION_STATUS_OPTIONS,
  ENGAGEMENT_TYPE_OPTIONS,
} from "./constants";

/**
 * Boost Your Luck interactions and Featured Offer completions (spec 7, 8).
 *
 * These are one collection rather than two because they differ only in which
 * app surface produced them. Both are engagement with a `partner-content`
 * item, both contribute to Tier 1 and Tier 2 eligibility only, both aggregate
 * within the active giveaway period, and neither creates additional draw
 * entries.
 *
 * `content` points at the partner item the user actually engaged with, so the
 * giveaway system does not maintain its own parallel notion of what an offer
 * is. `conversion` links to the partner-side CPA record once a partner
 * integration exists; until then it stays empty and is deliberately NOT what
 * gates eligibility. Requiring it today would make Tier 1 and Tier 2
 * unreachable, since no partner platform is integrated yet.
 */
export const GiveawayEngagements: CollectionConfig = {
  slug: "giveaway-engagements",
  labels: { singular: "Engagement", plural: "Engagements" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: [
      "giveaway",
      "user",
      "type",
      "content",
      "completionStatus",
      "completedAt",
    ],
    description:
      "Boost Your Luck and Featured Offer completions. Contributes to Tier 1 and Tier 2 eligibility only; never creates additional draw entries.",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "giveaway",
      type: "relationship",
      relationTo: "giveaways",
      required: true,
      index: true,
      admin: {
        description:
          "Scopes the engagement to one giveaway, so aggregates are naturally per-giveaway and reset with it.",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      required: true,
      index: true,
      options: [...ENGAGEMENT_TYPE_OPTIONS],
      admin: {
        description:
          "Boost = a Connect Brand advertisement watched to completion. Featured Offer = an item on the Lucky App Wall.",
      },
    },
    {
      name: "content",
      type: "relationship",
      relationTo: "partner-content",
      index: true,
      admin: {
        description: "The partner item the user engaged with.",
      },
    },
    {
      name: "conversion",
      type: "relationship",
      relationTo: "partner-conversions",
      index: true,
      admin: {
        description:
          "Set once a CPA partner confirms the action. Not required for eligibility today: no partner platform is integrated yet.",
      },
    },
    {
      name: "completionStatus",
      type: "select",
      required: true,
      defaultValue: "completed",
      index: true,
      options: [...COMPLETION_STATUS_OPTIONS],
      admin: {
        description:
          "Only 'completed' contributes towards tier eligibility. Incomplete, abandoned and failed engagements are ignored.",
      },
    },
    {
      name: "completedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        description: "Activity-specific detail retained for audit.",
      },
    },
  ],
};

export default GiveawayEngagements;
