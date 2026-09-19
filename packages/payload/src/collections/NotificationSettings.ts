import type { CollectionConfig } from "payload";

export const NotificationSettings: CollectionConfig = {
  slug: "notification-settings",
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
    },
    {
      name: "notificationType",
      type: "select",
      required: true,
      options: [
        { label: "Breaking News", value: "BREAKING_NEWS" },
        { label: "News", value: "NEWS" },
        { label: "Comment", value: "COMMENT" },
        { label: "Earning Opportunity", value: "EARNING_OPPORTUNITY" },
        { label: "Misc", value: "MISC" },
      ],
    },
    {
      name: "isNotificationEnabled",
      type: "checkbox",
      defaultValue: false,
    },
  ],
  admin: {
    useAsTitle: "notificationType",
  },
};
