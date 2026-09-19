import type { LinkingOptions, RootParamList } from "@react-navigation/native";
import { DETOUR_LINKING_PREFIX, Detour } from "@swmansion/react-native-detour";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";

import { trackNotificationOpen } from "#/lib/trackNotificationOpen";
import { routeState } from "#/state/route-state";

const prefixes = [
  DETOUR_LINKING_PREFIX,
  Linking.createURL(""),
  "https://link.newsspend.com/",
  "https://newspend.godetour.link/",
];

function ensureScheme(url: string) {
  // Check if the URL already starts with any of the valid schemes
  if (prefixes.some((scheme) => url?.startsWith(scheme))) {
    return url; // URL already has a valid scheme
  }

  // If no scheme, add the default (first) scheme
  return Linking.createURL(url);
}

/** Tab stack route name -> the path segment its screens are nested under. */
const TAB_PATH_BY_ROUTE: Record<string, string> = {
  NewsHome: "news",
  ShopHome: "shop",
  DiscoverHome: "discover",
  Me: "settings",
};

const ROUTE_BY_TAB_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_PATH_BY_ROUTE).map(([route, path]) => [path, route])
);

/**
 * Rewrites the tab segment of a deep link to whichever tab the user is on.
 *
 * Article, comment and related screens are registered in every tab stack, so a
 * link that hardcodes one tab (`news/article/...`) would otherwise throw the
 * user out of the tab they were using. Notifications have always done this;
 * widget taps and other incoming URLs now go through the same path.
 *
 * Accepts a full URL or a bare path, as app-generated links put the tab first in
 * both forms. Returns the input unchanged when it carries no tab segment, or
 * when the app has no current tab yet (cold start resolves to NewsHome, which
 * leaves a `news/...` link alone).
 */
function retargetToCurrentTab(url: string): string {
  const currentTabPath =
    TAB_PATH_BY_ROUTE[routeState.reactNavTabName ?? "NewsHome"];
  if (!currentTabPath) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (ROUTE_BY_TAB_PATH[parsed.hostname] !== undefined) {
      if (parsed.hostname === currentTabPath) {
        return url;
      }
      parsed.hostname = currentTabPath;
      return parsed.toString();
    }

    const pathSegments = parsed.pathname.split("/");
    const pathTabIndex = pathSegments.findIndex(
      (segment) => ROUTE_BY_TAB_PATH[segment] !== undefined
    );

    if (pathTabIndex === -1 || pathSegments[pathTabIndex] === currentTabPath) {
      return url;
    }

    pathSegments[pathTabIndex] = currentTabPath;
    parsed.pathname = pathSegments.join("/");
    return parsed.toString();
  } catch {
    const segments = url.split("/");
    const tabIndex = segments.findIndex(
      (segment) => ROUTE_BY_TAB_PATH[segment] !== undefined
    );

    if (tabIndex === -1 || segments[tabIndex] === currentTabPath) {
      return url;
    }

    segments[tabIndex] = currentTabPath;
    return segments.join("/");
  }
}

function withNewsId(url: string, newsId: unknown) {
  if (typeof newsId !== "string" || !newsId.length) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}newsId=${encodeURIComponent(newsId)}`;
}

export const linking: LinkingOptions<RootParamList> = {
  enabled: true,
  prefixes,
  async getInitialURL() {
    // check if app was opened from a Detour deferred link
    const detourUrl = await Detour.getInitialURL();
    if (detourUrl !== undefined) {
      return detourUrl;
    }

    // check if app was opened from a deep link
    const url = await Linking.getInitialURL();

    if (url !== null) {
      return url;
    }

    // check if app was opened from a notification
    const response = Notifications.getLastNotificationResponse();
    if (response?.notification.request.content.body) {
      const screenUrl = response?.notification.request.content.data?.url;
      const newsId = response?.notification.request.content.data?.newsId;

      console.log(response.notification.request.content);

      trackNotificationOpen({
        ...response.notification.request.content,
      });

      if (screenUrl) {
        return ensureScheme(withNewsId(screenUrl, newsId));
      }
    }
  },
  subscribe(listener) {
    // Detour also delivers incoming URLs, so it needs the same retargeting.
    // otherwise it hands React Navigation the raw link first and the tab
    // rewrite below never gets a say.
    const detourSub = Detour.addEventListener("url", ({ url }) => {
      listener(retargetToCurrentTab(url));
    });

    const onReceiveURL = ({ url }: { url: string }) => {
      // Widget taps land here. Keep the user in their current tab, matching
      // how notification taps have always behaved.
      listener(retargetToCurrentTab(ensureScheme(url)));
    };

    // listen for incoming links from deep linking
    const eventListenerSub = Linking.addEventListener("url", onReceiveURL);

    // listen to expo push notifications
    const notificationListenerSub =
      Notifications.addNotificationResponseReceivedListener((response) => {
        let screenUrl = response.notification.request.content.data?.url;
        const newsId = response.notification.request.content.data?.newsId;
        const _common = response.notification.request.content.data?.common;

        if (screenUrl) {
          screenUrl = retargetToCurrentTab(screenUrl as string);
          listener(ensureScheme(withNewsId(screenUrl, newsId)));
          trackNotificationOpen({
            ...response.notification.request.content,
          });
        }
      });

    return () => {
      detourSub.remove();
      eventListenerSub.remove();
      notificationListenerSub.remove();
    };
  },
};
