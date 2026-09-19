import type { CollectionConfig } from "payload";

import {
  ADMIN_GROUP,
  FULFILMENT_STATUS_OPTIONS,
  PRIZE_TIER_OPTIONS,
} from "./constants";

/**
 * Winner records (spec 12, 13, 21).
 *
 * A winner is a user who was randomly selected from a candidate pool AND
 * successfully allocated a prize. A user may hold at most one winner record per
 * giveaway.
 */
export const GiveawayWinners: CollectionConfig = {
  slug: "giveaway-winners",
  admin: {
    group: ADMIN_GROUP,
    useAsTitle: "id",
    defaultColumns: [
      "giveaway",
      "user",
      "tier",
      "prizeName",
      "claimStatus",
      "fulfilmentStatus",
      "selectedAt",
    ],
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
    },
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
      name: "prize",
      type: "relationship",
      relationTo: "prize-catalogue",
      required: true,
      index: true,
      admin: {
        description: "Reference to the Master Prize Catalogue entry.",
      },
    },
    {
      name: "prizeName",
      type: "text",
      required: true,
      admin: {
        readOnly: true,
        description:
          "Prize name captured at allocation time, so reports stay accurate if the catalogue is later renamed.",
      },
    },
    {
      name: "winningTicket",
      type: "relationship",
      relationTo: "giveaway-tickets",
      required: true,
      index: true,
      admin: {
        description: "The specific ticket entry drawn for this winner.",
      },
    },
    {
      name: "validTicketCount",
      type: "number",
      required: true,
      admin: {
        readOnly: true,
        description: "Total valid tickets this user held when the draw began.",
      },
    },
    {
      name: "boostCount",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        readOnly: true,
        description:
          "Successful Boost Your Luck interactions during the giveaway.",
      },
    },
    {
      name: "featuredOfferCount",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: "selectedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "claimStatus",
      type: "select",
      required: true,
      defaultValue: "unclaimed",
      index: true,
      options: [
        { label: "Unclaimed", value: "unclaimed" },
        { label: "Claimed", value: "claimed" },
        { label: "Expired", value: "expired" },
        { label: "Forfeited", value: "forfeited" },
        { label: "Disqualified", value: "disqualified" },
      ],
    },
    {
      name: "claimedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "claimDeadline",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
        description:
          "14 days from selection. The window also closes the moment the next giveaway starts, whichever comes first.",
      },
    },
    {
      name: "claimPhone",
      type: "text",
      admin: {
        readOnly: true,
        description:
          "Number the winner nominated for airtime or data, captured at claim time.",
      },
    },
    {
      name: "claimRecipientName",
      type: "text",
      admin: {
        readOnly: true,
        description: "Who the courier should hand a physical prize to.",
      },
    },
    {
      name: "claimAddress",
      type: "textarea",
      admin: {
        readOnly: true,
        description: "Delivery address, captured at claim time.",
      },
    },
    {
      name: "fulfilmentStatus",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [...FULFILMENT_STATUS_OPTIONS],
      admin: {
        description:
          "On Hold is set automatically when the winner's account is flagged as suspicious (22.7, 22.8): the win itself always stands, and a review never reruns the draw. Awaiting Verification means the winner still has an identity step to complete before this can be dispatched.",
      },
    },
    {
      name: "reviewNote",
      type: "textarea",
      admin: {
        readOnly: true,
        description:
          "Why this prize was held for review, recorded at selection time.",
      },
    },
    {
      name: "fulfilledAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "replaces",
      type: "relationship",
      relationTo: "giveaway-winners",
      index: true,
      admin: {
        readOnly: true,
        description:
          "Set when this record replaces a disqualified winner (12). The original is kept rather than deleted, so the audit trail stays intact.",
      },
    },
    {
      name: "disqualifiedAt",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "disqualificationReason",
      type: "textarea",
      admin: {
        readOnly: true,
        description:
          "Why this winner was disqualified, recorded before any replacement is drawn.",
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        const next = { ...data };
        if (
          operation === "update" &&
          data?.claimStatus === "claimed" &&
          originalDoc?.claimStatus !== "claimed" &&
          !data?.claimedAt
        ) {
          next.claimedAt = new Date().toISOString();
        }
        if (
          operation === "update" &&
          data?.fulfilmentStatus === "fulfilled" &&
          originalDoc?.fulfilmentStatus !== "fulfilled" &&
          !data?.fulfilledAt
        ) {
          next.fulfilledAt = new Date().toISOString();
        }
        return next;
      },
    ],
  },
};

export default GiveawayWinners;
