import type { CollectionConfig } from "payload";

import { ADMIN_GROUP_RECORDS } from "./constants";

/**
 * The email log for Winner Report deliveries (spec 21).
 *
 * Section 21 asks for four things that a timestamp on the giveaway cannot provide:
 * exactly one *original* report per draw, automatic retries on failure, a
 * record of what was sent, and a Resend button in the CMS. All four need to
 * distinguish attempts from each other: which one was the original, how many
 * times it was tried, what the provider said when it failed, so each delivery
 * is its own row.
 *
 * A failed delivery never invalidates the draw. It is recorded here, retried,
 * and can be resent by hand; the winners stand regardless.
 */
export const GiveawayReportDeliveries: CollectionConfig = {
  slug: "giveaway-report-deliveries",
  labels: { singular: "Report Delivery", plural: "Report Deliveries" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "subject",
    defaultColumns: [
      "giveaway",
      "kind",
      "status",
      "recipient",
      "attempts",
      "sentAt",
    ],
    description:
      "Every attempt to email a Winner Report. The original is sent automatically when a draw completes; resends are recorded alongside it.",
  },
  access: {
    read: () => true,
    // Written by the report sender through the Local API, which bypasses these.
    create: () => false,
    update: () => false,
    delete: () => false,
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
      name: "kind",
      type: "select",
      required: true,
      index: true,
      options: [
        {
          label: "Original: sent automatically after the draw",
          value: "original",
        },
        { label: "Resend: requested by an administrator", value: "resend" },
      ],
      admin: {
        description:
          "There is at most one original per draw. Everything else is a resend.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      index: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Sent", value: "sent" },
        { label: "Failed", value: "failed" },
      ],
    },
    {
      name: "recipient",
      type: "text",
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "subject",
      type: "text",
      required: true,
      admin: { readOnly: true },
    },
    {
      name: "attachmentFileName",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "winnerCount",
      type: "number",
      admin: {
        readOnly: true,
        description: "Winners listed in the attachment when it was sent.",
      },
    },
    {
      name: "attempts",
      type: "number",
      required: true,
      defaultValue: 0,
      admin: {
        readOnly: true,
        description:
          "Delivery attempts made for this row, including automatic retries.",
      },
    },
    {
      name: "providerMessageId",
      type: "text",
      index: true,
      admin: {
        readOnly: true,
        description: "The mail provider's id, for tracing a delivery.",
      },
    },
    {
      name: "error",
      type: "textarea",
      admin: {
        readOnly: true,
        description: "The last failure, if this delivery did not succeed.",
      },
    },
    {
      name: "requestedBy",
      type: "text",
      admin: {
        readOnly: true,
        description: "Who asked for a resend. Empty for the original.",
      },
    },
    {
      name: "sentAt",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "createdAtIso",
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

export default GiveawayReportDeliveries;
