import type { CollectionConfig } from "payload";

import { ADMIN_GROUP_RECORDS } from "./constants";

/**
 * Every attempt to deliver a prize through a provider (spec 15).
 *
 * Money leaves the platform here, so the record has to answer three questions
 * without anyone guessing: was this paid, how many times did we try, and what
 * did the provider say when it did not work. A timestamp on the winner row can
 * answer the first only.
 *
 * `providerReference` is the identifier sent to the provider, and it is the
 * winner's own id. That is what makes a retry safe: the provider recognises a
 * repeat and refuses to send twice, so a run that dies between paying and
 * recording cannot double-pay on its next pass.
 */
export const GiveawayFulfilmentAttempts: CollectionConfig = {
  slug: "giveaway-fulfilment-attempts",
  labels: { singular: "Fulfilment Attempt", plural: "Fulfilment Attempts" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: [
      "winner",
      "provider",
      "outcome",
      "localAmount",
      "attemptedAt",
    ],
    description:
      "Provider payouts for airtime and data prizes. Append-only: the record of what was actually sent.",
  },
  access: {
    read: () => true,
    // Written by the fulfilment job through the Local API, which bypasses these.
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "winner",
      type: "relationship",
      relationTo: "giveaway-winners",
      required: true,
      index: true,
    },
    {
      name: "provider",
      type: "select",
      required: true,
      defaultValue: "reloadly",
      index: true,
      options: [{ label: "Reloadly", value: "reloadly" }],
    },
    {
      name: "environment",
      type: "select",
      required: true,
      options: [
        { label: "Sandbox: simulated", value: "sandbox" },
        { label: "Live: real money", value: "live" },
      ],
      admin: {
        description:
          "Which environment this ran against. A sandbox payout delivered nothing, however successful it looks.",
      },
    },
    {
      name: "outcome",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Sent", value: "sent" },
        {
          label: "Already sent: provider recognised a repeat",
          value: "already_sent",
        },
        { label: "Failed: worth retrying", value: "retryable_failure" },
        { label: "Failed: will not succeed", value: "permanent_failure" },
        { label: "Skipped: not configured", value: "skipped" },
      ],
    },
    {
      name: "providerReference",
      type: "text",
      index: true,
      admin: {
        readOnly: true,
        description:
          "The idempotency key sent to the provider. Repeating it is what stops a double payment.",
      },
    },
    {
      name: "providerTransactionId",
      type: "text",
      index: true,
      admin: { readOnly: true },
    },
    {
      name: "operatorId",
      type: "number",
      admin: {
        readOnly: true,
        description:
          "Network the top-up was sent to, as the provider knows it.",
      },
    },
    {
      name: "operatorName",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "localAmount",
      type: "number",
      admin: {
        readOnly: true,
        description: "Amount in the recipient's own currency, as promised.",
      },
    },
    {
      name: "recipientPhone",
      type: "text",
      admin: { readOnly: true },
    },
    {
      name: "error",
      type: "textarea",
      admin: { readOnly: true },
    },
    {
      name: "attemptedAt",
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

export default GiveawayFulfilmentAttempts;
