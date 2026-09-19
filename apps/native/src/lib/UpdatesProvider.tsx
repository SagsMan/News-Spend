import {
  channel,
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
  type UpdateInfo,
  UpdateInfoType,
  useUpdates as useExpoUpdates,
} from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { UpdateSheet } from "#/components/UpdateSheet";

/**
 * An update declares its own urgency. `eas update` bakes the app config of the
 * publish into the manifest it serves, so `extra.updatePriority` travels with
 * the update and is readable from the check alone, before a byte of the
 * payload is downloaded, and without the running build having known about it.
 */
const isMandatoryUpdate = (update: UpdateInfo | undefined) => {
  if (!update || update.type !== UpdateInfoType.NEW) {
    return false;
  }
  const { manifest } = update;
  if (!("extra" in manifest)) {
    return false;
  }
  return manifest.extra?.expoClient?.extra?.updatePriority === "mandatory";
};

export const useUpdates = () => {
  const {
    availableUpdate,
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadedUpdate,
  } = useExpoUpdates();

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const isDevelopmentBuild = channel === null;

  // Track whether the initial check has completed so we don't
  // double-fire the sheet on first appState change to "active".
  const initialCheckDone = useRef(false);

  // One fetch per update. `isDownloading` only flips on the next render, so it
  // can't guard the effect that starts the download, the update's own id can.
  const fetchedUpdateId = useRef<string | null>(null);

  const isMandatory = isMandatoryUpdate(availableUpdate);

  // The payload is already on disk: restarting is now instant.
  const isReady = isUpdatePending && Boolean(downloadedUpdate);

  // Download the moment an update is found, not when the user accepts it.
  // `checkForUpdateAsync` fetches the manifest only, so without this the whole
  // bundle download sits behind the tap and the user waits on a dead button.
  useEffect(() => {
    if (isDevelopmentBuild || !isUpdateAvailable || !availableUpdate) {
      return;
    }
    const updateId = availableUpdate.updateId ?? "rollback";
    if (fetchedUpdateId.current === updateId) {
      return;
    }
    fetchedUpdateId.current = updateId;
    fetchUpdateAsync().catch(() => {
      // Allow a later foreground check to retry this update.
      fetchedUpdateId.current = null;
    });
  }, [isUpdateAvailable, availableUpdate, isDevelopmentBuild]);

  useEffect(() => {
    if (isUpdateAvailable && availableUpdate && !isDevelopmentBuild) {
      setIsSheetOpen(true);
      initialCheckDone.current = true;
    }
  }, [isUpdateAvailable, availableUpdate, isDevelopmentBuild]);

  // When the app comes to the foreground, check for updates.
  // ON_LOAD only fires on cold start, this covers users who keep
  // the app open for hours/days.
  const handleAppStateChange = useCallback(
    (nextState: AppStateStatus) => {
      if (
        nextState === "active" &&
        !isDevelopmentBuild &&
        initialCheckDone.current
      ) {
        checkForUpdateAsync().catch(() => {
          // Silently ignore. Network failures are expected.
        });
      }
    },
    [isDevelopmentBuild]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, [handleAppStateChange]);

  const handleRestart = useCallback(() => {
    reloadAsync().catch(() => {
      setIsSheetOpen(false);
    });
  }, []);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      // Refuse every dismissal route while a mandatory update is outstanding.
      if (!value && isMandatory) {
        return;
      }
      setIsSheetOpen(value);
    },
    [isMandatory]
  );

  return {
    // An element, not a component: a component defined inline here would be a
    // new type on every render, remounting the sheet mid-animation.
    updateSheet: (
      <UpdateSheet
        isDownloading={isDownloading}
        isMandatory={isMandatory}
        isOpen={isSheetOpen}
        isReady={isReady}
        onOpenChange={handleOpenChange}
        onRestart={handleRestart}
      />
    ),
    isUpdateAvailable,
    isUpdatePending,
    isDevelopmentBuild,
  };
};
