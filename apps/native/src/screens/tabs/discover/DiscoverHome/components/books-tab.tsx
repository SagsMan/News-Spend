import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { cn } from "heroui-native/utils";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { TabLegendList } from "react-native-collapsible-tab/legend-list";

import { Text } from "#/components/heroui/text";
import { Image } from "#/components/ui";
import { usePartnerClick } from "#/hooks/usePartnerClick";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc } from "#/lib/orpc";
import { useTabBarHeight } from "#/state/route-state";
import { getImageData } from "#/utils/getImageData";
import {
  PullToRefreshIndicator,
  triggerRefreshHaptic,
} from "./pull-to-refresh-indicator";

const ITEM_HEIGHT = 280;

function BooksTabComponent() {
  const { handleClick, isLoading } = usePartnerClick();
  const tabBarHeight = useTabBarHeight();

  const queryOptions = orpc.partnerContent.filtered.infiniteOptions({
    input: (pageParam: number | undefined) => ({
      limit: 6,
      type: ["book"],
      placement: ["points-mall-books"],
      page: pageParam,
    }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const {
    data,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery(queryOptions);

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);
  const flatData = useMemo(
    () => data?.pages.flatMap((page) => page.docs) ?? [],
    [data]
  );

  const renderItem = useCallback(
    (props: LegendListRenderItemProps<PartnerContent>) => {
      const { item } = props;
      const { blurhash, url } = getImageData(item.media);
      const loading = isLoading(item.id);

      return (
        <PressableFeedback onPress={() => handleClick(item)}>
          <PressableFeedback.Scale>
            <View className={cn("overflow-hidden", loading && "opacity-70")}>
              <Image
                className="rounded-lg"
                contentFit="cover"
                placeholder={{ blurhash }}
                source={{ uri: url ?? "" }}
                style={{ aspectRatio: 0.85, width: "100%" }}
              />
              <View className="mt-2 flex-row items-center gap-2">
                <Text
                  className="flex-1 font-semibold text-gray-500 text-sm italic"
                  numberOfLines={2}
                >
                  {item.condition}
                </Text>
                {loading ? (
                  <ActivityIndicator color="#666" size="small" />
                ) : null}
              </View>
            </View>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>
      );
    },
    [handleClick, isLoading]
  );

  const keyExtractor = useCallback((item: PartnerContent) => item.id, []);

  const emptyList = useCallback(
    () => (
      <View className="flex-1 items-center justify-center">
        <Text className="text-base">No books found</Text>
      </View>
    ),
    []
  );

  const onEndReached = useCallback(() => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const footer = useCallback(
    () =>
      hasNextPage ? (
        <View className="items-center py-4">
          <ActivityIndicator />
        </View>
      ) : null,
    [hasNextPage]
  );

  const onRefresh = useCallback(() => {
    refetchByUser();
  }, [refetchByUser]);

  if (isPending) {
    return <ActivityIndicator />;
  }

  return (
    <View className="flex-1">
      <TabLegendList
        contentContainerStyle={{
          paddingTop: 10,
          paddingBottom: 10 + tabBarHeight,
          gap: 25,
          paddingHorizontal: 12,
        }}
        data={flatData}
        estimatedItemSize={ITEM_HEIGHT}
        keyExtractor={keyExtractor}
        ListEmptyComponent={emptyList}
        ListFooterComponent={footer}
        numColumns={2}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={onRefresh}
        onScrollEndDrag={(e) => {
          if (Platform.OS === "ios") {
            const pull = -e.nativeEvent.contentOffset.y;
            if (pull >= 80) {
              triggerRefreshHaptic();
              refetchByUser();
            }
          }
        }}
        recycleItems={false}
        renderItem={renderItem}
        style={{
          paddingHorizontal: 12,
        }}
        {...(Platform.OS === "android"
          ? {
              onRefresh,
              progressViewOffset: 0,
              refreshing: isRefetchingByUser,
            }
          : {})}
      />
      <PullToRefreshIndicator refreshing={isRefetchingByUser} />
    </View>
  );
}

export const BooksTab = BooksTabComponent;
