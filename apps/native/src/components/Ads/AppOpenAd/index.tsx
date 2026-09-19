import type { PartnerContent } from "@news-spend-media/payload/types";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { CaretRightIcon } from "#/lib/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { NativeAd } from "react-native-google-mobile-ads";
import { useSnapshot } from "valtio";
import { initializeAdsWhenPermitted } from "#/lib/adsInit";
import { adUnits } from "#/lib/adUnits";
import { type AdPlacement, consumeAd } from "#/state/adManager";
import {
  appOpenAdSheetState,
  setAdType,
  setNativeAdReady,
} from "#/state/appOpenAdState";
import { Button } from "../../heroui/button";
import { Icon } from "../../heroui/icon";
import CustomNewsOpenAd from "./CustomNewsOpenAd";
import NativeNewsOpenAd from "./NativeNewsOpenAd";

const AppOpenAd = () => {
  const { isOpen, adType, placement } = useSnapshot(appOpenAdSheetState);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nativeAd, setNativeAd] = useState<NativeAd | undefined>();
  const [customAd, setCustomAd] = useState<PartnerContent | null>(null);
  const consumedPlacementRef = useRef<AdPlacement | null>(null);

  useEffect(() => {
    if (isOpen && consumedPlacementRef.current !== placement) {
      consumedPlacementRef.current = placement;
      setCustomAd(consumeAd(placement));
    }
    if (!isOpen) {
      consumedPlacementRef.current = null;
      setCustomAd(null);
    }
  }, [isOpen, placement]);

  const loadAd = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await initializeAdsWhenPermitted();
      const ad = await NativeAd.createForAdRequest(adUnits.native, {});
      setNativeAd(ad);
      setNativeAdReady(true);
    } catch {
      setError(true);
      setNativeAdReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen && adType === "native") {
      setNativeAdReady(false);
      loadAd();
      setAdType();
    }
  }, [isOpen, adType, loadAd]);

  useEffect(() => {
    const onBackPress = () => {
      if (isOpen) {
        appOpenAdSheetState.close();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [isOpen]);

  const onClose = useCallback(() => {
    appOpenAdSheetState.close();
  }, []);

  const renderAd = () => {
    if (!isOpen) {
      return null;
    }
    if (adType === "custom") {
      if (customAd) {
        return <CustomNewsOpenAd ad={customAd} />;
      }
      if (nativeAd) {
        return (
          <NativeNewsOpenAd
            error={error}
            loading={loading}
            nativeAd={nativeAd}
          />
        );
      }
    } else if (adType === "native") {
      if (nativeAd) {
        return (
          <NativeNewsOpenAd
            error={error}
            loading={loading}
            nativeAd={nativeAd}
          />
        );
      }
      if (customAd) {
        return <CustomNewsOpenAd ad={customAd} />;
      }
    }
    return null;
  };

  return (
    <BottomSheet isOpen={isOpen}>
      {/*<BottomSheet.Trigger asChild>
        <Button variant="secondary">Open Bottom Sheet</Button>
      </BottomSheet.Trigger>*/}
      {/* disableFullWindowOverlay in dev: default FullWindowOverlay renders in
      a separate native window and blocks the RN element inspector. */}
      <BottomSheet.Portal disableFullWindowOverlay={__DEV__}>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          backgroundClassName="bg-transparent rounded-none"
          contentContainerClassName="p-0"
          contentContainerProps={{
            style: StyleSheet.absoluteFill,
          }}
          enableDynamicSizing={false}
          enableOverDrag={false}
          enablePanDownToClose={false}
          handleComponent={null}
          snapPoints={["95%"]}
        >
          <View className="flex-1 gap-3">
            <View className="gap-3">
              <Button
                className="w-[80%] justify-end self-end bg-white"
                onPress={onClose}
                size="sm"
                variant="tertiary"
              >
                <Button.Label>Continue</Button.Label>
                <Icon name={CaretRightIcon} size={20} />
              </Button>
            </View>
            <View className="flex-1 bg-white">{renderAd()}</View>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};

export default AppOpenAd;
