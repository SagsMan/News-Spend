import { type CollectionConfig, slugField } from "payload";
import { IMAGE_ONLY } from "../fields/uploadMimeFilters";
import { urlField } from "../fields/urlField";

export const Stores: CollectionConfig = {
  slug: "stores",
  access: {
    read: () => true,
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "image", "url", "cashBack"],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    slugField({
      useAsSlug: "name",
      position: "sidebar",
    }),
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
      required: true,
    },
    urlField({
      name: "url",
      required: true,
      admin: {
        description: "💡 Url of the store",
      },
    }),
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "cashBack",
      type: "number",
      defaultValue: 0,
      admin: {
        description:
          "💡 Cashback is in percentage. For example, if the cashback is 5%, enter 5.",
      },
    },
  ],
};
