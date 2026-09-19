import type { CollectionConfig } from "payload";

export const Session: CollectionConfig = {
  slug: "sessions",
  access: {
    read: () => true,
    create: () => process.env.NODE_ENV === "development",
  },
  admin: {
    group: "Authentication",
  },
  fields: [
    {
      name: "userId",
      type: "text",
    },
    {
      name: "expiresAt",
      type: "date",
    },
    {
      name: "ipAddress",
      type: "text",
    },
    {
      name: "token",
      type: "text",
    },
    {
      name: "userAgent",
      type: "text",
    },
  ],
};
