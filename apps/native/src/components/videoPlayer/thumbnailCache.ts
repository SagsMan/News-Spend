import { getThumbnailAsync } from "expo-video-thumbnails";

const thumbnailCache: Record<string, string> = {};

export const getThumbnailWithCache = async (
  videoUrl: string
): Promise<string | null> => {
  if (thumbnailCache[videoUrl]) {
    return thumbnailCache[videoUrl];
  }

  try {
    const { uri } = await getThumbnailAsync(videoUrl, {
      time: 10_000,
      quality: 1,
    });
    thumbnailCache[videoUrl] = uri;
    return uri;
  } catch (e) {
    console.warn("Failed to generate thumbnail:", e);
    return null;
  }
};
