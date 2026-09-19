import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

const appVariant = Constants.expoConfig?.extra?.variant as
  | "development"
  | "beta"
  | "preview"
  | "production"
  | undefined;

/**
 * Which build this is, taken from the release channel rather than app config.
 *
 * `extra.variant` comes from APP_VARIANT, which lives in each build profile in
 * eas.json and is NOT an EAS environment variable. So `eas update` run from a
 * machine whose local .env says `development` bakes that into the update
 * manifest, and an OTA update replaces `Constants.expoConfig` wholesale. That
 * is how the production app began serving Google's test ad units after an
 * update: nothing about the binary changed, only the config it reported.
 *
 * `Updates.channel` is fixed by the build that was installed and no update
 * manifest can rewrite it, so it is the signal to trust. It is null in Expo Go
 * and in a locally-run dev client, which is why APP_VARIANT stays as the
 * fallback for those.
 */
const isProductionBuild = Updates.channel
  ? Updates.channel === "production"
  : appVariant === "production";

// Real ad units only in the production build; every other environment
// (development, preview, beta) serves Google's test ad units.
const isTest = __DEV__ || !isProductionBuild;

export const adUnits = isTest
  ? {
      banner: TestIds.BANNER,
      native: TestIds.NATIVE,
      rewarded: TestIds.REWARDED,
      rewardedInterstitial: TestIds.REWARDED_INTERSTITIAL,
    }
  : {
      banner: Platform.select({
        ios: "ca-app-pub-3654282727219827/3674960628",
        android: "ca-app-pub-3654282727219827/4234197972",
      }) as string,
      native: Platform.select({
        ios: "ca-app-pub-3654282727219827/2361878957",
        android: "ca-app-pub-3654282727219827/1388578173",
      }) as string,
      rewarded: Platform.select({
        ios: "ca-app-pub-3654282727219827/1197006480",
        android: "ca-app-pub-3654282727219827/2729544619",
      }) as string,
      rewardedInterstitial: Platform.select({
        ios: "ca-app-pub-3654282727219827/6477217937",
        android: "ca-app-pub-3654282727219827/4988042293",
      }) as string,
    };
