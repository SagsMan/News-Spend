/**
 * ProgressBar: custom component for HeroUI Native
 *
 * Follows HeroUI Native conventions:
 *  - Compound component pattern  (ProgressBar.Root / ProgressBar.Track / ProgressBar.Fill / ProgressBar.Label)
 *  - className via Tailwind / Uniwind
 *  - Semantic color tokens: bg-accent, bg-default, bg-success, bg-warning, bg-danger
 *  - Smooth width animation via react-native-reanimated
 *  - Indeterminate mode (shimmer sweep)
 *  - Accessible: accessibilityRole, accessibilityValue
 *
 * Usage
 * ─────
 * // Basic
 * <ProgressBar value={60} />
 *
 * // With label
 * <ProgressBar value={75} color="success">
 *   <ProgressBar.Label>Uploading…</ProgressBar.Label>
 * </ProgressBar>
 *
 * // Indeterminate
 * <ProgressBar indeterminate />
 *
 * // Fully composed (custom track / fill)
 * <ProgressBar value={40}>
 *   <ProgressBar.Label>Progress</ProgressBar.Label>
 *   <ProgressBar.Track className="h-2 bg-default rounded-full">
 *     <ProgressBar.Fill className="bg-accent rounded-full" />
 *   </ProgressBar.Track>
 * </ProgressBar>
 */

import { cn } from "heroui-native/utils"; // re-exports clsx + twMerge
import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Text, type TextStyle, View, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// ─── Types ───────────────────────────────────────────────────────────────────

type ColorVariant = "accent" | "success" | "warning" | "danger" | "default";
type SizeVariant = "sm" | "md" | "lg";

type ProgressBarContextValue = {
  color: ColorVariant;
  indeterminate: boolean;
  setTrackWidth: (w: number) => void;
  size: SizeVariant;
  trackWidth: number;
  value: number; // 0–100
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ProgressBarContext = createContext<ProgressBarContextValue>({
  value: 0,
  indeterminate: false,
  color: "accent",
  size: "md",
  trackWidth: 0,
  setTrackWidth: () => {},
});

const useProgressBar = () => useContext(ProgressBarContext);

// ─── Color token map (Tailwind / Uniwind classes) ─────────────────────────────

const fillColorMap: Record<ColorVariant, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  default: "bg-default-foreground",
};

const trackColorMap: Record<ColorVariant, string> = {
  accent: "bg-accent/20",
  success: "bg-success/20",
  warning: "bg-warning/20",
  danger: "bg-danger/20",
  default: "bg-default",
};

const sizeMap: Record<SizeVariant, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type LabelProps = {
  children: ReactNode;
  className?: string;
  style?: TextStyle;
};

function Label({ children, className, style }: LabelProps) {
  return (
    <Text
      className={cn("mb-1.5 text-foreground text-sm", className)}
      style={style}
    >
      {children}
    </Text>
  );
}

type TrackProps = {
  children?: ReactNode;
  className?: string;
  style?: ViewStyle;
};

function Track({ children, className, style }: TrackProps) {
  const { color, size, setTrackWidth } = useProgressBar();

  return (
    <View
      className={cn(
        "w-full overflow-hidden rounded-full",
        trackColorMap[color],
        sizeMap[size],
        className
      )}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={style}
    >
      {children ?? <Fill />}
    </View>
  );
}

type FillProps = {
  className?: string;
  style?: ViewStyle;
};

function Fill({ className, style }: FillProps) {
  const { value, indeterminate, color, trackWidth } = useProgressBar();

  // ── Determinate animation ─────────────────────────────────────────────────
  const widthPct = useSharedValue(0);

  useEffect(() => {
    if (!indeterminate) {
      widthPct.value = withTiming(Math.min(Math.max(value, 0), 100), {
        duration: 400,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [value, indeterminate, widthPct]);

  const determinateStyle = useAnimatedStyle(() => ({
    width: `${widthPct.value}%`,
  }));

  // ── Indeterminate sweep ───────────────────────────────────────────────────
  // The fill bar is 40% of the track. It starts fully hidden to the left
  // (translateX = -fillWidth) and sweeps until fully hidden to the right
  // (translateX = trackWidth). withRepeat replays from the beginning each
  // time, so there is never an instant jump; the bar always re-enters
  // smoothly from the left.
  const FILL_RATIO = 0.4;
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (!indeterminate || trackWidth === 0) {
      return;
    }

    const fillWidth = trackWidth * FILL_RATIO;
    const startX = -fillWidth; // bar fully off-screen left
    const endX = trackWidth; // bar fully off-screen right

    // Jump to start without animation, then begin the sweep
    translateX.value = startX;
    translateX.value = withRepeat(
      withTiming(endX, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // loop forever
      false // don't reverse; always sweeps left → right
    );

    return () => cancelAnimation(translateX);
  }, [indeterminate, trackWidth, translateX]);

  const indeterminateStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (indeterminate) {
    return (
      <Animated.View
        className={cn(
          "absolute top-0 bottom-0 rounded-full",
          fillColorMap[color],
          className
        )}
        style={[
          {
            width: trackWidth > 0 ? trackWidth * FILL_RATIO : "40%",
            left: 0,
          },
          indeterminateStyle,
          style,
        ]}
      />
    );
  }

  return (
    <Animated.View
      className={cn("h-full rounded-full", fillColorMap[color], className)}
      style={[determinateStyle, style]}
    />
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type ProgressBarRootProps = {
  /** Optional label text or ProgressBar.Label / ProgressBar.Track children */
  children?: ReactNode;
  className?: string;
  /** Color variant: maps to HeroUI Native semantic tokens */
  color?: ColorVariant;
  /** Show an animated indeterminate state (looping) */
  indeterminate?: boolean;
  /** Track height */
  size?: SizeVariant;
  style?: ViewStyle;
  /** Current progress value (0–100). Ignored when `indeterminate` is true. */
  value?: number;
};

function Root({
  value = 0,
  indeterminate = false,
  color = "accent",
  size = "md",
  children,
  className,
  style,
}: ProgressBarRootProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const [trackWidth, setTrackWidth] = useState(0);

  const context: ProgressBarContextValue = {
    value: clampedValue,
    indeterminate,
    color,
    size,
    trackWidth,
    setTrackWidth,
  };

  const hasCustomChildren = React.Children.count(children) > 0;

  return (
    <ProgressBarContext.Provider value={context}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={
          indeterminate ? undefined : { min: 0, max: 100, now: clampedValue }
        }
        accessible
        className={cn("w-full", className)}
        style={style}
      >
        {hasCustomChildren ? children : <Track />}
      </View>
    </ProgressBarContext.Provider>
  );
}

// ─── Namespace export (compound component) ────────────────────────────────────

export const ProgressBar = Object.assign(Root, {
  Label,
  Track,
  Fill,
});

export type {
  ColorVariant as ProgressBarColor,
  FillProps,
  LabelProps,
  ProgressBarRootProps,
  SizeVariant as ProgressBarSize,
  TrackProps,
};
