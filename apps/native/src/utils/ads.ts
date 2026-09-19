import type { PartnerContent } from "@news-spend-media/payload/types";
import { BannerAdSize } from "react-native-google-mobile-ads";

export type BannerSize = PartnerContent["adSize"];

export const sizeMap: Record<NonNullable<BannerSize>, BannerAdSize> = {
  MEDIUM_RECTANGLE: BannerAdSize.MEDIUM_RECTANGLE,
  BANNER: BannerAdSize.BANNER,
  LARGE_BANNER: BannerAdSize.LARGE_BANNER,
  FULL_BANNER: BannerAdSize.INLINE_ADAPTIVE_BANNER,
  LEADERBOARD: BannerAdSize.LEADERBOARD,
  ANCHORED_ADAPTIVE: BannerAdSize.INLINE_ADAPTIVE_BANNER,
};

export const getGoogleBannerSize = (size: NonNullable<BannerSize>) =>
  sizeMap[size];

export const getBannerDimensions = (
  size: NonNullable<BannerSize>
): { width: number; height: number } => {
  switch (size) {
    case "MEDIUM_RECTANGLE":
      return { width: 300, height: 250 };
    case "BANNER":
      return { width: 320, height: 50 };
    case "LARGE_BANNER":
      return { width: 320, height: 100 };
    case "FULL_BANNER":
      return { width: 468, height: 60 };
    case "LEADERBOARD":
      return { width: 728, height: 90 };
    default:
      return { width: 320, height: 50 };
  }
};
