import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { AppState, Platform } from "react-native";

/**
 * Requests App Tracking Transparency authorization on iOS, resolving to
 * `true` when the user granted tracking (or when the platform doesn't
 * require it, e.g. Android/web).
 *
 * The prompt only appears when:
 * - the platform is iOS,
 * - the authorization is still `undetermined` (iOS remembers the user's
 *   choice for the lifetime of the install, so it is never re-requested),
 * - the app is in the `active` state (iOS silently drops the prompt when
 *   the request is made while the app is inactive/backgrounded, e.g.
 *   mid-splash or during a transition).
 */
export async function ensureTrackingPermission(): Promise<boolean> {
  if (Platform.OS !== "ios") {
    return true;
  }

  const { status } = await getTrackingPermissionsAsync();
  if (status !== PermissionStatus.UNDETERMINED) {
    return status === PermissionStatus.GRANTED;
  }

  if (AppState.currentState !== "active") {
    await new Promise<void>((resolve) => {
      const subscription = AppState.addEventListener("change", (nextState) => {
        if (nextState === "active") {
          subscription.remove();
          resolve();
        }
      });
    });
  }

  const { status: requestedStatus } = await requestTrackingPermissionsAsync();
  return requestedStatus === PermissionStatus.GRANTED;
}
