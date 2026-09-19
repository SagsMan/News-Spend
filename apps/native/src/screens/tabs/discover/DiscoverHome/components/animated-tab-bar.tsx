import { cn } from "heroui-native/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Text } from "#/components/heroui/text";

type TabLayout = { x: number; width: number };

type LabelContext = {
  name: string;
  label: string;
  index: number;
  focused: boolean;
};

type AnimatedTabBarProps = {
  tabNames: string[];
  tabLabels: Record<string, string>;
  indexDecimal: SharedValue<number>;
  activeIndex: number;
  onTabPress: (name: string) => void;
  /** Called with the measured height of the tab bar (in px) once laid out. */
  onLayout?: (height: number) => void;
  backgroundColor?: string;
  activeColor?: string;
  inactiveColor?: string;
  indicatorColor?: string;
  /** Inset on each side of the tab label, making the underline narrower
   *  than the tab. 7.5px per side = 15px total (matches the original
   *  react-native-tab-view look this screen used to have). */
  indicatorInset?: number;
  /** Container (outer bar wrapper) style. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Container (outer bar wrapper) className. */
  containerClassName?: string;
  /** Scroll content style (the row of tabs inside the scroll view). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Scroll content className. */
  contentClassName?: string;
  /** Per-tab Pressable style. */
  tabStyle?: StyleProp<ViewStyle>;
  /** Per-tab Pressable className. */
  tabClassName?: string;
  /** Active label className. Merged with the base active class. */
  activeLabelClassName?: string;
  /** Active label style. */
  activeLabelStyle?: StyleProp<TextStyle>;
  /** Inactive label className. Merged with the base inactive class. */
  inactiveLabelClassName?: string;
  /** Inactive label style. */
  inactiveLabelStyle?: StyleProp<TextStyle>;
  /** Indicator style. */
  indicatorStyle?: StyleProp<ViewStyle>;
  /** Indicator className. */
  indicatorClassName?: string;
  /** Escape hatch: render the label however you want. Receives focus state. */
  renderLabel?: (ctx: LabelContext) => React.ReactNode;
};

const ACTIVE_LABEL_CLASS = "text-sm capitalize text-white";
const INACTIVE_LABEL_CLASS = "text-sm capitalize text-gray-500";

export function AnimatedTabBar({
  tabNames,
  tabLabels,
  indexDecimal,
  activeIndex,
  onTabPress,
  onLayout: onBarLayout,
  backgroundColor = "#00223d",
  activeColor,
  inactiveColor,
  indicatorColor = "#ffffff",
  indicatorInset = 7.5,
  containerStyle,
  containerClassName,
  contentStyle,
  contentClassName,
  tabStyle,
  tabClassName,
  activeLabelClassName,
  activeLabelStyle,
  inactiveLabelClassName,
  inactiveLabelStyle,
  indicatorStyle,
  indicatorClassName,
  renderLabel,
}: AnimatedTabBarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollXSV = useSharedValue(0);

  const [layoutsByName, setLayoutsByName] = useState<Record<string, TabLayout>>(
    {}
  );

  const onItemLayout = useCallback((name: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayoutsByName((prev) => {
      const existing = prev[name];
      if (existing && existing.x === x && existing.width === width) {
        return prev;
      }
      return { ...prev, [name]: { x, width } };
    });
  }, []);

  const layouts = useMemo(
    () => tabNames.map((name) => layoutsByName[name]),
    [tabNames, layoutsByName]
  );

  const allLayoutsReady =
    tabNames.length > 0 && layouts.every((l): l is TabLayout => Boolean(l));

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollXSV.value = e.contentOffset.x;
  });

  const hasCenteredRef = useRef(false);
  useEffect(() => {
    const layout = layouts[activeIndex];
    if (!layout) {
      return;
    }
    const target = Math.max(0, layout.x + layout.width / 2 - windowWidth / 2);
    scrollRef.current?.scrollTo({
      x: target,
      animated: hasCenteredRef.current,
    });
    hasCenteredRef.current = true;
  }, [activeIndex, layouts, windowWidth]);

  const indicatorAnimStyle = useAnimatedStyle(() => {
    "worklet";
    if (!allLayoutsReady) {
      return { opacity: 0 };
    }
    const count = layouts.length;
    const pos = Math.min(Math.max(indexDecimal.value, 0), count - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, count - 1);
    const fraction = pos - i0;
    const l0 = layouts[i0] as TabLayout;
    const l1 = layouts[i1] as TabLayout;
    const xInViewport = l0.x + (l1.x - l0.x) * fraction - scrollXSV.value;
    const width =
      l0.width + (l1.width - l0.width) * fraction - indicatorInset * 2;
    return {
      opacity: 1,
      transform: [{ translateX: xInViewport + indicatorInset }],
      width: Math.max(0, width),
    };
  });

  return (
    <View
      accessibilityRole="tablist"
      className={cn("border-b border-b-white/10", containerClassName)}
      onLayout={(e) => onBarLayout?.(e.nativeEvent.layout.height)}
      style={[{ backgroundColor }, containerStyle]}
    >
      <Animated.ScrollView
        contentContainerClassName={cn(
          "flex-row items-end px-3",
          contentClassName
        )}
        contentContainerStyle={contentStyle}
        horizontal
        onScroll={onScroll}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      >
        {tabNames.map((name, i) => {
          const focused = i === activeIndex;
          const label = tabLabels[name] ?? name;
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              className={cn("px-3 py-2.5", tabClassName)}
              key={name}
              onLayout={(e) => onItemLayout(name, e)}
              onPress={() => onTabPress(name)}
              style={tabStyle}
            >
              {renderLabel ? (
                renderLabel({ name, label, index: i, focused })
              ) : (
                <Text
                  className={cn(
                    focused ? ACTIVE_LABEL_CLASS : INACTIVE_LABEL_CLASS,
                    focused ? activeLabelClassName : inactiveLabelClassName
                  )}
                  style={
                    focused
                      ? [
                          activeColor ? { color: activeColor } : null,
                          activeLabelStyle,
                        ]
                      : [
                          inactiveColor ? { color: inactiveColor } : null,
                          inactiveLabelStyle,
                        ]
                  }
                >
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </Animated.ScrollView>
      {allLayoutsReady ? (
        <Animated.View
          className={cn("rounded-full", indicatorClassName)}
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              backgroundColor: indicatorColor,
            },
            indicatorStyle,
            indicatorAnimStyle,
          ]}
        />
      ) : null}
    </View>
  );
}
