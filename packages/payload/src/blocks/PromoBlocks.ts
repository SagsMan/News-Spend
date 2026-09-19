import type { Block } from "payload";
import { IMAGE_ONLY, VIDEO_ONLY } from "../fields/uploadMimeFilters";
import { trimUrlHook } from "../fields/urlField";

export const PromoVideoSourceBlock: Block = {
  slug: "promo-video-source",
  interfaceName: "PromoVideoSource",
  fields: [
    {
      name: "videoSource",
      label: "Video Source",
      type: "select",
      options: [
        { label: "Upload", value: "upload" },
        { label: "Normal URL", value: "normal" },
        { label: "YouTube", value: "youtube" },
      ],
      defaultValue: "upload",
      required: true,
      admin: {
        description: "Specify the video source",
      },
    },
    {
      name: "video",
      label: "Video File",
      type: "upload",
      relationTo: "media",
      filterOptions: VIDEO_ONLY,
      admin: {
        description: "Upload an MP4 video file",
        condition: (_, siblingData) => siblingData?.videoSource === "upload",
        components: {
          afterInput: [
            "@news-spend-media/payload/components/VideoPreviewField#VideoPreviewField",
          ],
        },
      },
    },
    {
      name: "url",
      label: "Video URL",
      type: "text",
      hooks: {
        beforeChange: [trimUrlHook],
      },
      admin: {
        condition: (_, siblingData) =>
          ["normal", "youtube"].includes(siblingData?.videoSource),
        components: {
          afterInput: [
            "@news-spend-media/payload/components/VideoPreviewField#VideoPreviewField",
          ],
        },
      },
      validate: (_val: any, { siblingData }: any) => {
        if (!["normal", "youtube"].includes(siblingData?.videoSource)) {
          return true;
        }
        if (!siblingData?.url) {
          return "Please enter a URL";
        }
        try {
          new URL(siblingData.url);
          if (siblingData.videoSource === "youtube") {
            const youtubeRegex =
              /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
            if (!youtubeRegex.test(siblingData.url)) {
              return "Invalid YouTube link";
            }
          }
          return true;
        } catch {
          return "Please enter a valid URL";
        }
      },
    },
    {
      name: "thumbnail",
      type: "upload",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
      admin: {
        description:
          "Upload a custom thumbnail, or leave empty to auto-generate from video on save",
      },
    },
    {
      // Hidden fingerprint: tracks what the thumbnail was generated from
      name: "thumbnailSource",
      type: "text",
      admin: {
        condition: () => false,
        readOnly: true,
      },
    },
  ],
};

export const PromoImageBlock: Block = {
  slug: "promo-image",
  interfaceName: "PromoImage",
  fields: [
    {
      name: "image",
      type: "upload",
      label: "Image",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
      required: true,
    },
  ],
};
