// biome-ignore lint/style/useFilenamingConvention: PascalCase matches existing convention

import type { PromoVideoSource } from "@news-spend-media/payload/types";
import type React from "react";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import PromoVideo from "#/components/videoPlayer/PromoVideo";
import YoutubePromoPlayer from "#/components/videoPlayer/YoutubePromoPlayer";
import type { AdCarouselRef } from "./types";

const VideoComponent = ({
  item,
  adCarouselRef,
}: {
  item: PromoVideoSource;
  adCarouselRef: React.RefObject<AdCarouselRef | null>;
}) => {
  const [activated, setActivated] = useState(false);

  const handleActivate = useCallback(() => {
    setActivated(true);
  }, []);

  const resolvedUrl =
    item.videoSource === "upload" && typeof item.video === "object"
      ? (item.video?.url ?? undefined)
      : (item.url ?? undefined);

  // Server-generated (or manually uploaded) thumbnail
  const thumbnailUri =
    typeof item.thumbnail === "object" && item.thumbnail !== null
      ? ((item.thumbnail as { url?: string }).url ?? null)
      : null;

  if (item.videoSource === "upload" || item.videoSource === "normal") {
    return (
      <View className="">
        <PromoVideo
          autoPlay={activated}
          item={{
            ...item,
            url: activated ? resolvedUrl : null,
          }}
          posterSource={thumbnailUri ? { uri: thumbnailUri } : null}
          ref={adCarouselRef}
        />
        {!activated && (
          <Pressable
            className="absolute inset-0 items-center justify-center"
            onPress={handleActivate}
          >
            {thumbnailUri && (
              <Image
                contentFit="cover"
                source={{ uri: thumbnailUri }}
                style={{
                  position: "absolute",
                  width: "100%",
                  height: "100%",
                }}
              />
            )}
            <View className="size-20 items-center justify-center rounded-[40px] bg-black/55">
              <Text className="text-3xl text-white">▶</Text>
            </View>
          </Pressable>
        )}
      </View>
    );
  }

  if (item.videoSource === "youtube") {
    return (
      <View className="aspect-video">
        <YoutubePromoPlayer item={item} ref={adCarouselRef} />
      </View>
    );
  }

  return null;
};

export default VideoComponent;
