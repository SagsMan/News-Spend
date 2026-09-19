import type { Block } from "payload";

export const AdsBlock: Block = {
  slug: "ads",
  interfaceName: "AdsBlock",
  labels: {
    singular: "Ad",
    plural: "Ads",
  },
  fields: [
    {
      name: "type",
      type: "select",
      defaultValue: "LARGE_BANNER",
      options: [
        { label: "Banner", value: "BANNER" },
        { label: "Full Banner", value: "FULL_BANNER" },
        { label: "Large Banner", value: "LARGE_BANNER" },
        { label: "Medium Rectangle", value: "MEDIUM_RECTANGLE" },
      ],
      required: true,
    },
  ],
};
