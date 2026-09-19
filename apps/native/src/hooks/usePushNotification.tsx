import { useMutation } from "@tanstack/react-query";
import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useSnapshot } from "valtio";

import { orpc } from "#/lib/orpc";
import { authState } from "#/state/auth";
import { storage } from "#/utils/storage";

const MAX_RETRY_COUNT = 3;

/** Identifies the (token, account, build) triple the server has acknowledged. */
const REGISTRATION_KEY = "pushTokenRegistration";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const setupAndroidChannel = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      showBadge: true,
      lightColor: "#FF231F7C",
    });

    // Split from "default" so a user can turn down low-signal like
    // notifications independently of replies, at the Android OS level:
    // see resolveChannelId in packages/payload/src/lib/expo-push-service.ts.
    // Channel settings only take effect on first creation; once a channel
    // exists, the user's own choice in system settings always wins.
    await Notifications.setNotificationChannelAsync("comments", {
      name: "Comments & Replies",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      showBadge: true,
      lightColor: "#FF231F7C",
    });

    await Notifications.setNotificationChannelAsync("likes", {
      name: "Likes",
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: true,
      lightColor: "#FF231F7C",
    });
  }
};

const registerForPushNotificationsAsync = async () => {
  if (!Device.isDevice) {
    console.warn("Must use physical device for Push Notifications");
    return null;
  }

  await setupAndroidChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Failed to get push token for push notification!");
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.warn("Failed to get project id for push notification!");
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The retry used to fire a `setTimeout` and immediately return null, so the
 * retried attempt's token was thrown away even when it succeeded. Awaiting the
 * next attempt is what makes the retry count for anything.
 */
const registerWithRetry = async (retryCount = 0): Promise<string | null> => {
  try {
    return await registerForPushNotificationsAsync();
  } catch (error) {
    if (retryCount < MAX_RETRY_COUNT) {
      await delay(1000);
      return await registerWithRetry(retryCount + 1);
    }
    console.error("Error registering for push notifications:", error);
    return null;
  }
};

const usePushNotification = () => {
  const authSnapshot = useSnapshot(authState);
  const { user } = authSnapshot;
  const { mutateAsync: saveToken } = useMutation(
    orpc.account.createPushToken.mutationOptions()
  );

  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  const registerToken = useCallback(async () => {
    if (!user) {
      console.log("Not ready for token registration yet");
      return;
    }

    const token = await registerWithRetry();

    /*
     * No token means permission is denied, or Expo could not issue one. Record
     * nothing: the next launch asks again. Caching a failure here is what left
     * devices permanently unregistered.
     */
    if (!token) {
      console.warn("No push token available to register");
      return;
    }

    const appVersion = Application.nativeApplicationVersion ?? "";

    /*
     * A device is registered for a (token, account, build) triple, not for a
     * token alone. Keying on the token alone meant signing into a second
     * account on the same phone never re-associated the token with that
     * account, and the build recorded server-side could never be corrected.
     */
    const registration = `${token}|${user.id}|${appVersion}`;

    if (storage.getString(REGISTRATION_KEY) === registration) {
      return;
    }

    try {
      await saveToken({
        token,
        appVersion,
        deviceModel: Device.modelName ?? "",
        deviceName: Device.deviceName ?? "",
        deviceType:
          Platform.select({
            ios: "ios",
            android: "android",
          }) || "web",
        osVersion: Device.osVersion ?? "",
      });

      /*
       * Only now — the cache records what the server acknowledged, never what
       * we merely attempted. Writing it before the call meant one failed save
       * (offline, a 5xx, an incompatible build) silenced the device forever,
       * because every later launch saw the token as already registered.
       */
      storage.set(REGISTRATION_KEY, registration);
      storage.set("pushToken", token);
      console.log("Token saved successfully");
    } catch (error) {
      console.error("Error saving token:", error);
    }
  }, [user, saveToken]);

  // Listeners don't depend on auth: set up once, unconditionally
  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification response:", response);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []); // ← empty deps, runs once

  // Token registration depends on auth
  useEffect(() => {
    const timeout = setTimeout(registerToken, 5000);
    return () => clearTimeout(timeout);
  }, [registerToken]); // ← only re-runs when auth changes

  const sendPushNotification = useCallback(async (expoPushToken: string) => {
    const message = {
      to: expoPushToken,
      sound: "default",
      title: "Original Title",
      body: "And here is the body!",
      data: { url: "https://newsspend.com/" },
    };

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }, []);

  return { sendPushNotification };
};

export default usePushNotification;
