import type { Media } from "@news-spend-media/payload/types";

export const getImageData = (image: Media | string | null | undefined) => {
  try {
    if (!image) {
      return { url: null, blurhash: undefined };
    }

    if (typeof image === "object" && image !== null) {
      return {
        url: image.url || null,
        blurhash: image.blurhash || undefined,
      };
    }

    if (typeof image === "string") {
      return {
        url: image,
        blurhash: undefined,
      };
    }

    return { url: null, blurhash: undefined };
  } catch (error) {
    console.error("Error parsing image data:", error);
    return { url: null, blurhash: undefined };
  }
};
