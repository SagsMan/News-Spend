import type { CollectionConfig } from "payload";

import { ADMIN_GROUP_RECORDS, PRIZE_TIER_OPTIONS } from "./constants";

/**
 * The locked candidate pool for one tier of one giveaway (spec 12).
 *
 * The specification requires the pool to be *locked* at cutoff, not merely
 * calculated: once written it must not change during execution, and the
 * replacement-winner rule draws from "the original locked candidate pool" when
 * a winner is later disqualified. A pool held only in memory cannot satisfy
 * that; by the time a refund surfaces, the draw is long over.
 *
 * `entries` holds one record per valid ticket purchase, exactly as the draw
 * saw it, so a replacement is drawn from the same weighted population as the
 * original selection rather than from a pool rebuilt out of data that has
 * since moved on.
 *
 * These are records of what happened, so they are append-only: written once by
 * the draw and never edited afterwards.
 */
export const GiveawayPoolSnapshots: CollectionConfig = {
  slug: "giveaway-pool-snapshots",
  labels: { singular: "Pool Snapshot", plural: "Pool Snapshots" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: ["giveaway", "tier", "candidateCount", "lockedAt"],
    description:
      "The candidate pool as locked at draw time. Replacement winners are drawn from here.",
  },
  access: {
    read: () => true,
    // Written by the draw engine through the Local API, which bypasses these.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  indexes: [{ fields: ["giveaway", "tier"], unique: true }],
  fields: [
    {
      name: "giveaway",
      type: "relationship",
      relationTo: "giveaways",
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
      name: "candidateCount",
      type: "number",
      required: true,
      admin: {
        readOnly: true,
        description:
          "Distinct users eligible for this tier when it was locked.",
      },
    },
    {
      name: "entries",
      type: "json",
      required: true,
      admin: {
        readOnly: true,
        description:
          "One entry per valid ticket purchase: { ticketId, userKey, quantity }. Preserves the ticket weighting the draw used.",
      },
    },
    {
      name: "lockedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};

export default GiveawayPoolSnapshots;
