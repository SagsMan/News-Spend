import type { CollectionConfig } from "payload";

import { ADMIN_GROUP_RECORDS, PRIZE_TIER_OPTIONS } from "./constants";

/**
 * Consecutive Giveaway Eligibility counters (spec 11).
 *
 * Ticket, boost and featured-offer aggregates reset after every draw, but the
 * consecutive-giveaway streak must survive that reset, otherwise it could
 * never reach the required four. This collection holds that surviving state:
 * one row per user per tier, incremented when the user meets the tier's
 * consecutive bar for a giveaway and reset to zero the moment they miss it.
 */
export const GiveawayStreaks: CollectionConfig = {
  slug: "giveaway-streaks",
  labels: { singular: "Giveaway Streak", plural: "Giveaway Streaks" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: [
      "user",
      "tier",
      "consecutiveCount",
      "lastEvaluatedGiveaway",
      "updatedAt",
    ],
    description:
      "Consecutive-giveaway qualification counters. Persist across giveaways by design.",
  },
  access: {
    read: () => true,
  },
  indexes: [
    {
      fields: ["user", "tier"],
      unique: true,
    },
  ],
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "tier",
      type: "select",
      required: true,
      index: true,
      options: [...PRIZE_TIER_OPTIONS],
    },
    {
      name: "consecutiveCount",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description:
          "Consecutive giveaways in which the user met this tier's consecutive bar. Reset to 0 on any miss.",
      },
    },
    {
      name: "lastEvaluatedGiveaway",
      type: "relationship",
      relationTo: "giveaways",
      index: true,
      admin: {
        description:
          "Guards against double-counting if a draw is re-run for the same giveaway.",
      },
    },
    {
      name: "lastQualifiedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};

export default GiveawayStreaks;
