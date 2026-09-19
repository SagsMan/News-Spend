import type { CollectionConfig } from "payload";

import { urlField } from "../fields/urlField";

export const Survey: CollectionConfig = {
  slug: "survey",
  admin: {
    useAsTitle: "name",
    group: "Points Mall",
  },
  fields: [
    {
      name: "name",
      type: "text",
    },
    {
      name: "googleFormId",
      type: "text",
      required: true,
    },
    urlField({
      name: "surveyLink",
      required: true,
    }),
    {
      name: "users",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
    },
    {
      name: "points",
      type: "number",
    },
  ],
};
