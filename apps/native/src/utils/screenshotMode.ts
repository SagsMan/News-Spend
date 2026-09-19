/**
 * Screenshot capture mode.
 *
 * Set `EXPO_PUBLIC_SCREENSHOT_MODE=1` (the `screenshots` EAS build profile
 * does this) to suppress every ad surface — the Mobile Ads SDK is never
 * initialised, and each ad component renders nothing. Used only to produce
 * clean App Store marketing screenshots; it has no effect on any shipping
 * build.
 */
export const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === "1";
