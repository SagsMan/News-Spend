import type { PromoVideoSource } from "@news-spend-media/payload/types";
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useImperativeHandle, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import YoutubePlayer, { PLAYER_STATES } from "react-native-youtube-iframe";

function extractYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : "";
}

const YoutubePromoPlayer = ({
  item,
  ref,
}: {
  item: PromoVideoSource;
  ref: React.Ref<{
    play: () => void;
    pause: () => void;
    isPlaying: () => boolean;
  }>;
}) => {
  const videoId = extractYouTubeId(item.url || "");
  const [playing, setPlaying] = useState(false);
  const { width } = useWindowDimensions();
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) {
      setPlaying(false);
    }
  }, [focused]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => setPlaying(true),
      pause: () => {
        // console.log("pausing");
        setPlaying(false);
      },
      isPlaying: () => playing,
    }),
    [playing]
  );

  const onStateChange = useCallback((state: PLAYER_STATES) => {
    switch (state) {
      case PLAYER_STATES.ENDED:
        setPlaying(false);
        break;
      case PLAYER_STATES.PLAYING:
        setPlaying(true);
        break;
      case PLAYER_STATES.PAUSED:
        setPlaying(false);
        break;
      // case PLAYER_STATES.UNSTARTED:
      //   setPlaying(false);
      //   break;
      // case PLAYER_STATES.BUFFERING:
      //   setPlaying(false);
      //   break;
      default:
        // Do nothing for other states
        break;
    }
  }, []);

  return (
    <View className="w-full overflow-hidden">
      <YoutubePlayer
        className="size-full"
        height={200}
        onChangeState={onStateChange}
        play={playing}
        videoId={videoId}
        width={width * 0.85}
      />
    </View>
  );
};

export default YoutubePromoPlayer;
