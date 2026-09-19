import type { AdsBlock as AdBlk } from "@news-spend-media/payload/types";
import { memo } from "react";
import { View } from "react-native";
import BannerAds from "#/components/Ads/BannerAds";

const AdsBlock = memo(function AdsBlock({ value }: { value: AdBlk }) {
  return (
    <View className="my-3 items-center justify-center">
      <BannerAds size={value.type} />
    </View>
  );
});

export default AdsBlock;
