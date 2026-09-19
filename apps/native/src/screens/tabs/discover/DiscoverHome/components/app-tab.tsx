import type { LegendListRenderItemProps } from "@legendapp/list/react-native";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { TabLegendList } from "react-native-collapsible-tab/legend-list";
import { Text } from "#/components/heroui/text";
import { usePartnerClick } from "#/hooks/usePartnerClick";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc } from "#/lib/orpc";
import { useTabBarHeight } from "#/state/route-state";
import { AppItem } from "./app-item";
import {
  PullToRefreshIndicator,
  triggerRefreshHaptic,
} from "./pull-to-refresh-indicator";

export const AppTab = () => {
  const { handleClick, isLoading } = usePartnerClick();
  const tabBarHeight = useTabBarHeight();

  const queryOptions = orpc.partnerContent.filtered.infiniteOptions({
    input: (pageParam: number | undefined) => ({
      limit: 5,
      type: ["app"],
      placement: ["points-mall-apps"],
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
  const appsData = useMemo(
    () => data?.pages.flatMap((page) => page.docs) || [],
    [data]
  );

  const renderItem = useCallback(
    (props: LegendListRenderItemProps<PartnerContent>) => {
      const { item } = props;

      return (
        <AppItem
          item={item}
          loading={isLoading(item.id)}
          onPress={() => console.log(item)}
        />
      );
    },
    [isLoading]
  );

  const keyExtractor = useCallback((item: PartnerContent) => item.id, []);

  const emptyList = useCallback(
    () => (
      <View className="flex-1 items-center justify-center">
        <Text className="text-base">No apps found</Text>
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
    () => (
      <View className="flex-1 items-center justify-center">
        {isFetchingNextPage ? <ActivityIndicator /> : null}
      </View>
    ),
    [isFetchingNextPage]
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
        contentContainerStyle={{ paddingBottom: tabBarHeight }}
        data={appsData}
        estimatedItemSize={90}
        keyExtractor={keyExtractor}
        ListEmptyComponent={emptyList}
        ListFooterComponent={footer}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
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
};
