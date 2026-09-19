import type { GoldieConfig } from "/Users/odunsi/.volta/tools/image/packages/goldie/lib/node_modules/goldie/dist/config.d.ts";

const APP_ROOT = "/Users/odunsi/Workspace/news-spend/apps/native";

/**
 * App Store screenshots for News Spend (guideline 2.3.3 resubmission).
 *
 * appPath is the iOS simulator build from EAS profile `screenshots`
 * (production variant, no dev client), downloaded to the session scratchpad.
 * Rebuild with `eas build --profile screenshots --platform ios` and drop the
 * new .app in place when the JS changes.
 *
 * The news feed is live production content, so store-02-article opens the
 * first row of a category by position, not by headline. Re-run capture when
 * the feed is showing something you would rather not ship.
 */
const config: GoldieConfig = {
  appRoot: APP_ROOT,
  appPath:
    "/private/tmp/claude-501/-Users-odunsi-Workspace-news-spend/18fa2ac7-5fee-4d58-a943-68c84e129cd0/scratchpad/appbuild/NewsSpend.app",
  bundleId: "com.newsspend.app",

  // Google Play phone screenshots (1080x1920), captured on a Pixel 9 Pro AVD.
  // APK from `eas build --profile screenshots --platform android`.
  android: {
    appPath:
      "/private/tmp/claude-501/-Users-odunsi-Workspace-news-spend/18fa2ac7-5fee-4d58-a943-68c84e129cd0/scratchpad/appbuild/NewsSpend.apk",
    applicationId: "com.newsspend.app",
  },

  devices: ["iphone-6.9", "pixel-10-pro"],
  locales: ["en-US"],
  appearance: "light",

  frame: { variant: "17-pro-blue" },

  theme: {
    background:
      "linear-gradient(160deg, #0B1F3A 0%, #123057 45%, #1E4E8C 100%)",
    headlineColor: "#FFFFFF",
    subheadColor: "#B9C7DA",
    fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
    copyHeightRatio: 0.24,
    deviceWidthRatio: 0.84,
    // Straight-on device, full screen visible in every tile. The app-store
    // rejection was about screenshots "not showing the app in use", so the
    // marketing tilt/panorama layouts are deliberately avoided here.
    layout: "classic",
  },

  store: {
    name: "News Spend",
    subtitle: { "en-US": "News that pays you back" },
    developer: "News Spend Media",
    category: "News",
    rating: 4.7,
    ratingCount: "1.1K Ratings",
    ageRating: "12+",
    price: "Free",
    description: {
      "en-US":
        "Stay on top of the day's headlines and get rewarded for it. Read the news, explore apps and surveys, and enter giveaways for real prizes — then turn your points into cash back at the stores you already shop.",
    },
  },

  scenes: [
    {
      kind: "screenshot",
      id: "home",
      flow: "store-01-home",
      headline: { "en-US": "Today's news, in one place" },
      subhead: { "en-US": "Headlines across politics, business, sport and more, updated all day." },
    },
    {
      kind: "screenshot",
      id: "article",
      flow: "store-02-article",
      headline: { "en-US": "The full story, fast" },
      subhead: { "en-US": "Key points up top, the detail below, sources attached." },
    },
    {
      kind: "screenshot",
      id: "points",
      flow: "store-03-points",
      headline: { "en-US": "Get paid to explore" },
      subhead: { "en-US": "Apps, games, books and surveys — every one earns points." },
    },
    {
      kind: "screenshot",
      id: "shop",
      flow: "store-05-shop",
      headline: { "en-US": "Cash back when you shop" },
      subhead: { "en-US": "Earn at the stores you already use." },
    },
    {
      kind: "preview",
      id: "preview",
      segments: [
        { id: "open", flow: "store-preview-01-open" },
        { id: "read", flow: "store-preview-02-read" },
        { id: "earn", flow: "store-preview-03-earn" },
        { id: "win", flow: "store-preview-04-win", holdSeconds: 2 },
      ],
    },
  ],
};

export default config;
