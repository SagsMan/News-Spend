import type { CollectionConfig } from "payload";
import { IMAGE_ONLY } from "../fields/uploadMimeFilters";

const Admins: CollectionConfig = {
  slug: "admins",
  auth: true,
  access: {
    read: () => true,
    create: () => true,
    update: ({ req: { user } }) => user?.collection === "admins",
    delete: ({ req: { user } }) => user?.collection === "admins",
  },
  admin: {
    useAsTitle: "fullName",
    group: "User Management",
  },
  fields: [
    // uuidField(),
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "viewer",
      options: [
        { label: "Super Admin", value: "super-admin" },
        { label: "Content Manager", value: "content-manager" },
        { label: "Editor", value: "editor" },
        { label: "Viewer", value: "viewer" },
        { label: "Partner", value: "partner" },
      ],
    },
    {
      name: "partner",
      type: "relationship",
      relationTo: "partners",
      hasMany: false,
      admin: {
        condition: (data) => data.role === "partner",
      },
    },
    {
      name: "moderationAlerts",
      type: "select",
      options: [
        { label: "All moderation email", value: "all" },
        { label: "Urgent reports only", value: "urgent" },
        { label: "Daily digest only", value: "digest" },
        { label: "None", value: "none" },
      ],
      admin: {
        condition: (data) => data.role !== "partner",
        description:
          "Which moderation email this admin receives. Leave unset to follow the roles configured in Moderation Settings. Partners never receive moderation email. Note that moderation alerts can never be switched off entirely: if every recipient opts out, Super Admins are notified regardless of this setting.",
      },
    },
    {
      name: "fullName",
      type: "text",
      required: true,
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
    },
  ],
};

export default Admins;
