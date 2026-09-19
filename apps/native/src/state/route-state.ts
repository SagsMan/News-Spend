import { proxy, useSnapshot } from "valtio";

export const routeState = proxy<{
  routeName: string | undefined;
  tabName: string | undefined;
  swipe: boolean;
  reactNavTabName: string | undefined;
}>({
  routeName: undefined,
  swipe: true,
  tabName: "latest",
  reactNavTabName: undefined,
});

export const setRouteName = (routeName: string | undefined) => {
  routeState.routeName = routeName;
};

export const setReactNavTabName = (tabName: string | undefined) => {
  routeState.reactNavTabName = tabName;
};
export const setTabName = (tabName: string | undefined) => {
  routeState.tabName = tabName;
};

export const setSwipe = (swipe: boolean) => {
  routeState.swipe = swipe;
};

export const tabBarState = proxy<{
  height: number;
}>({
  height: 0,
});

export const setTabBarHeight = (height: number) => {
  if (tabBarState.height !== height) {
    tabBarState.height = height;
  }
};

/**
 * The tab bar's real measured height (set by TabBar's own onLayout).
 * Use this instead of @react-navigation/bottom-tabs' useBottomTabBarHeight:
 * that hook reflects the library's static default estimate, not our actual
 * custom-rendered bar, and our bar is a floating overlay (position: absolute)
 * rather than an in-flow sibling, so screens must explicitly pad for it or
 * their bottom content renders underneath it.
 */
export const useTabBarHeight = () => useSnapshot(tabBarState).height;
