import "./global.css";
import "react-native-url-polyfill/auto";
import { DefaultTheme, type Theme } from "@react-navigation/native";
import { useMMKVDevTools } from "@rozenite/mmkv-plugin";
import { useReactNavigationDevTools } from "@rozenite/react-navigation-plugin";
import { useTanStackQueryDevTools } from "@rozenite/tanstack-query-plugin";
import * as Sentry from "@sentry/react-native";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AppMetrics, Observe, ObserveRoot } from "expo-observe";
import { ObserveNavigationProvider } from "expo-observe/integrations/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef } from "react";
import { Platform, StatusBar as RNStatusBar, View } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";
import { useSnapshot } from "valtio";
import { UpgradeRequired } from "#/components/UpgradeRequired";
import AppOpenAd from "./components/Ads/AppOpenAd";
import GiveawayReward from "./components/dialogs/GiveawayReward";
import useCachedResources from "./hooks/useCachedResources";
import { initializeAdsWhenPermitted } from "./lib/adsInit";
import { initSentry } from "./lib/sentry";
import { queryClient } from "./lib/tanstackQuery";
import { Navigation } from "./navigation";
import { CONSTANTS } from "./navigation/constants";
import { linking } from "./navigation/linking";
import {
  navigationRef,
  useNavigationPersistence,
} from "./navigation/navigationUtils";
import { Provider } from "./provider";
import { authState, hydrateAuth } from "./state/auth";
import { runAfterStartup } from "./utils/afterStartup";
import { createMMKVPersister } from "./utils/clientPersister";
import { SCREENSHOT_MODE } from "./utils/screenshotMode";
import { storage } from "./utils/storage";

Uniwind.setTheme("light");

// HeroUINativeProvider feeds uniwind its insets via SafeAreaListener, which only
// fires after the native view measures. Until then `rt.insets` is all zeroes and
// anything using pt-safe renders unpadded, then jumps. Seed it synchronously so
// the first frame is already correct.
//
// On Android initialWindowMetrics is often null this early: the native module
// reads rootWindowInsets off the decor view, which has none until it is attached.
// StatusBar.currentHeight is a plain constant and is available right away, so it
// covers the top edge (the one behind the status bar) while the listener fills in
// the rest a frame later.
const initialInsets =
  initialWindowMetrics?.insets ??
  (Platform.OS === "android"
    ? { top: RNStatusBar.currentHeight ?? 0, bottom: 0, left: 0, right: 0 }
    : null);

if (initialInsets) {
  Uniwind.updateInsets(initialInsets);
}

SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({
  duration: 200,
  fade: true,
});

initSentry();
hydrateAuth();

const persister = createMMKVPersister();

Observe.configure({
  integrations: {
    "react-navigation": true,
  },
});

const myCustomTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#fff",
    card: "#00223D",
  },
};
export function App() {
  useTanStackQueryDevTools(queryClient);
  useReactNavigationDevTools({ ref: navigationRef });
  useMMKVDevTools({
    storages: {
      "main-storage": storage,
    },
  });
  const { onNavigationStateChange, onReady } = useNavigationPersistence(
    storage,
    CONSTANTS.PERSISTENCE_KEY
  );

  const { loadingComplete } = useCachedResources();

  const authStatus = useSnapshot(authState).status;

  // Request App Tracking Transparency (iOS) and only then initialize the
  // Mobile Ads SDK + preload ads, so no tracking data is collected before
  // the user has had a chance to consent.
  const adsInitiatedRef = useRef(false);

  useEffect(
    () =>
      runAfterStartup(() => {
        if (adsInitiatedRef.current) {
          return;
        }
        adsInitiatedRef.current = true;
        initializeAdsWhenPermitted().catch((error) => {
          console.warn("Ad initialization failed", error);
        });
      }),
    []
  );

  // Hidden on the real content's first onLayout, not on the JS state that
  // gates rendering it: that state can flip true well before the Navigation
  // tree has actually been laid out on the native side. Hiding on the state
  // change alone tears down the splash into that gap, exposing the bare
  // Activity window background (a visible grey/white flash on Android) until
  // real pixels land a beat later.
  const splashHiddenRef = useRef(false);

  const handleContentLayout = useCallback(() => {
    if (splashHiddenRef.current) {
      return;
    }
    splashHiddenRef.current = true;
    AppMetrics.markInteractive();
    SplashScreen.hideAsync();
  }, []);

  if (authStatus === "idle" || !loadingComplete) {
    return null;
  }

  return (
    <View onLayout={handleContentLayout} style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
      >
        <Provider>
          <ObserveNavigationProvider navigationRef={navigationRef}>
            <Navigation
              linking={linking}
              onReady={onReady}
              onStateChange={onNavigationStateChange}
              persistor={{
                persist(state) {
                  const isDev = __DEV__;
                  if (isDev) {
                    storage.set(
                      CONSTANTS.PERSISTENCE_KEY,
                      JSON.stringify(state)
                    );
                  }
                },
                restore() {
                  const state = storage.getString(CONSTANTS.PERSISTENCE_KEY);

                  return state ? JSON.parse(state) : undefined;
                },
              }}
              ref={navigationRef}
              theme={myCustomTheme}
            />
          </ObserveNavigationProvider>
          <GiveawayReward />
          {/* Last, so it covers everything when the server refuses this build. */}
          <UpgradeRequired />

          {!SCREENSHOT_MODE && <AppOpenAd />}
        </Provider>
      </PersistQueryClientProvider>
    </View>
  );
}

const ObservedApp = ObserveRoot.wrap(App);
const RootComponent = __DEV__ ? ObservedApp : Sentry.wrap(ObservedApp);

export default RootComponent;
