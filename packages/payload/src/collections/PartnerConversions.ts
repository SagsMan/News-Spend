import type { CollectionConfig } from "payload";

export const PartnerConversions: CollectionConfig = {
  slug: "partner-conversions",
  admin: {
    group: "Partners",
    defaultColumns: [
      "user",
      "partner",
      "content",
      "status",
      "clickId",
      "createdAt",
    ],
    useAsTitle: "clickId",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "partner",
      type: "relationship",
      relationTo: "partners",
      required: true,
      index: true,
    },
    {
      name: "content",
      type: "relationship",
      relationTo: "partner-content",
      required: true,
      index: true,
    },
    {
      name: "clickId",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "Unique tracking ID for this click/conversion",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "clicked",
      options: [
        { label: "Clicked", value: "clicked" },
        { label: "Converted", value: "converted" },
        { label: "Points Awarded", value: "awarded" },
        { label: "Failed", value: "failed" },
      ],
      index: true,
    },
    {
      name: "pointsAwarded",
      type: "number",
      defaultValue: 0,
      admin: {
        description: "Points awarded to user upon conversion",
      },
    },
    {
      name: "partnerOrderId",
      type: "text",
      admin: {
        description: "Order/transaction ID from partner",
      },
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        description: "Additional data from partner (IP, device info, etc.)",
      },
    },
    {
      name: "clickedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "convertedAt",
      type: "date",
      admin: {
        description: "When partner confirmed conversion",
        position: "sidebar",
      },
    },
    {
      name: "awardedAt",
      type: "date",
      admin: {
        description: "When points were awarded to user",
        position: "sidebar",
      },
    },
  ],
};
