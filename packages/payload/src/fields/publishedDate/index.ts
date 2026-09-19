import type { DateField } from "payload";
import { deepMerge } from "payload";

export type PublishedDateFieldOverrides = {
  publishedDateOverrides?: Partial<DateField>;
};

type PublishedDateField = (
  overrides?: PublishedDateFieldOverrides
) => [DateField];

export const publishedDateField: PublishedDateField = (overrides = {}) => {
  const { publishedDateOverrides = {} } = overrides;

  const publishedDateField = deepMerge<DateField>(
    {
      admin: {
        position: "sidebar",
      },
      label: "Published Date",
      name: "publishedDate",
      type: "date",
    },
    publishedDateOverrides
  );

  return [publishedDateField];
};
