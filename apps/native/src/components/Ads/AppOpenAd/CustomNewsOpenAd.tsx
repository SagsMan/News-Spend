import type { PartnerContent } from "@news-spend-media/payload/types";
import { useEventListener } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Spinner } from "heroui-native/spinner";
import {
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "#/lib/icons";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Text } from "#/components/heroui/text";
import { getThumbnailWithCache } from "#/components/videoPlayer/thumbnailCache";
import { usePartnerClick } from "#/hooks/usePartnerClick";
import { appOpenAdSheetState } from "#/state/appOpenAdState";
import { getImageData } from "#/utils/getImageData";
import { getCtaLabel } from "#/utils/index";

// YouTube removed: ToS violation in ad context

type VideoPlayerStatus = "idle" | "loading" | "readyToPlay" | "error";

export default function CustomNewsOpenAd({ ad }: { ad: PartnerContent }) {
  const { width } = useWindowDimensions();
  const { handleClick } = usePartnerClick();

  const isVideoAd =
    ad.type === "video" &&
    (ad.videoType === "UPLOAD" || ad.videoType === "EXTERNAL");
  const isImageAd = !isVideoAd;

  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [isLoading, setLoading] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoPlayerStatus>("idle");

  const { url, blurhash } = getImageData(isImageAd ? ad.media : null);
  const partnerLogo = getImageData(
    ad.partner &&
      typeof ad.partner === "object" &&
      "logo" in ad.partner &&
      typeof ad.partner.logo !== "string"
      ? ad.partner.logo
      : null
  );

  const videoSourceUri = isVideoAd
    ? (ad.videoUrl ?? (typeof ad.video === "string" ? ad.video : ad.video?.url))
    : null;

  const player = useVideoPlayer(null, (p) => {
    p.muted = true;
    p.loop = false;
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    if (!videoSourceUri) {
      return;
    }
    player.replaceAsync({ uri: videoSourceUri }).catch((error) => {
      console.warn("Failed to load ad video", error);
    });
  }, [player, videoSourceUri]);

  useEffect(() => {
    if (!videoSourceUri) {
      player.pause();
      return;
    }
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused, player, videoSourceUri]);

  useEffect(() => {
    if (!videoSourceUri) {
      return;
    }
    let isMounted = true;
    (async () => {
      const uri = await getThumbnailWithCache(videoSourceUri);
      if (isMounted) {
        setThumbnail(uri);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [videoSourceUri]);

  useEventListener(player, "statusChange", ({ status: nextStatus }) => {
    setStatus(nextStatus);
    setLoading(nextStatus === "loading");
  });

  useEventListener(player, "playToEnd", () => {
    player.pause();
    player.currentTime = 0;
    setPaused(true);
  });

  /**
   * Close the sheet before handing off. Unlike the other ad surfaces this one
   * lives inside the app-open BottomSheet, and a website link routes to the
   * InAppBrowser screen — pushing that while the sheet is still up would put
   * the browser behind it.
   */
  const onPress = useCallback(() => {
    appOpenAdSheetState.close();
    handleClick(ad);
  }, [handleClick, ad]);

  const videoHeight = (width / 16) * 9;

  return (
    <View className="flex-1 rounded-t-xl bg-background py-2">
      <Text className="text-center">Advertisement</Text>

      <View className="w-full">
        {isVideoAd ? (
          <View className="relative mx-2" style={{ height: videoHeight }}>
            <VideoView
              contentFit="cover"
              nativeControls={false}
              player={player}
              style={{ width: "100%", height: "100%" }}
            />
            {status !== "readyToPlay" && (
              <Image
                contentFit="cover"
                source={thumbnail ? { uri: thumbnail } : undefined}
                style={StyleSheet.absoluteFill}
              />
            )}
            <View className="absolute inset-0 items-start justify-end">
              {isLoading && (
                <View className="absolute inset-0 z-20 items-center justify-center">
                  <Spinner />
                </View>
              )}
              <View className="flex-row">
                <Button
                  accessibilityLabel={paused ? "Play video" : "Pause video"}
                  className="rounded-none bg-black/50"
                  onPress={() => setPaused((p) => !p)}
                  size="sm"
                >
                  {paused ? (
                    <PlayIcon color="white" size={16} />
                  ) : (
                    <PauseIcon color="white" size={16} />
                  )}
                </Button>
                <Button
                  accessibilityLabel={muted ? "Unmute video" : "Mute video"}
                  className="rounded-none bg-black/50"
                  onPress={() => setMuted((m) => !m)}
                  size="sm"
                >
                  {muted ? (
                    <Icon color="white" name={SpeakerSlashIcon} size={16} />
                  ) : (
                    <Icon color="white" name={SpeakerHighIcon} size={16} />
                  )}
                </Button>
              </View>
            </View>
          </View>
        ) : (
          <Image
            contentFit="contain"
            placeholder={{ blurhash }}
            placeholderContentFit="contain"
            source={url}
            style={{ height: videoHeight, width: "100%" }}
          />
        )}
      </View>

      <Text className="mx-2 my-3 self-start border border-p-400 px-px font-medium">
        Ad
      </Text>

      <View className="flex-1 items-center justify-center gap-4">
        <Image
          contentFit="contain"
          source={{ uri: partnerLogo?.url || undefined }}
          style={{ height: 120, width: 120 }}
        />
        <View className="items-center justify-center">
          <Text className="text-center font-bold text-xl">{ad?.title}</Text>
          <Text className="max-w-87.5 text-center text-base">
            {ad?.condition}
          </Text>
        </View>
        <Button className="mt-5 min-w-55" onPress={onPress}>
          {getCtaLabel(ad.cta)}
        </Button>
      </View>
    </View>
  );
}
