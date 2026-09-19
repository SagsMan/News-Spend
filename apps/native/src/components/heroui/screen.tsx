import { useScrollToTop } from "@react-navigation/native";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar, type StatusBarStyle } from "expo-status-bar";
import { cn } from "heroui-native/utils";
import { type ReactNode, useCallback, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useUniwind } from "uniwind";
import {
  type ExtendedEdge,
  useSafeAreaInsetsStyle,
} from "#/utils/useSafeAreaInsetsStyle";

export const DEFAULT_BOTTOM_OFFSET = 50;

type BaseScreenProps = {
  /**
   * Children components.
   */
  children?: ReactNode;
  className?: string;
  screenClassName?: string;
  contentContainerClassName?: string;

  /**
   * Style for the outer content container useful for padding & margin.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Style for the inner content container useful for padding & margin.
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Override the default edges for the safe area.
   */
  safeAreaEdges?: ExtendedEdge[];
  /**
   * Background color, applied to the root screen container.
   */
  backgroundColor?: string;
  /**
   * Status bar appearance. Defaults to auto (light in dark mode, dark in light mode).
   */
  statusBarStyle?: StatusBarStyle;
  /**
   * By how much should we offset the keyboard? Defaults to 0.
   * Only applies to fixed preset with KeyboardAvoidingView.
   */
  keyboardOffset?: number;
  /**
   * By how much we scroll up when the keyboard is shown. Defaults to 50.
   * Only applies to scroll/auto presets via KeyboardAwareScrollView.
   */
  keyboardBottomOffset?: number;
  /**
   * Disable KeyboardAvoidingView behavior. Defaults to false.
   * Only relevant for fixed preset.
   */
  disableKeyboardAvoidingView?: boolean;
  /**
   * Disable KeyboardAwareScrollView behavior. Defaults to false.
   * When true, falls back to a standard React Native ScrollView.
   */
  disableKeyboardAwareScrollView?: boolean;
  /**
   * Android navigation bar button appearance ("light" = white icons, "dark" = black icons).
   * Ignored on iOS. Defaults to the status bar style.
   */
  navigationBarButtonStyle?: "light" | "dark";
  /**
   * Pass any additional props directly to the KeyboardAvoidingView component.
   */
  KeyboardAvoidingViewProps?: KeyboardAvoidingViewProps;
};

interface FixedScreenProps extends BaseScreenProps {
  preset?: "fixed";
}

interface ScrollScreenProps extends BaseScreenProps {
  /**
   * Should keyboard persist on screen tap. Defaults to "handled".
   * Only applies to scroll preset.
   */
  keyboardShouldPersistTaps?: "handled" | "always" | "never";
  preset?: "scroll";
  /**
   * Pass any additional props directly to the ScrollView component.
   */
  ScrollViewProps?: ScrollViewProps;
}

interface AutoScreenProps extends Omit<ScrollScreenProps, "preset"> {
  preset?: "auto";
  /**
   * Threshold to trigger the automatic disabling/enabling of scroll ability.
   * Defaults to `{ percent: 0.92 }`.
   */
  scrollEnabledToggleThreshold?: { percent?: number; point?: number };
}

export type ScreenProps =
  | ScrollScreenProps
  | FixedScreenProps
  | AutoScreenProps;

const isIos = Platform.OS === "ios";

type ScreenPreset = "fixed" | "scroll" | "auto";

function isNonScrolling(preset?: ScreenPreset) {
  return !preset || preset === "fixed";
}

/**
 * Handles automatic enabling/disabling of scroll based on content vs. screen size.
 * Fixed: does NOT call updateScrollState during render (was an anti-pattern).
 * Uses useCallback to keep handler references stable across renders.
 */
function useAutoPreset(props: AutoScreenProps): {
  scrollEnabled: boolean;
  onContentSizeChange: (w: number, h: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
} {
  const { preset, scrollEnabledToggleThreshold } = props;
  const { percent = 0.92, point = 0 } = scrollEnabledToggleThreshold || {};

  const scrollViewHeight = useRef<number | null>(null);
  const scrollViewContentHeight = useRef<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const updateScrollState = useCallback(() => {
    const vh = scrollViewHeight.current;
    const ch = scrollViewContentHeight.current;
    if (vh === null || ch === null) {
      return;
    }

    const contentFitsScreen = point ? ch < vh - point : ch < vh * percent;

    setScrollEnabled((prev) => {
      // Avoid unnecessary re-renders by only updating when state actually changes
      if (prev && contentFitsScreen) {
        return false;
      }
      if (!(prev || contentFitsScreen)) {
        return true;
      }
      return prev;
    });
  }, [percent, point]);

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      scrollViewContentHeight.current = h;
      updateScrollState();
    },
    [updateScrollState]
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      scrollViewHeight.current = e.nativeEvent.layout.height;
      updateScrollState();
    },
    [updateScrollState]
  );

  return {
    // For non-auto presets, always enable scrolling without hooking into state
    scrollEnabled: preset === "auto" ? scrollEnabled : true,
    onContentSizeChange,
    onLayout,
  };
}

function ScreenWithoutScrolling(props: ScreenProps) {
  const {
    style,
    contentContainerStyle,
    contentContainerClassName,
    children,
    preset,
    className,
  } = props;

  return (
    <View className={cn("h-full w-full flex-1", className)} style={style}>
      <View
        className={cn(
          "flex-1 items-stretch justify-start",
          preset === "fixed" && "justify-end",
          contentContainerClassName
        )}
        style={contentContainerStyle}
      >
        {children}
      </View>
    </View>
  );
}

function ScreenWithScrolling(props: ScreenProps) {
  const {
    children,
    keyboardShouldPersistTaps = "handled",
    keyboardBottomOffset = DEFAULT_BOTTOM_OFFSET,
    contentContainerStyle,
    className,
    contentContainerClassName,
    ScrollViewProps,
    style,
    disableKeyboardAwareScrollView = false,
  } = props as ScrollScreenProps;

  const ref = useRef<KeyboardAwareScrollViewRef>(null);

  const { scrollEnabled, onContentSizeChange, onLayout } = useAutoPreset(
    props as AutoScreenProps
  );

  // Scroll to top when the active tab is tapped again (React Navigation behavior)
  useScrollToTop(ref);

  const scrollViewClassName = cn("h-full w-full flex-1", className);
  const scrollViewContentClassName = cn(
    "items-stretch justify-start",
    contentContainerClassName
  );
  const scrollViewContentStyle = [
    ScrollViewProps?.contentContainerStyle,
    contentContainerStyle,
  ];
  const scrollViewStyle = [ScrollViewProps?.style, style];

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      onContentSizeChange(w, h);
      ScrollViewProps?.onContentSizeChange?.(w, h);
    },
    [onContentSizeChange, ScrollViewProps]
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout(e);
      ScrollViewProps?.onLayout?.(e);
    },
    [onLayout, ScrollViewProps]
  );

  // When keyboard-aware behavior is disabled, fall back to a plain ScrollView
  // to avoid mounting the heavier KeyboardAwareScrollView unnecessarily.
  // Note: `enabled={false}` on KeyboardAwareScrollView still mounts the full component.
  if (disableKeyboardAwareScrollView) {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        scrollEnabled={scrollEnabled}
        {...ScrollViewProps}
        className={scrollViewClassName}
        contentContainerClassName={scrollViewContentClassName}
        contentContainerStyle={scrollViewContentStyle}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        ref={ref as React.RefObject<ScrollView>}
        style={scrollViewStyle}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      bottomOffset={keyboardBottomOffset}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      ref={ref}
      scrollEnabled={scrollEnabled}
      {...ScrollViewProps}
      className={scrollViewClassName}
      contentContainerClassName={scrollViewContentClassName}
      contentContainerStyle={scrollViewContentStyle}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      style={scrollViewStyle}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

/**
 * Represents a screen component that provides a consistent layout and behaviour for different screen presets.
 *
 * Presets:
 * - `fixed`: non-scrolling, uses KeyboardAvoidingView when needed.
 * - `scroll`: always scrollable, uses KeyboardAwareScrollView (or plain ScrollView as fallback).
 * - `auto`: scrollable only when content overflows the screen.
 *
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/app/components/Screen/}
 */
export function Screen(props: ScreenProps) {
  const {
    KeyboardAvoidingViewProps,
    keyboardOffset = 0,
    safeAreaEdges,
    navigationBarButtonStyle,
    statusBarStyle,
    screenClassName,
    backgroundColor,
    disableKeyboardAvoidingView = false,
  } = props;

  const { theme } = useUniwind();
  const $containerInsets = useSafeAreaInsetsStyle(safeAreaEdges);

  const barStyle = statusBarStyle ?? (theme === "dark" ? "light" : "dark");

  // KeyboardAvoidingView is only needed for non-scrolling (fixed) screens.
  // Scroll/auto presets delegate keyboard handling to KeyboardAwareScrollView.
  const shouldUseKeyboardAvoidingView =
    isNonScrolling(props.preset) && !disableKeyboardAvoidingView;

  const content = isNonScrolling(props.preset) ? (
    <ScreenWithoutScrolling {...props} />
  ) : (
    <ScreenWithScrolling {...props} />
  );

  return (
    <View
      className={cn("h-full w-full flex-1 bg-white", screenClassName)}
      style={[
        $containerInsets,
        // backgroundColor prop now correctly overrides the bg-background class
        backgroundColor ? { backgroundColor } : undefined,
      ]}
    >
      <StatusBar style={barStyle} />
      <NavigationBar style={navigationBarButtonStyle ?? barStyle} />

      {shouldUseKeyboardAvoidingView ? (
        <KeyboardAvoidingView
          behavior={isIos ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
          {...KeyboardAvoidingViewProps}
          style={[{ flex: 1 }, KeyboardAvoidingViewProps?.style]}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View className="flex-1">{content}</View>
      )}
    </View>
  );
}
