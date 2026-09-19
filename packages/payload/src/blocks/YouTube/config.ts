import type { Block } from "payload";

export const YouTubeBlock: Block = {
  slug: "youtubeEmbed",
  imageURL: "https://thesvg.org/icons/youtube/default.svg",
  interfaceName: "YouTubeEmbedBlock",
  imageAltText: "YouTube",
  labels: {
    singular: "YouTube Video",
    plural: "YouTube Videos",
  },
  admin: {
    components: {
      Block:
        "@news-spend-media/payload/blocks/YouTube/Component#YouTubeBlockComponent",
    },
  },
  fields: [
    {
      name: "videoUrl",
      type: "text",
      required: true,
      label: "YouTube URL",
      admin: {
        description:
          "💡 Enter YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ)",
      },
    },
    {
      name: "caption",
      type: "text",
      label: "Caption",
      admin: {
        description: "Optional caption for the video",
      },
    },
  ],
};
