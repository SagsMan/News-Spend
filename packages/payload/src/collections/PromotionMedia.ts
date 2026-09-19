import type { CollectionConfig } from "payload";

import { PromoImageBlock, PromoVideoSourceBlock } from "../blocks/PromoBlocks";

const PromotionMedia: CollectionConfig = {
  slug: "promotion-media",
  labels: {
    singular: "Promotion Media",
    plural: "Promotion Media",
  },
  access: {
    read: () => true,
  },
  admin: {
    hidden: () => true,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "Promotion Title",
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      label: "Promotion Description",
    },
    {
      name: "points",
      type: "number",
      required: true,
      label: "Reward points",
      min: 1,
      defaultValue: 0,
    },
    {
      name: "items",
      admin: {
        description:
          "💡Promotion images and video url, one video url and at least three images",
      },
      label: "Items",
      type: "array",
      minRows: 4,
      maxRows: 6,
      validate: (val) => {
        const videoBlks = val?.filter(
          // @ts-expect-error
          (item) => item.layout?.[0]?.blockType === "promo-video-source"
        );

        if (videoBlks?.length === 0) {
          return "Must have at least one video";
        }
        // @ts-expect-error
        if (videoBlks?.length > 1) {
          return "Only one video is allowed";
        }

        return true;
      },
      fields: [
        {
          name: "layout",
          label: "item",
          type: "blocks",
          minRows: 1,
          maxRows: 1,
          blocks: [PromoVideoSourceBlock, PromoImageBlock],
        },
      ],
    },
  ],
};

export default PromotionMedia;
