import type { CollectionConfig } from "payload";

const PushTokens: CollectionConfig = {
  slug: "push-tokens",
  admin: {
    useAsTitle: "token",
    group: "Push Notifications",
    hidden: process.env.NODE_ENV === "production",
  },
  fields: [
    {
      name: "token",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "The unique token for the push notification service.",
      },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      admin: {
        description: "The user associated with the push token.",
      },
    },
    {
      name: "deviceType",
      type: "select",
      options: ["ios", "android", "web"],
    },
    {
      name: "deviceName",
      type: "text",
      admin: {
        description: "Name of the device (e.g., iPhone 13, Pixel 6)",
      },
    },
    {
      name: "deviceModel",
      type: "text",
      admin: {
        description: "Model of the device",
      },
    },
    {
      name: "osVersion",
      type: "text",
      admin: {
        description: "Version of the operating system",
      },
    },
    {
      name: "appVersion",
      type: "text",
      admin: {
        description: "Version of the app when token was registered",
      },
    },
    {
      name: "status",
      type: "select",
      options: ["active", "inactive"],
      defaultValue: "active",
      required: true,
    },
    {
      name: "lastUsed",
      type: "date",
      admin: {
        description:
          "Last time a notification was successfully sent to this token",
      },
    },
  ],
};

export default PushTokens;
