import type { CollectionConfig } from "payload";

import { ACCOUNT_TRUST_STATUS_OPTIONS, ADMIN_GROUP } from "./constants";

/**
 * Account-level trust flags for the giveaway (spec 22.5–22.8).
 *
 * One row per *flagged* account, not per user: the overwhelming majority of
 * accounts are never flagged, so an unflagged user simply has no row here and
 * is treated as trusted.
 *
 * These live in their own collection rather than on `users` so that a
 * determination made for the giveaway cannot be mistaken for a platform-wide
 * judgement about the account, and so that the reason and the reviewer are
 * recorded alongside the flag.
 *
 * Two distinct effects, per the specification:
 *
 * - `disqualified` and any `duplicateAccountGroup` are excluded from the
 *   candidate pool before selection (22.5, 22.6), so they can never win.
 * - `suspicious` accounts are *not* excluded (22.7, 22.8). They take part
 *   normally, and if one wins, the prize is held for manual review. The draw
 *   is never rerun and the selection is never altered. The specification is
 *   explicit that suspicion must not change the algorithm.
 */
export const GiveawayAccountFlags: CollectionConfig = {
  slug: "giveaway-account-flags",
  labels: { singular: "Account Flag", plural: "Account Flags" },
  admin: {
    group: ADMIN_GROUP,
    useAsTitle: "id",
    defaultColumns: [
      "user",
      "trustStatus",
      "duplicateAccountGroup",
      "reason",
      "updatedAt",
    ],
    description:
      "Accounts excluded from draws or held for review. An account with no row here is treated as trusted.",
  },
  access: {
    read: () => true,
  },
  indexes: [{ fields: ["user"], unique: true }],
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "trustStatus",
      type: "select",
      required: true,
      defaultValue: "suspicious",
      index: true,
      options: [...ACCOUNT_TRUST_STATUS_OPTIONS],
      admin: {
        description:
          "Disqualified accounts are removed from the pool. Suspicious accounts still take part, but any prize they win is held for review.",
      },
    },
    {
      name: "duplicateAccountGroup",
      type: "text",
      index: true,
      admin: {
        description:
          "Identifier shared by accounts judged to belong to the same person. Every account in a group is excluded from the pool (22.6).",
      },
    },
    {
      name: "reason",
      type: "textarea",
      admin: {
        description: "Why this account was flagged. Included in the audit log.",
      },
    },
    {
      name: "flaggedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
    {
      name: "reviewedBy",
      type: "relationship",
      relationTo: "admins",
      admin: {
        position: "sidebar",
        description: "Administrator who last reviewed this account.",
      },
    },
  ],
};

export default GiveawayAccountFlags;
