import type { Field } from "payload";

import { createCustomId } from "../hooks/createCustomId";
import deepMerge from "../utils/deepMerge";

type UUID = (overrides?: Partial<Field>) => Field;

export const uuidField: UUID = (overrides = {}) =>
  deepMerge<Field, Partial<Field>>(
    {
      name: "id",
      type: "text",
      index: true,
      unique: true,
      admin: {
        hidden: true,
      },
      hooks: {
        beforeValidate: [createCustomId],
      },
    },
    overrides
  );
