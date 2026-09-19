import { useEffect } from "react";
import { useRewardedInterstitialAd } from "react-native-google-mobile-ads";

import { initializeAdsWhenPermitted } from "#/lib/adsInit";
import { adUnits } from "#/lib/adUnits";

type UseGoogleAdOptions = {
  onRewarded?: () => void;
  onClosed?: () => void;
};

type UseGoogleAdReturn = {
  isLoaded: boolean;
  show: () => void;
  load: () => void;
};

/**
 * Wraps the Google rewarded interstitial ad lifecycle.
 * Automatically reloads after the ad closes.
 * Fires `onRewarded` if the user earned a reward, `onClosed` in either case.
 */
export function useGoogleAd({
  onRewarded,
  onClosed,
}: UseGoogleAdOptions = {}): UseGoogleAdReturn {
  const { isLoaded, isClosed, load, show, isEarnedReward } =
    useRewardedInterstitialAd(adUnits.rewardedInterstitial);

  useEffect(() => {
    let cancelled = false;
    initializeAdsWhenPermitted()
      .then(() => {
        if (!cancelled) {
          load();
        }
      })
      .catch((error) => {
        console.warn("Ad initialization failed", error);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!isClosed) {
      return;
    }
    if (isEarnedReward) {
      onRewarded?.();
    }
    onClosed?.();
    load();
  }, [isClosed, isEarnedReward, onRewarded, onClosed, load]);

  return { isLoaded, show, load };
}
