// biome-ignore lint/style/useFilenamingConvention: PascalCase matches the convention of this directory

import { useEvent } from "expo";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, type VideoThumbnail, VideoView } from "expo-video";
import {
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerXIcon,
} from "#/lib/icons";
import {
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ViewStyle } from "react-native";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export type { VideoSource } from "expo-video";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import type { VideoSource } from "expo-video";

export type VideoProps = {
  ref?: Ref<VideoRef>;
  source: VideoSource;
  style?: ViewStyle;
  /** Seconds to seek by on double-tap (default: 2) */
  seekBy?: number;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  allowsFullscreen?: boolean;
  allowsPictureInPicture?: boolean;
  contentFit?: "contain" | "cover" | "fill";
  onLoad?: () => void;
  onError?: (error: unknown) => void;
  onPlaybackStatusUpdate?: (status: {
    currentTime: number;
    duration: number;
    isPlaying: boolean;
  }) => void;
  onFullscreenUpdate?: (isFullscreen: boolean) => void;
  subtitles?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
};

export type VideoRef = {
  // Playback
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  // State accessors
  getCurrentTime: () => number;
  getDuration: () => number;
  isPlaying: () => boolean;
  isMuted: () => boolean;
  // VideoView actions (proxied from the underlying VideoView)
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  startPictureInPicture: () => Promise<void>;
  stopPictureInPicture: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const borderRadius = 10;

const formatTime = (seconds: number): string => {
  if (Number.isNaN(seconds) || seconds < 0) {
    return "0:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// ReanimatedProgress
// ---------------------------------------------------------------------------

const progressHeight = 8;
const thumbSize = 16;

type ReanimatedProgressProps = {
  duration: number;
  currentTime: number;
  onSeek: (progress: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
};

const ReanimatedProgress = ({
  duration,
  currentTime,
  onSeek,
  onSeekStart,
  onSeekEnd,
}: ReanimatedProgressProps) => {
  const [barWidth, setBarWidth] = useState(0);
  const isScrubbing = useSharedValue(false);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  // Sync playhead when not actively scrubbing
  useDerivedValue(() => {
    if (!isScrubbing.value && duration > 0 && barWidth > 0) {
      translateX.value = withTiming((currentTime / duration) * barWidth, {
        duration: 100,
      });
    }
  });

  const panGesture = Gesture.Pan()
    .minDistance(1)
    .onBegin(() => {
      isScrubbing.value = true;
      scale.value = withTiming(1.2);
      if (onSeekStart) {
        scheduleOnRN(onSeekStart);
      }
    })
    .onChange((event) => {
      translateX.value = Math.max(
        0,
        Math.min(barWidth, translateX.value + event.changeX)
      );
    })
    .onEnd(() => {
      const finalProgress = translateX.value / barWidth;
      scheduleOnRN(onSeek, finalProgress);
      isScrubbing.value = false;
      scale.value = withTiming(1);
      if (onSeekEnd) {
        scheduleOnRN(onSeekEnd);
      }
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      if (onSeekStart) {
        scheduleOnRN(onSeekStart);
      }
    })
    .onEnd((event) => {
      const newX = Math.max(0, Math.min(barWidth, event.x));
      translateX.value = newX;
      scheduleOnRN(onSeek, newX / barWidth);
      if (onSeekEnd) {
        scheduleOnRN(onSeekEnd);
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: translateX.value,
  }));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        onLayout={(e) => {
          setBarWidth(e.nativeEvent.layout.width);
        }}
        style={progressStyles.container}
      >
        <View style={progressStyles.track} />
        <Animated.View
          style={[progressStyles.progress, animatedProgressStyle]}
        />
        <Animated.View
          style={[progressStyles.thumbContainer, animatedThumbStyle]}
        >
          <View style={progressStyles.thumb} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

// ---------------------------------------------------------------------------
// TapArea: thin RNGH-native tap zone, safe inside GestureHandlerRootView
// ---------------------------------------------------------------------------

type TapAreaProps = {
  gesture: GestureType;
  style: ViewStyle;
};

const TapArea = ({ gesture, style }: TapAreaProps) => (
  <GestureDetector gesture={gesture}>
    <Animated.View style={style} />
  </GestureDetector>
);

// ---------------------------------------------------------------------------
// Extracted hooks: keep main component complexity under the limit
// ---------------------------------------------------------------------------

type UsePlaybackSyncOptions = {
  player: ReturnType<typeof useVideoPlayer>;
  isSeeking: boolean;
  loop: boolean;
  subtitles: NonNullable<VideoProps["subtitles"]>;
  onPlaybackStatusUpdate: VideoProps["onPlaybackStatusUpdate"];
};

const usePlaybackSync = ({
  player,
  isSeeking,
  loop,
  subtitles,
  onPlaybackStatusUpdate,
}: UsePlaybackSyncOptions) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [isVideoEnded, setIsVideoEnded] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!player || isSeeking) {
        return;
      }
      try {
        const time = player.currentTime ?? 0;
        const dur = player.duration ?? 0;
        setCurrentTime(time);
        if (dur > 0) {
          setDuration(dur);
        }
        if (dur > 0 && time >= dur - 0.25 && !loop) {
          setIsVideoEnded(true);
        } else {
          setIsVideoEnded(false);
        }
        const activeSub = subtitles.find(
          (s) => time >= s.start && time <= s.end
        );
        setCurrentSubtitle(activeSub?.text ?? "");
        onPlaybackStatusUpdate?.({
          currentTime: time,
          duration: dur,
          isPlaying: player.playing,
        });
      } catch {}
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [player, subtitles, onPlaybackStatusUpdate, loop, isSeeking]);

  return {
    currentTime,
    setCurrentTime,
    duration,
    currentSubtitle,
    isVideoEnded,
    setIsVideoEnded,
  };
};

type UseControlVisibilityOptions = {
  isPlaying: boolean;
};

const useControlVisibility = ({ isPlaying }: UseControlVisibilityOptions) => {
  const [showCustomControls, setShowCustomControls] = useState(true);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const controlsOpacity = useSharedValue(1);
  // Play icon starts fully visible (paused on mount)
  const playIconOpacity = useSharedValue(1);

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const playIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: playIconOpacity.value,
  }));

  const hideControls = useCallback(() => {
    controlsOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        scheduleOnRN(setShowCustomControls, false);
      }
    });
  }, [controlsOpacity]);

  const showControls = useCallback(() => {
    setShowCustomControls(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(hideControls, 3000);
    }
  }, [controlsOpacity, isPlaying, hideControls]);

  // Single source of truth: drive both controls and play icon from isPlaying
  useEffect(() => {
    if (isPlaying) {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      hideControlsTimeout.current = setTimeout(hideControls, 3000);
      // Hide the center play icon when playing starts
      playIconOpacity.value = withTiming(0, { duration: 200 });
    } else {
      // Paused: cancel any pending hide, restore controls and play icon
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
        hideControlsTimeout.current = null;
      }
      setShowCustomControls(true);
      controlsOpacity.value = withTiming(1, { duration: 200 });
      playIconOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isPlaying, controlsOpacity, playIconOpacity, hideControls]);

  const showPlayIconAnimation = useCallback(() => {
    // Brief flash: just pulse opacity up; isPlaying effect will hide it when needed
    playIconOpacity.value = withTiming(1, { duration: 150 });
  }, [playIconOpacity]);

  useEffect(
    () => () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    },
    []
  );

  return {
    showCustomControls,
    controlsAnimatedStyle,
    playIconAnimatedStyle,
    showControls,
    showPlayIconAnimation,
    hideControlsTimeout,
    hideControls,
  };
};

// ---------------------------------------------------------------------------
// Video Component
// ---------------------------------------------------------------------------

export const Video = ({
  ref,
  source,
  style,
  autoPlay = false,
  loop = false,
  muted = false,
  allowsFullscreen = true,
  allowsPictureInPicture = true,
  contentFit = "cover",
  onLoad,
  onError,
  seekBy = 2,
  onPlaybackStatusUpdate,
  onFullscreenUpdate,
  subtitles = [],
}: VideoProps) => {
  const textColor = "#ffffff";
  const cardColor = "#ffffff";
  const mutedColor = "#003964";

  const videoViewRef = useRef<VideoView>(null);
  const [isMuted, setIsMuted] = useState(muted);
  const [isSeeking, setIsSeeking] = useState(false);
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  // Stays true forever once the user has played at least once. Ref so it
  // never triggers a re-render on its own.
  const hasPlayedOnce = useRef(false);

  const player = useVideoPlayer(source, (p) => {
    try {
      if (autoPlay) {
        p.play();
      }
      p.loop = loop;
      p.muted = muted;
      onLoad?.();
    } catch (err) {
      console.error("Video player initialization error:", err);
      onError?.(err);
    }
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player?.playing ?? false,
  });

  // Dismiss the poster the first time playback starts
  if (isPlaying && !hasPlayedOnce.current) {
    hasPlayedOnce.current = true;
  }

  // Generate a first-frame thumbnail to use as a poster image
  const { status } = useEvent(player, "statusChange", {
    status: player?.status ?? "idle",
  });
  useEffect(() => {
    if (status !== "readyToPlay") {
      return;
    }
    player
      .generateThumbnailsAsync(0, { maxWidth: 640 })
      .then((thumbnails) => {
        if (thumbnails.length > 0) {
          setThumbnail(thumbnails[0] ?? null);
        }
      })
      .catch(() => {});
  }, [status, player]);

  const {
    currentTime,
    setCurrentTime,
    duration,
    currentSubtitle,
    isVideoEnded,
    setIsVideoEnded,
  } = usePlaybackSync({
    player,
    isSeeking,
    loop,
    subtitles,
    onPlaybackStatusUpdate,
  });

  const {
    showCustomControls,
    controlsAnimatedStyle,
    playIconAnimatedStyle,
    showControls,
    showPlayIconAnimation,
    hideControlsTimeout,
    hideControls,
  } = useControlVisibility({ isPlaying });

  // -------------------------------------------------------------------------
  // Gesture handlers
  // -------------------------------------------------------------------------

  const handleSingleTap = useCallback(() => {
    if (!player) {
      return;
    }
    if (isVideoEnded) {
      player.currentTime = 0;
      player.play();
      setIsVideoEnded(false);
    } else if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    showPlayIconAnimation();
    showControls();
  }, [
    player,
    isVideoEnded,
    setIsVideoEnded,
    showControls,
    showPlayIconAnimation,
  ]);

  const handleLeftDoubleTap = useCallback(() => {
    if (player) {
      player.seekBy(-seekBy);
      showControls();
    }
  }, [player, showControls, seekBy]);

  const handleRightDoubleTap = useCallback(() => {
    if (player) {
      player.seekBy(seekBy);
      showControls();
    }
  }, [player, showControls, seekBy]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    player.muted = next;
  }, [isMuted, player]);

  const handleProgressChange = useCallback(
    (progress: number) => {
      if (!(player && duration) || duration <= 0) {
        return;
      }
      const newTime = progress * duration;
      setCurrentTime(newTime);
      player.currentTime = newTime;
      if (isVideoEnded) {
        setIsVideoEnded(false);
      }
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
      hideControlsTimeout.current = setTimeout(hideControls, 3000);
    },
    [
      player,
      duration,
      isVideoEnded,
      setCurrentTime,
      setIsVideoEnded,
      hideControls,
      hideControlsTimeout,
    ]
  );

  const handleSeekStart = useCallback(() => {
    setIsSeeking(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
  }, [hideControlsTimeout]);

  const handleSeekEnd = useCallback(() => {
    setIsSeeking(false);
  }, []);

  // -------------------------------------------------------------------------
  // Imperative handle
  // -------------------------------------------------------------------------

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        try {
          player.play();
        } catch {}
      },
      pause: () => {
        try {
          player.pause();
        } catch {}
      },
      seekTo: (seconds: number) => {
        try {
          player.currentTime = seconds;
        } catch {}
      },
      mute: () => {
        setIsMuted(true);
      },
      unmute: () => {
        setIsMuted(false);
      },
      setVolume: (volume: number) => {
        try {
          player.volume = volume;
        } catch {}
      },
      getCurrentTime: () => {
        try {
          return player.currentTime ?? 0;
        } catch {
          return 0;
        }
      },
      getDuration: () => {
        try {
          return player.duration ?? 0;
        } catch {
          return 0;
        }
      },
      isPlaying: () => {
        try {
          return player.playing;
        } catch {
          return false;
        }
      },
      isMuted: () => isMuted,
      enterFullscreen: async () => {
        await videoViewRef.current?.enterFullscreen();
      },
      exitFullscreen: async () => {
        await videoViewRef.current?.exitFullscreen();
      },
      startPictureInPicture: async () => {
        await videoViewRef.current?.startPictureInPicture();
      },
      stopPictureInPicture: async () => {
        await videoViewRef.current?.stopPictureInPicture();
      },
    }),
    [player, isMuted]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <GestureHandlerRootView
      style={[styles.container, { backgroundColor: cardColor }, style]}
    >
      <VideoView
        allowsPictureInPicture={allowsPictureInPicture}
        contentFit={contentFit}
        fullscreenOptions={{ enable: allowsFullscreen }}
        nativeControls={false}
        onFullscreenEnter={() => {
          onFullscreenUpdate?.(true);
        }}
        onFullscreenExit={() => {
          onFullscreenUpdate?.(false);
        }}
        player={player}
        ref={videoViewRef}
        style={styles.video}
      />

      {/* Poster thumbnail, shown until the user plays for the first time */}
      {Boolean(thumbnail && !hasPlayedOnce.current) && (
        <View pointerEvents="none" style={styles.thumbnailOverlay}>
          <ExpoImage
            contentFit={contentFit}
            source={thumbnail}
            style={styles.fill}
          />
        </View>
      )}

      {/* Tap gesture areas: left: seek back, center: play/pause, right: seek forward */}
      <View pointerEvents="box-none" style={styles.gestureOverlay}>
        <TapArea
          gesture={Gesture.Tap().onEnd(() => scheduleOnRN(handleLeftDoubleTap))}
          style={styles.gestureArea}
        />
        <TapArea
          gesture={Gesture.Tap().onEnd(() => scheduleOnRN(handleSingleTap))}
          style={styles.gestureAreaCenter}
        />
        <TapArea
          gesture={Gesture.Tap().onEnd(() =>
            scheduleOnRN(handleRightDoubleTap)
          )}
          style={styles.gestureArea}
        />
      </View>

      {/* Centered play/pause icon: always mounted, opacity driven by isPlaying */}
      <Animated.View
        pointerEvents="none"
        style={[styles.centerPlayIcon, playIconAnimatedStyle]}
      >
        <View style={styles.centerPlayIconBackground}>
          {isPlaying ? (
            <PauseIcon color="#ffffff" size={36} weight="fill" />
          ) : (
            <PlayIcon color="#ffffff" size={36} weight="fill" />
          )}
        </View>
      </Animated.View>

      {/* Subtitles */}
      {Boolean(currentSubtitle) && (
        <View pointerEvents="none" style={styles.subtitleContainer}>
          <Text style={[styles.subtitleText, { color: textColor }]}>
            {currentSubtitle}
          </Text>
        </View>
      )}

      {/* Custom controls overlay */}
      {Boolean(showCustomControls) && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.controlsContainer, controlsAnimatedStyle]}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent"]}
            style={styles.topControls}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleMute}
              style={styles.controlButton}
            >
              {isMuted ? (
                <SpeakerXIcon color={textColor} size={24} weight="bold" />
              ) : (
                <SpeakerHighIcon color={textColor} size={24} weight="bold" />
              )}
            </TouchableOpacity>
          </LinearGradient>

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.5)"]}
            style={styles.bottomControls}
          >
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, { color: mutedColor }]}>
                {formatTime(currentTime)}
              </Text>
              <Text style={[styles.timeText, { color: mutedColor }]}>
                {formatTime(duration)}
              </Text>
            </View>

            <ReanimatedProgress
              currentTime={currentTime}
              duration={duration}
              onSeek={handleProgressChange}
              onSeekEnd={handleSeekEnd}
              onSeekStart={handleSeekStart}
            />
          </LinearGradient>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
};

Video.displayName = "Video";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  bottomControls: {
    gap: 6,
    padding: 16,
    paddingBottom: 6,
  },
  centerPlayIcon: {
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 100,
  },
  centerPlayIconBackground: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    width: 80,
  },
  container: {
    borderRadius,
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  controlsContainer: {
    bottom: 0,
    justifyContent: "space-between",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  fill: {
    height: "100%",
    width: "100%",
  },
  gestureArea: {
    backgroundColor: "transparent",
    flex: 1,
  },
  gestureAreaCenter: {
    backgroundColor: "transparent",
    flex: 2,
  },
  gestureOverlay: {
    bottom: 0,
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  subtitleContainer: {
    alignItems: "center",
    bottom: 80,
    left: 20,
    position: "absolute",
    right: 20,
  },
  subtitleText: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 6,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
  },
  thumbnailOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 16,
  },
  video: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
});

const progressStyles = StyleSheet.create({
  container: {
    height: thumbSize * 2,
    justifyContent: "center",
  },
  progress: {
    backgroundColor: "#FFFFFF",
    borderRadius: progressHeight / 2,
    height: progressHeight,
    position: "absolute",
  },
  thumb: {
    backgroundColor: "#FFFFFF",
    borderRadius: thumbSize / 2,
    height: thumbSize,
    width: thumbSize,
  },
  thumbContainer: {
    left: -(thumbSize / 2),
    position: "absolute",
    top: (thumbSize * 2 - thumbSize) / 2,
  },
  track: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: progressHeight / 2,
    height: progressHeight,
  },
});
