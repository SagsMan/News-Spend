import type { PartnerContent } from "@news-spend-media/payload/types";
import { memo, useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";

import { usePartnerClick } from "#/hooks/usePartnerClick";
import { getImageData } from "#/utils/getImageData";
import { getCtaLabel } from "#/utils/index";
import { SCREENSHOT_MODE } from "#/utils/screenshotMode";
import { Image } from "../heroui/image";
import { Text } from "../heroui/text";

function NewsItemAds({
  item,
  index,
  fromFallback,
}: {
  item: {
    _type: string;
    id: string;
    payload: PartnerContent;
  };
  index?: number;
  fromFallback?: boolean;
}) {
  const imageData = useMemo(
    () => getImageData(item?.payload?.media),
    [item?.payload?.media]
  );
  const { url, blurhash } = imageData;

  const partnerContent = item.payload;
  const { handleClick } = usePartnerClick();

  /**
   * Routed through usePartnerClick rather than opening the URL directly. A
   * CPA partner's click has to be recorded and its clickId appended before
   * the link opens, or the postback lands with nothing to attribute it to.
   * The hook also decides in-app browser vs leaving for the store.
   */
  const onPress = useCallback(
    () => handleClick(partnerContent),
    [handleClick, partnerContent]
  );

  // Memoize partner name to prevent recalculation
  const partnerName = useMemo(
    () =>
      typeof partnerContent?.partner === "string"
        ? partnerContent.partner
        : partnerContent?.partner?.companyName,
    [partnerContent?.partner]
  );

  // Memoize CTA label
  const ctaLabel = useMemo(
    () => getCtaLabel(partnerContent?.cta),
    [partnerContent?.cta]
  );

  return (
    <Pressable className="gap-2.5" onPress={onPress}>
      <View className="flex-row gap-4">
        <Image
          className="size-25 rounded-[10px]"
          contentFit="cover"
          placeholder={{
            blurhash,
          }}
          placeholderContentFit="cover"
          recyclingKey={item.id}
          source={url}
        />
        <View className="flex-1 justify-center gap-4">
          <View className="flex-row justify-between gap-2">
            <Text
              className="flex-1 font-bold text-p-500"
              ellipsizeMode="tail"
              numberOfLines={2}
            >
              {partnerContent.title}
            </Text>
            <Text className="shrink-0 self-start rounded-sm border border-gray-50 px-1 text-s-300">
              Ad
            </Text>
          </View>
          <Text ellipsizeMode="tail" numberOfLines={2}>
            {partnerContent.condition || ""}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-p-500">{partnerName}</Text>
            <Text className="rounded-full bg-s-300 px-2 py-1 text-white text-xs">
              {ctaLabel}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const MemoNewsItemAds = memo(NewsItemAds);

export default function NewsItemAdsGated(
  props: Parameters<typeof NewsItemAds>[0]
) {
  if (SCREENSHOT_MODE) {
    return null;
  }
  return <MemoNewsItemAds {...props} />;
}
