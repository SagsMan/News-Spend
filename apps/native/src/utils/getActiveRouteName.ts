import type { NavigationState, PartialState } from "@react-navigation/native";

export const getActiveRouteName = (
  state: NavigationState | PartialState<NavigationState> | undefined
): string => {
  if (!state || typeof state.index !== "number") {
    return "Unknown";
  }

  const route = state.routes[state.index];

  if (route.state) {
    return getActiveRouteName(route.state);
  }

  return route.name;
};
