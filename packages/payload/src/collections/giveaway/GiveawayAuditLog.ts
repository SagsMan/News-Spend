import type { CollectionConfig } from "payload";

import { ADMIN_GROUP_RECORDS, AUDIT_EVENT_TYPE_OPTIONS } from "./constants";

/**
 * Immutable audit log for all giveaway activity (spec 17, 18).
 *
 * Records are append-only: once written they cannot be edited or deleted
 * through the API or the admin UI.
 */
export const GiveawayAuditLog: CollectionConfig = {
  slug: "giveaway-audit-log",
  labels: { singular: "Audit Record", plural: "Audit Log" },
  admin: {
    group: ADMIN_GROUP_RECORDS,
    useAsTitle: "eventType",
    defaultColumns: ["giveaway", "eventType", "user", "createdAt"],
    description: "Append-only. Records cannot be edited or deleted.",
  },
  access: {
    read: () => true,
    // Written by the draw engine via Local API (which bypasses access control).
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
      name: "eventType",
      type: "select",
      required: true,
      index: true,
      options: AUDIT_EVENT_TYPE_OPTIONS,
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      index: true,
      admin: {
        description: "The user this event concerns, where applicable.",
      },
    },
    {
      name: "tier",
      type: "text",
      index: true,
    },
    {
      name: "message",
      type: "text",
      required: true,
    },
    {
      name: "detail",
      type: "json",
      admin: {
        description: "Structured event payload: counts, IDs, seeds, errors.",
      },
    },
    {
      name: "occurredAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
      },
    },
  ],
};

export default GiveawayAuditLog;
