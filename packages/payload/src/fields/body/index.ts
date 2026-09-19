import type { TextField } from "payload";
import { deepMerge } from "payload";

export type BodyFieldOverrides = {
  bodyOverrides?: Partial<TextField>;
};

type BodyField = (overrides?: BodyFieldOverrides) => [TextField];

export const bodyField: BodyField = (overrides) => {
  const { bodyOverrides = {} } = overrides ?? {};

  const bodyField = deepMerge<TextField>(
    {
      label: "Body",
      name: "body",
      type: "text",
    },
    bodyOverrides
  );

  return [bodyField];
};
