import type { CollectionConfig } from "payload";

import { adminOnly } from "../access/hasRole";

const NotificationDeliveries: CollectionConfig = {
  slug: "notification-deliveries",
  admin: {
    useAsTitle: "id",
    group: "Push Notifications",
    defaultColumns: ["notification", "user", "status", "deliveredAt"],
    description:
      "Per-device delivery receipts for push notification campaigns. Operational use only, used for Expo receipt polling and dead token cleanup.",
  },
  access: {
    read: adminOnly,
    create: () => true, // system writes during send pipeline
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: "notification",
      type: "relationship",
      relationTo: "notifications",
      required: true,
      index: true,
      admin: {
        description: "The campaign this delivery belongs to",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      index: true,
      admin: {
        description: "User this notification was sent to",
      },
    },
    {
      name: "pushToken",
      type: "text",
      required: true,
      admin: {
        description: "The Expo push token used for this delivery",
      },
    },
    {
      name: "deviceToken",
      type: "relationship",
      relationTo: "push-tokens",
      index: true,
      admin: {
        description: "The push-token record for matching open events",
      },
    },
    {
      name: "openedAt",
      type: "date",
      admin: {
        description: "When the user opened this notification",
      },
    },
    {
      name: "status",
      type: "select",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Delivered", value: "delivered" },
        { label: "Opened", value: "opened" },
        { label: "Failed", value: "failed" },
      ],
      required: true,
      defaultValue: "pending",
      index: true,
    },
    {
      name: "errorMessage",
      type: "text",
      admin: {
        condition: (data) => data?.status === "failed",
        description: "Error message if delivery failed",
      },
    },
    {
      name: "expoTicketId",
      type: "text",
      admin: {
        description: "Expo delivery ticket ID, used for receipt polling",
      },
    },
    {
      name: "deliveredAt",
      type: "date",
      admin: {
        condition: (data) => data?.status === "delivered",
        description: "When this notification was confirmed delivered",
      },
    },
  ],
  indexes: [
    { fields: ["notification", "user"] },
    { fields: ["status"] },
    { fields: ["expoTicketId"] },
  ],
  timestamps: true,
};

export default NotificationDeliveries;
