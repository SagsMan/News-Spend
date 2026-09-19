import type { CollectionConfig } from "payload";

const UserBlocks: CollectionConfig = {
  slug: "userBlocks",
  admin: {
    useAsTitle: "id",
    group: "User Management",
    defaultColumns: ["blocker", "blocked", "createdAt"],
    description:
      "Users blocked by other users. Created from the app; blocking also files a Content Report so moderators are notified.",
  },
  access: {
    // Blocks are read and written through the API using the local Payload
    // client, which bypasses access control. These rules govern the admin
    // panel and REST surface only.
    read: ({ req: { user } }) => user?.collection === "admins",
    create: ({ req: { user } }) => user?.collection === "admins",
    update: () => false,
    delete: ({ req: { user } }) => user?.collection === "admins",
  },
  indexes: [
    {
      fields: ["blocker", "blocked"],
      unique: true,
    },
  ],
  fields: [
    {
      name: "blocker",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      hasMany: false,
      admin: { description: "The user who initiated the block." },
    },
    {
      name: "blocked",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
      hasMany: false,
      admin: { description: "The user whose content is hidden as a result." },
    },
  ],
};

export default UserBlocks;
