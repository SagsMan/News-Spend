import type { CollectionConfig } from "payload";
import { slugField } from "payload";
import { IMAGE_ONLY } from "../fields/uploadMimeFilters";

const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "title",
    hidden: true,
  },
  access: {
    read: () => true,
  },

  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    slugField({
      position: "sidebar",
    }),
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
    },
  ],
};

export default Categories;
