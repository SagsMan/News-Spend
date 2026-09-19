import { proxy } from "valtio";

import type { AdPlacement } from "./adManager";

type AppOpenAdSheetState = {
  isOpen: boolean;
  customAdReady?: boolean;
  nativeAdReady?: boolean;
  adType: "custom" | "native";
  placement: AdPlacement;
  onCloseCallback?: undefined | (() => void);
  open: (placement: AdPlacement, onCloseCallback?: () => void) => void;
  close: () => void;
};

export const appOpenAdSheetState = proxy<AppOpenAdSheetState>({
  isOpen: false,
  onCloseCallback: undefined,
  customAdReady: false,
  nativeAdReady: false,
  adType: Math.random() < 0.4 ? "custom" : "native",
  placement: "news-click-ads",
  open: (placement, onCloseCallback) => {
    appOpenAdSheetState.placement = placement;
    appOpenAdSheetState.isOpen = true;
    appOpenAdSheetState.onCloseCallback = onCloseCallback;
  },
  close: () => {
    appOpenAdSheetState.isOpen = false;
    appOpenAdSheetState.onCloseCallback?.();
    appOpenAdSheetState.onCloseCallback = undefined;
  },
});

export const setAdType = () => {
  appOpenAdSheetState.adType = Math.random() < 0.4 ? "custom" : "native";
};

export const setCustomAdReady = (ready: boolean) => {
  appOpenAdSheetState.customAdReady = ready;
};

export const setNativeAdReady = (ready: boolean) => {
  appOpenAdSheetState.nativeAdReady = ready;
};
