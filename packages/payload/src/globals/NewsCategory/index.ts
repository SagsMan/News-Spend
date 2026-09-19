import type { GlobalConfig } from "payload";

const NewsCategory: GlobalConfig = {
  slug: "news-category",
  access: { read: () => true },
  fields: [
    {
      name: "items",
      type: "array",
      fields: [
        {
          name: "category",
          type: "relationship",
          relationTo: "categories",
          required: false,
          unique: true,
        },
      ],
    },
  ],
};

export default NewsCategory;
