import { LegendList, type LegendListRef } from "@legendapp/list/react-native";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import { memo, useCallback, useRef } from "react";
import { View } from "react-native";
import NewsItemAds from "#/components/Ads/NewsItemAd";
import NewsItemGoogleAds, {
  type NewsItemGoogleAdRef,
} from "#/components/Ads/NewsItemGoogleAd";
import { useAllNews } from "#/hooks/news";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { useTabBarHeight } from "#/state/route-state";
import { clearTabAdCache } from "#/utils/ad-cache";
import { SCREENSHOT_MODE } from "#/utils/screenshotMode";
import NewsItem from "../NewsItem";
import NewsItemPlaceholder from "../NewsItemPlaceholder";

const MemoizedSeparator = memo(() => <Separator className="m-3" />);

type NewType = React.RefObject<LegendListRef>;

const NewsCategory = ({ route, ref }: { route: string; ref?: NewType }) => {
  const tabBarHeight = useTabBarHeight();
  const gBannerRefs = useRef<Map<string, NewsItemGoogleAdRef>>(new Map());
  const { data, isPending, refetch, fetchNextPage, isFetching, hasNextPage } =
    useAllNews({
      category: route,
      ad: !SCREENSHOT_MODE,
    });

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(() => {
    refetch();
    clearTabAdCache(route);
    gBannerRefs.current.clear();
  });

  const flattenedNewsRef = useRef<any[] | undefined>(undefined);

  const renderItem = useCallback(
    ({ item, index }) => {
      if (item._type === "ad") {
        if (item.type === "gAd") {
          const adId = item.id ?? item._id;
          return (
            <NewsItemGoogleAds
              index={index}
              item={item}
              ref={(itemRef) => {
                if (itemRef && adId) {
                  gBannerRefs.current.set(adId, itemRef);
                } else if (!itemRef && adId) {
                  gBannerRefs.current.delete(adId);
                }
              }}
              tab={route}
            />
          );
        }
        if (item.type === "inHouse") {
          return <NewsItemAds item={item} />;
        }
        return null;
      }
      if (item.type === "article") {
        return <NewsItem news={item} />;
      }
      return null;
    },
    [route]
  );

  const FooterItem = useCallback(
    () =>
      hasNextPage && isFetching ? (
        <View className="flex items-center justify-center py-4">
          <Spinner size="lg" />
        </View>
      ) : null,
    [hasNextPage, isFetching]
  );

  const onEndReached = () => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  };

  const keyExtractor = useCallback((item) => item._id ?? item.id, []);
  const flattenedNews = data?.pages.flatMap((page) => page.docs);
  flattenedNewsRef.current = flattenedNews;

  if (isPending) {
    return <NewsItemPlaceholder show />;
  }

  return (
    <LegendList
      contentContainerStyle={{
        paddingBottom: tabBarHeight + 20,
        paddingTop: 15,
        paddingHorizontal: 10,
      }}
      data={flattenedNews}
      // getEstimatedItemSize={() => 127}
      getItemType={(item) => item?.type ?? item?._type}
      ItemSeparatorComponent={MemoizedSeparator}
      keyExtractor={keyExtractor}
      ListFooterComponent={FooterItem}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      onRefresh={refetchByUser}
      recycleItems
      ref={ref}
      refreshing={isRefetchingByUser}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
    // </Stack>
  );
};

export default memo(NewsCategory);
