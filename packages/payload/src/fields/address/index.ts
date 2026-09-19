import type { GroupField, TextField } from "payload";
import { deepMerge } from "payload";

export type AddressFieldOverrides = {
  address1Overrides?: Partial<TextField>;
  address2Overrides?: Partial<TextField>;
  cityOverrides?: Partial<TextField>;
  countryOverrides?: Partial<TextField>;
  groupOverrides?: Partial<Omit<GroupField, "fields">>;
  postalCodeOverrides?: Partial<TextField>;
  required?: boolean;
  stateOverrides?: Partial<TextField>;
};

type AddressField = (overrides?: AddressFieldOverrides) => GroupField;

export const addressField: AddressField = (overrides = {}) => {
  const {
    address1Overrides = {},
    address2Overrides = {},
    cityOverrides = {},
    countryOverrides = {},
    groupOverrides = {},
    postalCodeOverrides = {},
    required = false,
    stateOverrides = {},
  } = overrides;

  return deepMerge<GroupField>(
    {
      fields: [
        {
          fields: [
            deepMerge<TextField>(
              {
                label: "Address 1",
                name: "address1",
                required,
                type: "text",
              },
              address1Overrides
            ),
            deepMerge<TextField>(
              {
                label: "Address 2",
                name: "address2",
                type: "text",
              },
              address2Overrides
            ),
          ],
          type: "row",
        },
        {
          fields: [
            deepMerge<TextField>(
              {
                label: "City",
                name: "city",
                required,
                type: "text",
              },
              cityOverrides
            ),
            deepMerge<TextField>(
              {
                label: "State",
                name: "state",
                required,
                type: "text",
              },
              stateOverrides
            ),
            deepMerge<TextField>(
              {
                label: "Postal Code",
                name: "postalCode",
                required,
                type: "text",
              },
              postalCodeOverrides
            ),
            deepMerge<TextField>(
              {
                label: "Country",
                name: "country",
                required,
                type: "text",
              },
              countryOverrides
            ),
          ],
          type: "row",
        },
      ],
      label: "Address",
      name: "address",
      type: "group",
    },
    groupOverrides
  );
};
