import type { NetInfoState } from "@react-native-community/netinfo";

/**
 * Whether NetInfo is reporting a usable connection.
 *
 * Both fields are tri-state: `null` means "not determined yet", which NetInfo
 * reports for a moment on startup while it probes reachability. Only `false`
 * is an actual negative, so this reads as "online unless proven otherwise".
 *
 * The direction of that default matters. Treating the undetermined window as
 * offline would pause every React Query fetch during the exact frames the app
 * is starting up, and flash the offline toast on a perfectly good connection.
 * Guessing online costs a failed request that would have failed anyway.
 *
 * Shared so the query online-manager and the offline toast can't drift into
 * disagreeing about what "offline" means.
 */
export function isOnline(state: NetInfoState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}
