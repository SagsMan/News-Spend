import {
  createNavigationContainerRef,
  getActionFromState,
  getStateFromPath,
  type NavigationState,
} from "@react-navigation/native";

import { navigationIntegration } from "#/lib/sentry";
import {
  routeState,
  setReactNavTabName,
  setRouteName,
} from "#/state/route-state";
import { getActiveRouteName } from "#/utils/getActiveRouteName";
import type { storage } from "#/utils/storage";

import { CONSTANTS } from "./constants";

export const navigationRef = createNavigationContainerRef();
type MMKVStorage = typeof storage;

export function linkTo(path: string, config: unknown) {
  // @ts-expect-error - Config structure is dynamic
  const state = getStateFromPath(path, config);
  if (!state) {
    return;
  }
  const action = getActionFromState(state);

  getCurrentTabName();

  if (action !== undefined && navigationRef.isReady()) {
    navigationRef.dispatch(action);
  }
}

export function navigate(name: string, params?: unknown) {
  if (navigationRef.isReady()) {
    // @ts-expect-error - Navigation params are dynamic
    navigationRef.navigate(name, params);
  }
}

export function getCurrentTabName() {
  if (!navigationRef.isReady()) {
    console.warn("Navigation is not ready. Cannot get current tab name.");
    return null;
  }

  const navigationState = navigationRef.getState();
  const current = navigationState?.routes[navigationState?.index];

  if (current.name === "Tab") {
    return current.state;
  }

  return current.name;
}

/**
 * This helper function will determine whether we should enable navigation persistence
 * based on a config setting and the __DEV__ environment (dev or prod).
 * @param PersistNavigationConfig persistNavigation - The config setting for navigation persistence.
 * @returns boolean - Whether to restore navigation state by default.
 */
function _navigationRestoredDefaultState(
  persistNavigation: "dev" | "prod" | "always"
) {
  if (persistNavigation === "always") {
    return false;
  }
  const isDev = process.env.NODE_ENV === "development";
  if (persistNavigation === "dev" && isDev) {
    return false;
  }
  if (persistNavigation === "prod" && !isDev) {
    return false;
  }

  // all other cases, disable restoration by returning true
  return true;
}

/**
 * Custom hook for persisting navigation state.
 * @param Storage storage - The storage utility to use.
 * @param string persistenceKey - The key to use for storing the navigation state.
 * @returns object - The navigation state and persistence functions.
 */
export function useNavigationPersistence(
  _storage: MMKVStorage,
  _persistenceKey: string
) {
  const onNavigationStateChange = (state: NavigationState | undefined) => {
    if (!state) {
      return;
    }

    try {
      const { routeName } = routeState;

      const newRouteName = getActiveRouteName(
        state
      ) as (typeof CONSTANTS.TAB_SCREENS)[number];

      if (routeName !== newRouteName) {
        setRouteName(newRouteName);

        if (__DEV__) {
          console.log("Route changed to:", newRouteName);
        }

        if (CONSTANTS.TAB_SCREENS.includes(newRouteName)) {
          setReactNavTabName(newRouteName);
        }
      }
    } catch (error) {
      console.error("Navigation state change error:", error);
    }
  };

  function onReady() {
    const currentRouteName = navigationRef.getCurrentRoute()?.name;

    // Set initial route name
    setRouteName(currentRouteName);

    // Set initial tab name if it's a tab screen
    const isTabScreen =
      currentRouteName &&
      CONSTANTS.TAB_SCREENS.includes(
        currentRouteName as (typeof CONSTANTS.TAB_SCREENS)[number]
      );

    setReactNavTabName(
      isTabScreen
        ? (currentRouteName as (typeof CONSTANTS.TAB_SCREENS)[number])
        : "NewsHome"
    );

    // Register Sentry navigation integration in production
    const isDev = process.env.NODE_ENV === "development";
    if (!isDev) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }

  return {
    onNavigationStateChange,
    onReady,
  };
}
