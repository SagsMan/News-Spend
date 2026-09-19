import type { CollectionConfig } from "payload";

import { adminOnly } from "../access/hasRole";

export const NOTIFICATION_TYPES = [
  { label: "Breaking News", value: "breaking_news" },
  { label: "News", value: "news" },
  { label: "Comment", value: "comment" },
  { label: "Promo", value: "promo" },
  { label: "Misc", value: "misc" },
];

const NotificationInbox: CollectionConfig = {
  slug: "notification-inbox",
  admin: {
    useAsTitle: "title",
    group: "Push Notifications",
    defaultColumns: ["title", "user", "type", "createdAt"],
    description:
      "Per-user notification inbox. One record per user per campaign. Read by the mobile app to display notification history.",
    // Hidden in production, managed entirely by the system
    hidden: () => process.env.NODE_ENV === "production",
  },
  access: {
    // System creates these during the send pipeline
    create: () => true,
    // Users can only read their own notifications
    read: ({ req }) => {
      if (!req.user) {
        return false;
      }
      // Admins can read all
      if (req.user.collection === "admins") {
        return true;
      }
      // App users see only their own
      return {
        user: {
          equals: req.user.id,
        },
      };
    },
    // Only admins can modify or delete
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      admin: {
        description: "The user this inbox item belongs to",
      },
    },
    {
      name: "notification",
      type: "relationship",
      relationTo: "notifications",
      required: true,
      index: true,
      admin: {
        description: "The source campaign",
      },
    },
    // Denormalized fields for fast reads without joins
    {
      name: "title",
      type: "text",
      required: true,
      admin: {
        description: "Denormalized from campaign. Avoids joins on inbox fetch.",
      },
    },
    {
      name: "body",
      type: "textarea",
      required: true,
      admin: {
        description: "Denormalized from campaign",
      },
    },
    {
      name: "imageUrl",
      type: "text",
      admin: {
        description: "Denormalized image URL from campaign",
      },
    },
    {
      name: "data",
      type: "json",
      admin: {
        description: "Deeplink payload (e.g. { screen, id, url })",
      },
    },
    {
      name: "type",
      type: "select",
      options: NOTIFICATION_TYPES,
      defaultValue: "misc",
      index: true,
      admin: {
        description: "Notification category",
      },
    },
    {
      name: "clickCount",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: "Number of times the user tapped this notification",
      },
    },
  ],
  indexes: [{ fields: ["user", "notification"] }, { fields: ["user", "type"] }],
  timestamps: true,
};

export default NotificationInbox;
