// biome-ignore lint/style/useFilenamingConvention: PascalCase matches existing convention in this directory
import type { PromoVideoSource } from "@news-spend-media/payload/types";
import { useIsFocused } from "@react-navigation/native";
import type { VideoSource } from "expo-video";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

import { Image, Video, type VideoRef } from "#/components/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PromoVideoMethods = {
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  prepareVideo?: () => void;
};

type PromoVideoProps = {
  item: PromoVideoSource;
  onLoad?: () => void;
  autoPlay?: boolean;
  posterSource?: { uri: string; width: number; height: number } | null;
  ref?: Ref<PromoVideoMethods>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PromoVideo = ({
  item,
  onLoad,
  autoPlay = false,
  posterSource,
  ref,
}: PromoVideoProps) => {
  const videoRef = useRef<VideoRef>(null);
  const focused = useIsFocused();
  const [videoKey, setVideoKey] = useState(0);
  const savedPosition = useRef(0);
  const wasPlaying = useRef(false);
  const [effectiveAutoPlay, setEffectiveAutoPlay] = useState(autoPlay);

  const videoSource = useMemo<VideoSource>(
    () => ({ uri: item.url ?? undefined }),
    [item.url]
  );

  useEffect(() => {
    if (focused) {
      setVideoKey((k) => k + 1);
      setEffectiveAutoPlay(wasPlaying.current);
    }
  }, [focused]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        try {
          videoRef.current?.play();
        } catch {}
      },
      pause: () => {
        try {
          videoRef.current?.pause();
        } catch {}
      },
      isPlaying: () => {
        try {
          return videoRef.current?.isPlaying() ?? false;
        } catch {
          return false;
        }
      },

      prepareVideo: () => {
        videoRef.current?.play();
      },
    }),
    []
  );

  return (
    <View className="relative h-full w-full">
      {focused && (
        <Video
          allowsPictureInPicture={false}
          autoPlay={effectiveAutoPlay}
          contentFit="cover"
          key={videoKey}
          loop
          onLoad={onLoad}
          onPlaybackStatusUpdate={(status) => {
            savedPosition.current = status.currentTime;
            wasPlaying.current = status.isPlaying;
          }}
          ref={videoRef}
          source={videoSource}
          style={{ width: "100%", height: "100%", borderRadius: 10 }}
        />
      )}
      {!(autoPlay && focused) && posterSource && (
        <Image
          source={posterSource}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            borderRadius: 10,
          }}
        />
      )}
    </View>
  );
};

PromoVideo.displayName = "PromoVideo";

export default PromoVideo;
