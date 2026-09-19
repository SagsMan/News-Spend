import type { Field } from "payload";

import deepMerge from "../utils/deepMerge";

// import formatSlug from '../../../../services/express-api/src/util/formatSlug'

type Slug = (fieldToUse?: string, overrides?: Partial<Field>) => Field;

export const slugField: Slug = (fieldToUse = "title", overrides = {}) =>
  deepMerge<Field, Partial<Field>>(
    {
      name: "slug",
      label: "Slug",
      type: "text",
      index: true,
      unique: true,
      admin: {
        position: "sidebar",
        description: `URL-friendly version of the ${fieldToUse} field.`,
      },
      hooks: {
        // FIXME: updating fieldToUse doesn't update the slug
        // beforeValidate: [formatSlug(fieldToUse)],
      },
    },
    overrides
  );
