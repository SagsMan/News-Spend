import type { Block } from "payload";

export const TwitterBlock: Block = {
  slug: "twitterEmbed",
  imageURL: "https://thesvg.org/icons/twitter/default.svg",
  interfaceName: "TwitterPostBlock",
  imageAltText: "Twitter",
  labels: {
    singular: "Twitter Post",
    plural: "Twitter Posts",
  },
  admin: {
    components: {
      Block:
        "@news-spend-media/payload/blocks/TwitterPost/Component#TwitterPostBlockComponent",
    },
  },
  fields: [
    {
      name: "tweetId",
      type: "text",
      required: true,
      label: "Tweet ID or URL",
      admin: {
        description:
          "💡 Enter tweet ID (e.g., 1628832338187636740) or full URL (e.g., https://twitter.com/user/status/1628832338187636740)",
      },
    },
  ],
};
