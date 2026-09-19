import type { CollectionConfig } from "payload";

export const Verification: CollectionConfig = {
  slug: "verifications",
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  admin: {
    group: "Authentication",
  },
  fields: [
    {
      name: "identifier",
      type: "text",
    },
    {
      name: "value",
      type: "text",
    },
    {
      name: "expiresAt",
      type: "date",
    },
  ],
};
