import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import {
  getFocusedRouteNameFromRoute,
  useLinkBuilder,
} from "@react-navigation/native";
import { cn } from "heroui-native/utils";
import { memo, useCallback, useEffect } from "react";
import type { LayoutChangeEvent } from "react-native";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Text } from "#/components/heroui/text";
import { setTabBarHeight } from "#/state/route-state";

// Root screen of each tab where the tab bar should show, plus the tab's own
// route name (Home/Shop/Discover). Both are needed: tabs are lazy by
// default, so on a tab's first focus its nested stack hasn't mounted/reported
// state back yet, and getFocusedRouteNameFromRoute briefly returns undefined
// for that one render, falling back to the tab's own name. Without the tab
// names here too, that render would incorrectly hide the tab bar for a frame
// before the nested stack resolves and it pops back, a visible flicker.
// Deliberately excludes Me/SettingsHome: the tab bar is never shown
// anywhere in the Me tab, including its own root.
const TAB_ROOT_ROUTES = new Set([
  "NewsHome",
  "ShopHome",
  "DiscoverHome",
  "Home",
  "Shop",
  "Discover",
]);

function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index];
  const focusedRouteName = getFocusedRouteNameFromRoute(currentRoute);
  const isTabBarVisible = TAB_ROOT_ROUTES.has(
    focusedRouteName ?? currentRoute.name
  );

  const { buildHref } = useLinkBuilder();

  // React Navigation renders whatever this component returns as a normal
  // flex sibling of the "screens" container. So animating THIS component's
  // own height (an earlier approach) made that sibling container resize
  // too, and every screen (via StyleSheet.absoluteFill inside it) visibly
  // resized along with it, even screens like PlayLottery that have nothing
  // to do with the tab bar. Making our root position: absolute removes us
  // from that flex column entirely, so the screens container, and every
  // screen inside it, is always full height, completely unaffected by our
  // own show/hide animation. We just slide and fade over top of it instead.
  //
  // The wrapper's single onLayout feeds useTabBarHeight(), so any floating
  // content added back as a sibling of the tab row belongs inside this SAME
  // wrapper rather than as its own separately-animated element: one wrapper,
  // one measurement, one animation.
  const measuredHeight = useSharedValue(0);
  const progress = useSharedValue(isTabBarVisible ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isTabBarVisible ? 1 : 0, { duration: 300 });
  }, [isTabBarVisible, progress]);

  const onWrapperLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      setTabBarHeight(height);
      measuredHeight.value = height;
    },
    [measuredHeight]
  );

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: measuredHeight.value * (1 - progress.value) }],
  }));

  return (
    <Animated.View
      onLayout={onWrapperLayout}
      style={[
        { position: "absolute", bottom: 0, left: 0, right: 0 },
        animatedWrapperStyle,
      ]}
    >
      <View
        className="flex-row bg-p-500 pt-2 pb-safe-or-2"
        pointerEvents={isTabBarVisible ? "auto" : "none"}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!(isFocused || event.defaultPrevented)) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <PlatformPressable
              accessibilityLabel={options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              href={buildHref(route.name, route.params)}
              key={route.key}
              onLongPress={onLongPress}
              onPress={onPress}
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {options.tabBarIcon && (
                <options.tabBarIcon
                  color={isFocused ? "#fff" : "gray"}
                  focused={isFocused}
                  size={25}
                  style={{ alignSelf: "center" }}
                />
              )}
              <Text
                className={cn(
                  "text-center text-xs",
                  isFocused ? "font-semibold text-background" : "text-gray-500"
                )}
              >
                {typeof label === "string" ? label : route.name}
              </Text>
            </PlatformPressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default memo(TabBar);
