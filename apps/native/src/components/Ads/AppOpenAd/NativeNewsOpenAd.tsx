import { Spinner } from "heroui-native/spinner";
import { useEffect } from "react";
import { Image, View } from "react-native";
import {
  type NativeAd,
  NativeAdEventType,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";
import { Button } from "../../heroui/button";
import { Text } from "../../heroui/text";

const NativeNewsOpenAd = ({
  nativeAd,
  loading,
  error,
}: {
  nativeAd: NativeAd | undefined;
  loading: boolean;
  error: boolean;
}) => {
  useEffect(() => {
    if (!nativeAd) {
      return;
    }
    nativeAd.addAdEventListener(NativeAdEventType.IMPRESSION, () =>
      console.debug("Native ad impression")
    );
    nativeAd.addAdEventListener(NativeAdEventType.CLICKED, () =>
      console.debug("Native ad clicked")
    );
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_PLAYED, () =>
      console.debug("Native ad video played")
    );
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_PAUSED, () =>
      console.debug("Native ad video paused")
    );
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_ENDED, () =>
      console.debug("Native ad video ended")
    );
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_MUTED, () =>
      console.debug("Native ad video muted")
    );
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_UNMUTED, () =>
      console.debug("Native ad video unmuted")
    );
    return () => nativeAd.destroy();
  }, [nativeAd]);

  if (!nativeAd) {
    if (loading && !error) {
      return (
        <View className="z-30 h-full w-full items-center gap-9 rounded-t-2xl bg-background py-2">
          <Text className="text-center font-medium">Advertisement</Text>
          <Spinner />
        </View>
      );
    }
    return null;
  }

  return (
    <NativeAdView
      className="bg-background"
      nativeAd={nativeAd}
      style={{
        zIndex: 3,
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Text className="px-2 pt-2 pb-4 text-center font-medium">
        Advertisement
      </Text>

      <View className="min-h-50 px-2">
        <NativeMediaView />
        <Text className="my-3 self-start border border-p-400 px-px font-medium">
          Ad
        </Text>
      </View>

      <View className="gap-2 p-4">
        <View className="items-center justify-center gap-2">
          {nativeAd.icon && (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                height={100}
                source={{ uri: nativeAd.icon.url }}
                width={100}
              />
            </NativeAsset>
          )}
          {nativeAd.advertiser && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text className="text-center font-medium">
                {nativeAd.advertiser}
              </Text>
            </NativeAsset>
          )}
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text className="text-center font-bold text-lg">
              {nativeAd.headline}
            </Text>
          </NativeAsset>
        </View>
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text className="text-center font-medium">{nativeAd.body}</Text>
        </NativeAsset>
      </View>

      {/*<View className="my-1.5 h-px bg-separator" />*/}

      <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
        <Button className="mx-4 mt-4" onPress={() => {}}>
          {nativeAd.callToAction}
        </Button>
      </NativeAsset>
    </NativeAdView>
  );
};

export default NativeNewsOpenAd;
