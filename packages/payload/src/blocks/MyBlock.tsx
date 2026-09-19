import type { Block } from "payload";

export const MyBlock: Block = {
  slug: "myCustomBlock",
  admin: {
    components: {
      Block: "/components/MyBlockComponent#MyBlockComponent",
    },
  },
  fields: [
    {
      name: "style",
      type: "select",
      options: ["primary", "secondary"],
    },
  ],
};
