import type { TextField } from "payload";
import { deepMerge } from "payload";

export type HeadingFieldOverrides = {
  headingOverrides?: Partial<TextField>;
};

type HeadingField = (overrides?: HeadingFieldOverrides) => [TextField];

export const headingField: HeadingField = (overrides = {}) => {
  const { headingOverrides = {} } = overrides;

  const headingField = deepMerge<TextField>(
    {
      label: "Heading",
      name: "heading",
      required: true,
      type: "text",
    },
    headingOverrides
  );

  return [headingField];
};
