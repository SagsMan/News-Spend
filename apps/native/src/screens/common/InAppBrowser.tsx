import {
  type StaticScreenProps,
  useNavigation,
  usePreventRemove,
} from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as ScreenOrientation from "expo-screen-orientation";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { cn } from "heroui-native/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  ToastAndroid,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Share from "react-native-share";
import WebView from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewNavigation,
  WebViewOpenWindowEvent,
  WebViewProgressEvent,
} from "react-native-webview/lib/WebViewTypes";
import { Icon } from "#/components/heroui/icon";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  DotsThreeOutlineVerticalIcon,
  ShareNetworkIcon,
  XIcon,
} from "#/lib/icons";

export type InAppBrowserParams = {
  url: string;
  title?: string;
  /** Legacy discriminator: "game" swaps the leave-confirmation copy. */
  type?: string;
  /**
   * Hide the header chrome for fullscreen content (games). A floating close
   * button is rendered instead so there is always a way out on iOS, where
   * there is no hardware back button.
   */
  hideHeader?: boolean;
  /** Confirm before leaving the first page. Defaults to true. */
  confirmOnLeave?: boolean;
  /** Overrides the default confirmation body copy. */
  confirmMessage?: string;
};

/**
 * Schemes we hand to the OS on purpose. Everything else non-http is blocked:
 * ad networks and interstitials lean on `intent://` and friends to eject the
 * user into Chrome, which is the behaviour this screen exists to prevent.
 */
const HANDOFF_SCHEMES = [
  "tel:",
  "mailto:",
  "sms:",
  "market:",
  "itms-apps:",
  "itms-appss:",
];

const HTTP_SCHEME_RE = /^https?:\/\//i;
const WWW_PREFIX_RE = /^www\./;

/**
 * Trim first: CMS/ad URLs have arrived with leading whitespace, which the
 * WebView encodes to `%20...` and iOS then rejects with
 * "is not a file URL" (fatal, NEWS-SPEND-MEDIA-DZ).
 */
const sanitizeUrl = (url: string | undefined | null): string =>
  (url ?? "").trim();

const isHttpUrl = (url: string) => HTTP_SCHEME_RE.test(url.trim());

const getDomain = (url: string) => {
  try {
    return new URL(url.trim()).host.replace(WWW_PREFIX_RE, "");
  } catch {
    return "";
  }
};

export default function InAppBrowser({
  route,
}: StaticScreenProps<InAppBrowserParams>) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    url: initialUrl,
    title,
    type,
    hideHeader = false,
    confirmOnLeave = true,
    confirmMessage,
  } = route.params ?? ({} as InAppBrowserParams);

  const webViewRef = useRef<WebView>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sanitized once: raw params have carried leading whitespace that iOS
  // loads as `%20...` and rejects as "not a file URL" (fatal crash).
  const sanitizedInitialUrl = sanitizeUrl(initialUrl);
  const [source, setSource] = useState({ uri: sanitizedInitialUrl });
  const [currentUrl, setCurrentUrl] = useState(sanitizedInitialUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const progress = useSharedValue(0);

  const domain = useMemo(() => getDomain(currentUrl), [currentUrl]);

  useEffect(() => {
    const lockOrientation = async () => {
      if (Platform.OS === "android") {
        // Android supports ALL
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.ALL
        );
      } else {
        // iOS: use DEFAULT (respects Info.plist settings)
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.DEFAULT
        );
      }
    };

    lockOrientation();

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  useEffect(
    () => () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    },
    []
  );

  const handleNavigationStateChange = useCallback(
    (navState: WebViewNavigation) => {
      setCanGoBack(navState.canGoBack);
      setCurrentUrl(navState.url);
      setIsLoading(navState.loading);
      if (navState.loading) {
        loadingTimeoutRef.current = setTimeout(
          () => setIsLoading(false),
          10_000
        );
      } else if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    },
    []
  );

  const handleLoadProgress = useCallback(
    ({ nativeEvent }: WebViewProgressEvent) => {
      progress.value = withTiming(nativeEvent.progress, { duration: 120 });
    },
    [progress]
  );

  const handleShouldStartLoad = useCallback(
    ({ url }: ShouldStartLoadRequest) => {
      const clean = url.trim();
      if (isHttpUrl(clean) || clean === "about:blank") {
        return true;
      }
      if (HANDOFF_SCHEMES.some((scheme) => clean.startsWith(scheme))) {
        Linking.openURL(clean).catch(() => {
          /* nothing installed to handle it; stay put */
        });
        return false;
      }
      return false;
    },
    []
  );

  const handleOpenWindow = useCallback(
    ({ nativeEvent }: WebViewOpenWindowEvent) => {
      const target = nativeEvent.targetUrl.trim();
      if (isHttpUrl(target)) {
        setSource({ uri: target });
      }
    },
    []
  );

  const leaveMessage =
    confirmMessage ??
    (type === "game"
      ? "Are you sure you want to leave the game?"
      : "You will lose the chance to earn points");

  // Always intercept the pop: an in-WebView history entry should consume the
  // back gesture before the screen itself does.
  usePreventRemove(true, ({ data }) => {
    if (canGoBack) {
      webViewRef.current?.goBack();
      return;
    }
    if (!confirmOnLeave) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert("Are you sure?", leaveMessage, [
      { text: "no", style: "cancel" },
      {
        text: "yes, leave",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const onLeftPress = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack();
      return;
    }
    navigation.goBack();
  }, [canGoBack, navigation]);

  const onReload = useCallback(() => {
    setMenuOpen(false);
    webViewRef.current?.reload();
  }, []);

  const onCopyLink = useCallback(async () => {
    setMenuOpen(false);
    await Clipboard.setStringAsync(currentUrl);
    if (Platform.OS === "android") {
      ToastAndroid.show("Link copied", ToastAndroid.SHORT);
    }
  }, [currentUrl]);

  const onShare = useCallback(async () => {
    setMenuOpen(false);
    try {
      await Share.open({ url: currentUrl, message: title });
    } catch {
      /* user dismissed the share sheet */
    }
  }, [currentUrl, title]);

  const onOpenExternally = useCallback(() => {
    setMenuOpen(false);
    Linking.openURL(currentUrl).catch(() => {
      /* no browser available */
    });
  }, [currentUrl]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: progress.value >= 1 ? 0 : 1,
  }));

  return (
    <Screen preset="fixed" safeAreaEdges={hideHeader ? [] : ["bottom"]}>
      {hideHeader ? null : (
        <View className="bg-p-500 pt-safe-offset-1">
          <View className="relative w-full flex-row items-center px-3 py-2">
            <PressableFeedback
              className="min-w-10 items-center justify-center px-2"
              hitSlop={20}
              onPress={onLeftPress}
            >
              <Icon
                color="white"
                name={canGoBack ? ArrowLeftIcon : XIcon}
                size={24}
              />
            </PressableFeedback>

            <View className="flex-1 items-center justify-center">
              <Text
                className="font-medium text-base text-white"
                numberOfLines={1}
              >
                {title ?? domain}
              </Text>
              {title && domain ? (
                <Text className="text-white/70 text-xs" numberOfLines={1}>
                  {domain}
                </Text>
              ) : null}
            </View>

            <PressableFeedback
              className="min-w-10 items-center justify-center px-2"
              hitSlop={20}
              onPress={() => setMenuOpen(true)}
            >
              <Icon
                color="white"
                name={DotsThreeOutlineVerticalIcon}
                size={20}
              />
            </PressableFeedback>
          </View>

          <View className="h-0.5 w-full bg-transparent">
            <Animated.View className="h-full bg-white" style={progressStyle} />
          </View>
        </View>
      )}

      <WebView
        allowsBackForwardNavigationGestures={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onError={() => {
          setIsLoading(false);
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
        }}
        onLoadProgress={handleLoadProgress}
        onLoadStart={() => setIsLoading(true)}
        onNavigationStateChange={handleNavigationStateChange}
        onOpenWindow={handleOpenWindow}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        originWhitelist={["http://*", "https://*"]}
        ref={webViewRef}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        source={source}
        thirdPartyCookiesEnabled
      />

      {hideHeader ? (
        <Pressable
          className="absolute rounded-full bg-black/50 p-2 active:opacity-70"
          hitSlop={16}
          onPress={onLeftPress}
          style={{ top: insets.top + 8, left: 12 }}
        >
          <Icon
            color="white"
            name={canGoBack ? ArrowLeftIcon : XIcon}
            size={20}
          />
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#0000ff" size="large" />
        </View>
      ) : null}

      <BottomSheet isOpen={menuOpen} onOpenChange={setMenuOpen}>
        {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders in
        a separate native window and blocks the RN element inspector. */}
        <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
          <BottomSheet.Overlay />
          <BottomSheet.Content style={{ paddingBottom: insets.bottom }}>
            <View className="gap-2 px-3 pt-3">
              {domain ? (
                <Text className="px-1 pb-1 text-muted-foreground text-xs">
                  {domain}
                </Text>
              ) : null}
              <MenuRow
                icon={ArrowClockwiseIcon}
                label="Reload"
                onPress={onReload}
              />
              <MenuRow icon={CopyIcon} label="Copy link" onPress={onCopyLink} />
              <MenuRow
                icon={ShareNetworkIcon}
                label="Share"
                onPress={onShare}
              />
              <MenuRow
                icon={ArrowSquareOutIcon}
                label="Open in browser"
                onPress={onOpenExternally}
              />
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </Screen>
  );
}

function MenuRow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-3 rounded-lg bg-default px-3 py-3",
        "active:opacity-60"
      )}
      onPress={onPress}
    >
      <Icon name={icon} size={20} />
      <Text className="text-base text-foreground">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
});
