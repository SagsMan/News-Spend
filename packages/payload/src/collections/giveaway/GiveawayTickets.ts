import type { CollectionConfig } from "payload";

import { ADMIN_GROUP_RECORDS, TICKET_STATUS_OPTIONS } from "./constants";

/**
 * Ticket purchases (spec 6).
 *
 * One row per purchase, not per user: a user who buys 5 tickets on day 1 and 5
 * more on day 3 has two rows totalling 10. Aggregation across the active
 * giveaway period is what determines tier eligibility; each individual valid
 * ticket is one independent entry in the random draw.
 */
export const GiveawayTickets: CollectionConfig = {
  slug: "giveaway-tickets",
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: ["giveaway", "user", "quantity", "status", "purchasedAt"],
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
      name: "quantity",
      type: "number",
      required: true,
      min: 1,
      admin: {
        description:
          "Number of tickets in this purchase. Each is one draw entry.",
      },
      validate: (value: number | null | undefined) => {
        if (value === null || value === undefined) {
          return "Quantity is required.";
        }
        if (!Number.isInteger(value) || value < 1) {
          return "Must be a positive whole number.";
        }
        return true;
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "valid",
      index: true,
      options: [...TICKET_STATUS_OPTIONS],
      admin: {
        description:
          "Only valid tickets are counted for eligibility or entered into the draw.",
      },
    },
    {
      name: "unitPrice",
      type: "number",
      required: true,
      min: 0,
      admin: {
        description: "Ticket price at time of purchase, for audit.",
      },
    },
    {
      name: "paymentReference",
      type: "text",
      index: true,
      admin: {
        description: "Payment provider reference for reconciliation.",
      },
    },
    {
      name: "purchasedAt",
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
      name: "statusChangedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (
          operation === "update" &&
          data?.status &&
          data.status !== originalDoc?.status
        ) {
          return { ...data, statusChangedAt: new Date().toISOString() };
        }
        return data;
      },
    ],
    afterChange: [
      /**
       * Hold any prize won on a ticket that has just been invalidated
       * (spec 12, post-draw refund or fraud event).
       *
       * The specification's sequence is: hold the record, prevent fulfilment,
       * record the reason, then require an administrator to review before the
       * winner is disqualified and a replacement drawn. This hook does the
       * first three automatically (the refund itself is the trigger) and
       * deliberately stops short of disqualifying anyone, because that is the
       * administrator's decision and it forfeits someone's prize.
       */
      async ({ doc, previousDoc, operation, req }) => {
        const becameInvalid =
          operation === "update" &&
          previousDoc?.status === "valid" &&
          doc.status !== "valid";

        if (!becameInvalid) {
          return doc;
        }

        const affected = await req.payload.find({
          collection: "giveaway-winners",
          where: {
            and: [
              { winningTicket: { equals: doc.id } },
              { fulfilmentStatus: { not_equals: "fulfilled" } },
              { claimStatus: { not_equals: "disqualified" } },
            ],
          },
          pagination: false,
          depth: 0,
        });

        for (const winner of affected.docs) {
          await req.payload.update({
            collection: "giveaway-winners",
            id: winner.id,
            data: {
              fulfilmentStatus: "on_hold",
              reviewNote: `The winning ticket was marked "${doc.status}" after the draw. Fulfilment is held pending administrator review (12).`,
            },
          });

          req.payload.logger.warn({
            msg: "[giveaway] winning ticket invalidated after the draw",
            winnerId: winner.id,
            ticketId: doc.id,
            newStatus: doc.status,
          });
        }

        return doc;
      },
    ],
  },
};

export default GiveawayTickets;
