import { memo } from "react";
import {
  BannerAdSize,
  BannerAd as GoogleBannerAd,
} from "react-native-google-mobile-ads";

import { adUnits } from "#/lib/adUnits";
import { getGoogleBannerSize, sizeMap } from "#/utils/ads";
import { SCREENSHOT_MODE } from "#/utils/screenshotMode";

import CustomBannerAd from "./CustomBannerAd";

type BannerSize =
  | "MEDIUM_RECTANGLE"
  | "BANNER"
  | "LARGE_BANNER"
  | "FULL_BANNER"
  | "LEADERBOARD";

type BannerAdsProps = {
  size: BannerSize;
};

function BannerAds({ size }: BannerAdsProps) {
  if (SCREENSHOT_MODE) {
    return null;
  }

  const useGoogleAd = Math.random() < 0.4;

  if (size in sizeMap) {
    return useGoogleAd ? (
      <GoogleBannerAd
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        size={getGoogleBannerSize(size)}
        unitId={adUnits.banner}
      />
    ) : (
      <CustomBannerAd size={size} />
    );
  }

  return (
    <GoogleBannerAd
      size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
      unitId={adUnits.banner}
    />
  );
}

export default memo(BannerAds);
