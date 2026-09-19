import type { PartnerContent } from "@news-spend-media/payload/types";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  CaretRightIcon,
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "#/lib/icons";
import { useCallback, useEffect, useMemo } from "react";
import { useWindowDimensions, View } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

import { Button } from "#/components/heroui/button";
import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import { useVideoSettings } from "#/hooks/use-video-settings";
import { getCtaLabel } from "#/utils";
import { getImageData } from "#/utils/getImageData";

// ─── Types ────────────────────────────────────────────────────────────────────

type Ad = PartnerContent;

type PartnerAdContentProps = {
  ad: Ad;
  showAdLabel?: boolean;
  onAdClick: () => void;
  ytPlaying: boolean;
  onYtStateChange: (state: string) => void;
};

// ─── YouTube ID helper ────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string {
  const match = url.match(
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  );
  return match && match[2]?.length === 11 ? match[2] : "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PartnerAdContent({
  ad,
  showAdLabel = true,
  onAdClick,
  ytPlaying,
  onYtStateChange,
}: PartnerAdContentProps) {
  const { width, height } = useWindowDimensions();
  const { isDataSaverActive } = useVideoSettings();

  const isYouTubeAd = ad.type === "video" && ad.videoType === "YOUTUBE";
  const isUploadedVideoAd =
    ad.type === "video" &&
    (ad.videoType === "UPLOAD" || ad.videoType === "EXTERNAL");
  // Only fall back to image if it's genuinely not a video of any kind
  const isImageAd = !(isUploadedVideoAd || isYouTubeAd);

  // ── Video player (only mounted for uploaded/external video ads) ──────────────
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const { muted } = useEvent(player, "mutedChange", { muted: player.muted });

  const videoUrl = useMemo(() => {
    if (!isUploadedVideoAd) {
      return null;
    }
    if (ad.videoUrl) {
      return ad.videoUrl;
    }
    if (typeof ad.video === "string") {
      return ad.video;
    }
    if (ad.video && typeof ad.video === "object" && "url" in ad.video) {
      return ad.video.url;
    }
    return null;
  }, [isUploadedVideoAd, ad.videoUrl, ad.video]);

  useEffect(() => {
    if (isUploadedVideoAd && videoUrl) {
      player.replaceAsync({ uri: videoUrl, useCaching: !isDataSaverActive });
    }
  }, [isUploadedVideoAd, videoUrl, player, isDataSaverActive]);

  const togglePlaying = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  // ── YouTube ──────────────────────────────────────────────────────────────────
  const videoId = useMemo(
    () => (isYouTubeAd && ad.videoUrl ? extractYouTubeId(ad.videoUrl) : null),
    [isYouTubeAd, ad.videoUrl]
  );

  // ── Image ────────────────────────────────────────────────────────────────────
  const { url: imageUrl, blurhash } = useMemo(
    () => getImageData(isImageAd ? ad.media : null),
    [isImageAd, ad.media]
  );

  const partner = typeof ad.partner === "string" ? null : ad.partner;
  const partnerLogo = useMemo(
    () => getImageData(partner?.logo),
    [partner?.logo]
  );

  return (
    <View
      className="h-full gap-9 bg-white py-2"
      onTouchEnd={onAdClick}
      style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
    >
      {/* ── Media ─────────────────────────────────────────────────────────── */}
      <View className="items-center justify-center gap-2 px-5">
        <Text>Advertisement</Text>

        {isUploadedVideoAd ? (
          <View
            className="relative mx-2 w-full"
            style={{ height: (width / 16) * 9 }}
          >
            <VideoView
              aria-label="Video advertisement"
              nativeControls={false}
              player={player}
              style={{ minHeight: "100%", width: "100%" }}
            />
            <View className="absolute inset-0 flex-row items-end justify-start bg-transparent">
              <Button
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="rounded-none bg-black/50"
                onPress={togglePlaying}
                size="sm"
              >
                {isPlaying ? (
                  <PauseIcon color="white" size={18} />
                ) : (
                  <PlayIcon color="white" size={18} />
                )}
              </Button>
              <Button
                aria-label={muted ? "Unmute video" : "Mute video"}
                className="rounded-none bg-black/50"
                onPress={() => {
                  player.muted = !muted;
                }}
                size="sm"
              >
                {muted ? (
                  <SpeakerHighIcon color="white" size={18} />
                ) : (
                  <SpeakerSlashIcon color="white" size={18} />
                )}
              </Button>
            </View>
          </View>
        ) : isYouTubeAd ? (
          <YoutubePlayer
            aria-label="YouTube video advertisement"
            height={(width / 16) * 9}
            onChangeState={onYtStateChange}
            play={ytPlaying}
            videoId={videoId ?? ""}
          />
        ) : (
          <Image
            aria-label="Advertisement banner"
            className="w-full"
            contentFit="contain"
            placeholder={{ blurhash }}
            source={imageUrl}
            style={{ height: height * 0.3 }}
          />
        )}

        {showAdLabel ? (
          <Text className="self-start border border-black px-1">Ad</Text>
        ) : null}
      </View>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <View className="items-center justify-center">
        <Image
          aria-label="Partner logo"
          className="size-30"
          contentFit="contain"
          placeholder={{ blurhash: partnerLogo?.blurhash }}
          source={{ uri: partnerLogo?.url ?? undefined }}
        />
        <Text className="text-center font-bold text-lg">{ad.title}</Text>
        <Text className="max-w-87.5 text-center text-base">{ad.condition}</Text>
        <Button
          className="mt-5 min-w-30 gap-2 rounded-full"
          onPress={onAdClick}
        >
          <Button.Label>{getCtaLabel(ad.cta)}</Button.Label>
          <CaretRightIcon color="white" size={18} weight="bold" />
        </Button>
      </View>
    </View>
  );
}
