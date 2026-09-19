import type { TextField } from "payload";
import { deepMerge } from "payload";

export type TextFieldOverrides = {
  titleOverrides?: Partial<TextField>;
};

type TitleField = (overrides?: TextFieldOverrides) => [TextField];

export const titleField: TitleField = (overrides = {}) => {
  const { titleOverrides = {} } = overrides;

  const titleField = deepMerge<TextField>(
    {
      label: "Name",
      name: "title",
      required: true,
      type: "text",
    },
    titleOverrides
  );

  return [titleField];
};
