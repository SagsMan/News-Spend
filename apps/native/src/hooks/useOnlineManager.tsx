import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import * as React from "react";
import { Platform } from "react-native";

import { isOnline } from "#/utils/networkState";

/**
 * Teaches React Query when the device is actually offline.
 *
 * Without this, `onlineManager` stays permanently online on React Native, so
 * every query fires into a dead network, fails, and works through the retry
 * ladder (2s → 4s → 8s) in parallel across the screen. With it, queries pause
 * instead and refetch automatically on reconnect.
 */
export function useOnlineManager() {
  React.useEffect(() => {
    // React Query already supports on reconnect auto refetch in web browser
    if (Platform.OS !== "web") {
      return NetInfo.addEventListener((state) => {
        onlineManager.setOnline(isOnline(state));
      });
    }
  }, []);
}
