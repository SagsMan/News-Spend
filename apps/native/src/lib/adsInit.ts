import mobileAds from "react-native-google-mobile-ads";

import { preloadAds } from "#/state/adManager";
import { SCREENSHOT_MODE } from "#/utils/screenshotMode";

import { ensureTrackingPermission } from "./tracking";

const PRELOAD_PLACEMENTS = ["news-click-ads", "discover-tab"] as const;

let initPromise: Promise<void> | null = null;

/**
 * Initializes the Google Mobile Ads SDK exactly once, and only after the App
 * Tracking Transparency prompt has been resolved (iOS). Any code that loads an
 * ad: preloads, app-open ads, feed ads, rewarded ads, should go through this
 * gate so no tracking data is collected before the user has had a chance to
 * consent.
 *
 * On failure the promise is reset so the next caller retries instead of
 * caching a permanent rejection.
 */
export function initializeAdsWhenPermitted(): Promise<void> {
  // Screenshot builds never touch the ads SDK, so no ad view (and no AdMob
  // native-ad validator overlay) can render.
  if (SCREENSHOT_MODE) {
    return Promise.resolve();
  }
  if (!initPromise) {
    initPromise = (async () => {
      await ensureTrackingPermission();
      await mobileAds().initialize();
      preloadAds([...PRELOAD_PLACEMENTS]);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}
