import { createStaticNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSnapshot } from "valtio";

import { authState } from "#/state/auth";

import { commonAuthScreens } from "./common";
import TabLayout from "./tab-navigator";

function useIsSignedIn() {
  const { status } = useSnapshot(authState);
  return status === "signIn";
}

function useIsSignedOut() {
  const { status } = useSnapshot(authState);
  return status === "signOut";
}

const RootStackNavigator = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
    animation: "slide_from_right",
  },
  groups: {
    LoggedIn: {
      if: useIsSignedIn,
      screens: {
        Tab: TabLayout,
        ...commonAuthScreens,
      },
    },
    LoggedOut: {
      if: useIsSignedOut,
      screens: commonAuthScreens,
    },
  },
});

export const Navigation = createStaticNavigation(RootStackNavigator);

type RootStackType = typeof RootStackNavigator;

declare module "@react-navigation/core" {
  interface RootNavigator extends RootStackType {}
}
