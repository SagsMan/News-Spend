import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";

import { ScreenHeader } from "#/components";
import { Image } from "#/components/heroui/image";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { usePartnerClick } from "#/hooks/usePartnerClick";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc } from "#/lib/orpc";
import { getImageData } from "#/utils/getImageData";

function LuckyAppWall() {
  const _navigation = useNavigation();

  const queryOptions = orpc.partnerContent.random.queryOptions({
    input: {
      placement: ["lucky-app-wall"],
      type: ["app", "book", "survey"],
      limit: 10,
    },
  });

  const { data: items, isPending, refetch } = useQuery(queryOptions);

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  const keyExtractor = useCallback((item: PartnerContent) => item.id, []);

  const emptyList = useCallback(
    () => (
      <View className="h-full items-center justify-center">
        <Text className="text-base">No offers available</Text>
      </View>
    ),
    []
  );

  const onRefresh = useCallback(() => {
    refetchByUser();
  }, [refetchByUser]);

  /**
   * The shared hook, not a local opener.
   *
   * This screen used to call `Linking.openURL` directly, which meant the one
   * surface that produces Featured Offers (section 8) recorded nothing when an offer
   * was opened. Section 8 counts partner-confirmed conversions, a conversion needs a
   * click id, and a click id only exists if `trackClick` ran. No Featured
   * Offer could ever be earned, and Tier 1 and Tier 2, which both require one,
   * were unreachable for everybody.
   *
   * Every other partner surface (the all, books and apps tabs) already uses
   * this hook. This one was the exception.
   */
  const { handleClick } = usePartnerClick();

  const renderAppItem = ({
    item,
  }: LegendListRenderItemProps<PartnerContent>) => {
    const { blurhash, url } = getImageData(item.media);

    return (
      <View
        className="flex-row items-start gap-2 p-3"
        onTouchEnd={() => handleClick(item)}
      >
        <Image
          className="h-20 w-20 rounded-lg"
          contentFit="contain"
          placeholder={{ blurhash }}
          source={{ uri: url ?? "" }}
        />
        <View className="flex-1 gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base" numberOfLines={2}>
              {item.title}
            </Text>
          </View>
          <Text
            className="font-semibold text-gray-50 text-sm italic"
            numberOfLines={2}
          >
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Screen className="pb-safe" statusBarStyle="light">
      <ScreenHeader title="Featured Offers" />

      <View className="flex-1">
        <LegendList
          data={items ?? []}
          estimatedItemSize={100}
          keyExtractor={keyExtractor}
          ListEmptyComponent={emptyList}
          onRefresh={onRefresh}
          recycleItems={false}
          refreshing={isRefetchingByUser}
          renderItem={renderAppItem}
        />
      </View>
    </Screen>
  );
}

export default LuckyAppWall;
