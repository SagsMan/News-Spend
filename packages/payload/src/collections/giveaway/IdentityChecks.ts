import type { CollectionConfig } from "payload";

import { DIDIT_STATUSES } from "../../lib/giveaway/didit";
import { ADMIN_GROUP_RECORDS } from "./constants";

/**
 * Identity verification decisions from Didit (spec 16).
 *
 * Deliberately holds no documents. The provider keeps the passport photo and
 * the selfie; this side keeps a session id and a decision, which is everything
 * needed to release a prize and nothing that hurts if the table leaks. That is
 * the whole reason for replacing the old ID-upload form, whose images went
 * into the world-readable `media` collection.
 *
 * Verification is per USER, not per prize. Somebody who verified for a phone
 * in March is the same person in July, and asking again for each prize would
 * be an insult dressed as diligence. A prize that requires verification checks
 * for an approved row here.
 *
 * This replaced the old `identity-verification` collection, which was removed
 * along with the rest of the legacy lottery.
 */
export const IdentityChecks: CollectionConfig = {
  slug: "identity-checks",
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "id",
    defaultColumns: ["user", "status", "provider", "decidedAt", "updatedAt"],
    description:
      "Identity decisions from the verification provider. No documents are stored here: the provider holds those.",
  },
  access: {
    // A decision releases money's worth of prizes, so nothing outside the
    // server may write one, and the app reads its own status through the API
    // rather than by querying this directly.
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      admin: {
        description: "The person this decision is about.",
      },
    },
    {
      name: "provider",
      type: "select",
      required: true,
      defaultValue: "didit",
      options: [{ label: "Didit", value: "didit" }],
    },
    {
      name: "sessionId",
      label: "Provider session id",
      type: "text",
      required: true,
      index: true,
      unique: true,
      admin: {
        readOnly: true,
        description:
          "Unique so a replayed webhook updates the existing row instead of creating a second decision for the same session.",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      index: true,
      defaultValue: "Not Started",
      options: DIDIT_STATUSES.map((value) => ({ label: value, value })),
      admin: {
        description:
          "Only Approved releases a prize. In Review means the provider wants a human to look, and nothing is dispatched meanwhile.",
      },
    },
    {
      name: "decidedAt",
      type: "date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description:
          "When a final decision landed, as opposed to a progress update.",
      },
    },
    {
      name: "lastWebhookAt",
      type: "date",
      admin: {
        position: "sidebar",
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "note",
      type: "textarea",
      admin: {
        description:
          "Anything a person needs to know: a declined reason, or why a decision was overridden.",
      },
    },
  ],
};

export default IdentityChecks;
