import type { CheckboxField } from "payload";
import { deepMerge } from "payload";

export type HideFromIndexingFieldOverrides = {
  hideFromIndexingOverrides?: Partial<CheckboxField>;
};

type HideFromIndexingField = (
  overrides?: HideFromIndexingFieldOverrides
) => [CheckboxField];

export const hideFromIndexingField: HideFromIndexingField = (
  overrides = {}
) => {
  const { hideFromIndexingOverrides = {} } = overrides;

  const hideFromIndexingField = deepMerge<CheckboxField>(
    {
      admin: {
        position: "sidebar",
      },
      label: "Hide page from indexing",
      name: "hideFromIndexing",
      type: "checkbox",
    },
    hideFromIndexingOverrides
  );

  return [hideFromIndexingField];
};
