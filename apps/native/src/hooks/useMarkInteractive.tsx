import { useObserveForReactNavigation } from "expo-observe/integrations/react-navigation";
import { useEffect } from "react";

/**
 * Emits the navigation TTI metric (`nav_tti`) for the current screen once
 * `isReady` becomes true. Call inside a screen component (or a descendant that
 * shares its route context) with a flag that flips true when the screen's
 * meaningful content has rendered, e.g. `useMarkInteractive(!isPending)`.
 * Pass `true` for static screens that are interactive on first render.
 * The integration records at most one TTI per navigation, so repeated calls
 * (refetches, re-renders) are safe.
 */
export function useMarkInteractive(isReady: boolean) {
  const markInteractive = useObserveForReactNavigation();

  useEffect(() => {
    if (isReady) {
      markInteractive?.();
    }
  }, [isReady, markInteractive]);
}
