import {
  LegendList,
  type LegendListRef,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { useScrollToTop } from "@react-navigation/native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Separator } from "heroui-native/separator";
import { Spinner } from "heroui-native/spinner";
import type { ComponentRef, JSX, RefObject } from "react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import { subscribeKey } from "valtio/utils";
import type { AdCarouselRef } from "#/components/Ads/AdCarousel";
import AdCarousel from "#/components/Ads/AdCarousel";
import NewsItemAd from "#/components/Ads/NewsItemAd";
import type { NewsItemGoogleAdRef } from "#/components/Ads/NewsItemGoogleAd";
import NewsItemGoogleAds from "#/components/Ads/NewsItemGoogleAd";
import { useNewsAnalytics } from "#/hooks/news/useNewsAnalytics";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc, type RouterOutputs } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import { routeState, useTabBarHeight } from "#/state/route-state";
import { clearTabAdCache } from "#/utils/ad-cache";
import HomeListHeader from "../HomeListHeader";
import HomeListSkeleton from "../HomeListSkeleton";
import NewsItem from "../NewsItem";
import RelatedNews from "../RelatedNews";
import RewardTaskItemCard from "../RewardTaskItem";

type ItemType = RouterOutputs["news"]["home"]["docs"][number];

// Stable empty fallbacks. Inline `?? []` would mint a new identity every
// render and defeat MemoizedListHeader's memo.
const EMPTY_DOCS: RouterOutputs["news"]["home"]["docs"] = [];
const EMPTY_BOOKS: PartnerContent[] = [];

/**
 * Drives the feed's mechanics — pausing a carousel that scrolled away and
 * preloading the next Google ad slots. Deliberately loose and immediate:
 * these want to fire as early as possible, and delaying a preload leaves an
 * ad slot blank for longer.
 */
const MECHANICS_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 40,
};

/**
 * Drives impression counting, and follows the IAB display standard: at least
 * 50% of the item on screen for at least one continuous second.
 *
 * Separate from the config above because the two want opposite things. An
 * impression has to be earned — the old shared 40%-and-no-dwell rule counted
 * anything that swept past during a fast scroll, which inflates the
 * denominator of every rate computed from it. Ad impressions, when they land,
 * belong on this config rather than a fourth one: a number that is billed
 * against has to survive an advertiser measuring it themselves.
 */
const IMPRESSION_VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 1000,
};

/**
 * Only the fields the impression callback reads. The feed is a union of
 * articles, ads and injected rows, and naming the whole union here would
 * couple this file to the composer's output type for no benefit.
 */
type ImpressionToken = {
  index: number;
  isViewable: boolean;
  item?: { type?: string | null; id?: string; slug?: string | null } | null;
};

const MemoizedListHeader = memo(
  ({
    news,
    specialCoverage,
    books,
  }: {
    news: RouterOutputs["news"]["home"]["docs"];
    specialCoverage: RouterOutputs["news"]["home"]["docs"];
    books: PartnerContent[];
  }) => (
    <HomeListHeader
      books={books}
      news={news}
      specialCoverage={specialCoverage}
    />
  )
);

const MemoizedSeparator = memo(() => <Separator className="m-3" />);

const Latest = memo(({ ref }: { ref: RefObject<LegendListRef> }) => {
  const mediaRefs = useRef<(AdCarouselRef | null)[]>([]);
  // Keyed by ad item id: stable across recycles, unlike positional arrays
  const gBannerRefs = useRef<Map<string, NewsItemGoogleAdRef>>(new Map());
  const tabBarHeight = useTabBarHeight();
  const { trackImpression } = useNewsAnalytics();
  const trackImpressionRef = useRef(trackImpression);
  useEffect(() => {
    trackImpressionRef.current = trackImpression;
  }, [trackImpression]);

  // Stable ref to feed data for use inside onViewableItemsChanged without
  // needing to re-create the callback on every render.
  const flattenedNewsRef = useRef<
    RouterOutputs["news"]["home"]["docs"] | undefined
  >(undefined);
  const previousTabName = useRef(routeState.tabName);
  useEffect(() => {
    const unsubscribe = subscribeKey(routeState, "tabName", (v) => {
      if (
        v !== previousTabName.current &&
        previousTabName.current === "latest"
      ) {
        for (const mediaRef of mediaRefs.current) {
          try {
            mediaRef?.pause();
          } catch {}
        }
      }
      previousTabName.current = v;
    });
    return unsubscribe;
  }, []);

  const {
    data: news,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isPending,
    refetch,
  } = useInfiniteQuery(
    orpc.news.home.infiniteOptions({
      input: (pageParam: number | undefined) => ({
        limit: 10,
        page: pageParam,
      }),
      getNextPageParam: (lastPage) => lastPage.nextPage,
      initialPageParam: undefined,
      staleTime: 5 * 60 * 1000, // 5 min, prevents refetch on tab switch
      gcTime: 10 * 60 * 1000, // 10 min, keeps cached data in memory
    })
  );

  const partnerContent = useQuery(
    orpc.partnerContent.filtered.queryOptions({
      input: {
        placement: ["homepage-trending-books"],
        status: "active",
        limit: 12,
        page: 1,
      },
    })
  );

  const flattenedPartnerContent = partnerContent?.data?.docs;

  const trendingNews = useQuery(
    orpc.news.trending.queryOptions({ input: { limit: 3 } })
  );

  // Articles already shown in the trending carousel shouldn't also appear
  // further down in the Latest list.
  const trendingIds = useMemo(
    () => new Set(trendingNews.data?.map((item) => item.id)),
    [trendingNews.data]
  );

  const flattenedNews = useMemo(() => {
    const docs = news?.pages.flatMap((page) => page.docs);
    if (!docs || trendingIds.size === 0) {
      return docs;
    }
    return docs.filter(
      (item) =>
        !(
          item &&
          "type" in item &&
          (item.type === "article" || item.type === "video") &&
          trendingIds.has(item.id)
        )
    );
  }, [news, trendingIds]);
  flattenedNewsRef.current = flattenedNews;

  // id → index lookup so the gAd-preload walk in onViewableItemsChanged
  // doesn't do an O(n) findIndex per viewability change.
  const newsIndexByIdRef = useRef<Map<string, number>>(new Map());
  useMemo(() => {
    const map = newsIndexByIdRef.current;
    map.clear();
    flattenedNews?.forEach((item, index) => {
      if (item && "id" in item && item.id) {
        map.set(item.id, index);
      }
    });
  }, [flattenedNews]);

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);
  const trendingRefetch = useRefreshByUser(trendingNews.refetch);

  // #region Callbacks
  const resetInfiniteQueryPagination = useCallback(() => {
    const qKey = orpc.news.home.infiniteKey({
      input: (pageParam: number | undefined) => ({
        limit: 10,
        page: pageParam,
      }),
      initialPageParam: undefined,
    });

    queryClient.setQueryData(qKey, (oldData) => {
      if (!oldData) {
        return;
      }

      return {
        pages: oldData.pages.slice(0, 1),
        pageParams: oldData.pageParams.slice(0, 1),
      };
    });
  }, []);

  const keyExtractor = useCallback(
    (item: RouterOutputs["news"]["home"]["docs"][0], index: number) =>
      // Never fall back to a shared constant key; with recycleItems, duplicate
      // keys make recycled cells bleed state between items.
      item?.id ?? `${item && "_type" in item ? item._type : "item"}-${index}`,
    []
  );

  const handleRefresh = useCallback(() => {
    resetInfiniteQueryPagination();
    refetchByUser();
    trendingRefetch.refetchByUser();
    clearTabAdCache("latest");
    gBannerRefs.current.clear();
  }, [
    resetInfiniteQueryPagination,
    refetchByUser,
    trendingRefetch.refetchByUser,
  ]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage]);

  /**
   * Rough heights per row type, in px.
   *
   * The feed mixes article rows, full-width ad carousels, Google banners and
   * reward cards, whose heights differ by several multiples. Without an
   * estimate LegendList guesses one size for all of them, which is what
   * produces the scroll-position jumps and blank frames during a fast scroll.
   * These do not need to be exact — they need to be in the right range.
   */
  const getEstimatedItemSize = useCallback((_index: number, item: ItemType) => {
    const type = item && "type" in item ? item.type : undefined;
    const kind = item && "_type" in item ? item._type : undefined;

    if (type === "adCarousel") {
      return 260;
    }
    if (type === "gAd") {
      return 120;
    }
    if (kind === "relatedNews") {
      return 220;
    }
    if (kind === "rewardTask") {
      return 140;
    }
    // Article and video rows: a 100px thumbnail plus padding.
    return 116;
  }, []);

  const getItemType = useCallback(
    (item) =>
      item?._type === "ad" && item?.type === "adCarousel"
        ? `adCarousel-${item?.videoSource}`
        : (item?.type ?? item?._type),
    []
  );

  const renderItem = useCallback(
    ({
      item,
      index,
    }: LegendListRenderItemProps<
      RouterOutputs["news"]["home"]["docs"][number]
    >) => {
      let content: JSX.Element | null = null;

      if (
        item &&
        "type" in item &&
        (item.type === "article" || item.type === "video")
      ) {
        content = <NewsItem latest news={item} />;
      } else if (item && "_type" in item && item._type === "relatedNews") {
        content = <RelatedNews news={"data" in item ? item.data : undefined} />;
      } else if (item && "type" in item && item.type === "adCarousel") {
        content = (
          <AdCarousel
            item={"payload" in item ? item.payload : undefined}
            listRef={(itemRef: ComponentRef<typeof AdCarousel> | null) => {
              mediaRefs.current[index] = itemRef;
            }}
          />
        );
      } else if (item && "_type" in item && item._type === "ad") {
        if ("type" in item && item.type === "gAd") {
          content = (
            <NewsItemGoogleAds
              index={index}
              item={item}
              ref={(itemRef: NewsItemGoogleAdRef | null) => {
                if (itemRef && item.id) {
                  gBannerRefs.current.set(item.id, itemRef);
                } else if (!itemRef && item.id) {
                  gBannerRefs.current.delete(item.id);
                }
              }}
              tab="latest"
            />
          );
        } else {
          content = <NewsItemAd index={index} item={item} />;
        }
      } else if (item && "_type" in item && item._type === "rewardTask") {
        content = <RewardTaskItemCard item={item} />;
      } else {
        content = null;
      }

      return <View className="px-3">{content}</View>;
    },
    []
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

  const onViewableItemsChanged = useRef(({ changed }) => {
    for (const item of changed) {
      if (item.item.type === "adCarousel") {
        const cell = mediaRefs?.current[item.index];
        if (!item.isViewable && cell) {
          cell?.pause();
        }
      }

      // When a gAd becomes visible, preload the next 2 gAd slots ahead by
      // walking the feed data. Refs are registered by id so position-safe.
      if (
        item.isViewable &&
        item.item?._type === "ad" &&
        item.item?.type === "gAd" &&
        item.item?.id
      ) {
        const feed = flattenedNewsRef.current;
        if (feed) {
          const startIdx = newsIndexByIdRef.current.get(item.item.id) ?? -1;
          let preloaded = 0;
          for (let i = startIdx + 1; i < feed.length && preloaded < 2; i++) {
            const next = feed[i];
            if (
              next &&
              "_type" in next &&
              next._type === "ad" &&
              "type" in next &&
              next.type === "gAd" &&
              "id" in next &&
              next.id
            ) {
              const nextRef = gBannerRefs.current.get(next.id);
              if (nextRef && !nextRef.isAdLoaded()) {
                nextRef.loadAd();
                preloaded++;
              }
            }
          }
        }
      }
    }
  });

  // Paired with IMPRESSION_VIEWABILITY_CONFIG, so `isViewable` here already
  // means 50%-for-a-second rather than merely on screen.
  const onImpressionItemsChanged = useRef(
    ({ changed }: { changed: ImpressionToken[] }) => {
      for (const item of changed) {
        if (
          item.isViewable &&
          item.item &&
          "type" in item.item &&
          (item.item.type === "article" || item.item.type === "video") &&
          item.item.id
        ) {
          trackImpressionRef.current(
            { id: item.item.id, slug: item.item.slug },
            item.index,
            "HomeFeed"
          );
        }
      }
    }
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: MECHANICS_VIEWABILITY_CONFIG,
      onViewableItemsChanged: onViewableItemsChanged.current,
    },
    {
      viewabilityConfig: IMPRESSION_VIEWABILITY_CONFIG,
      onViewableItemsChanged: onImpressionItemsChanged.current,
    },
  ]);
  // #endregion
  useScrollToTop(ref);

  // Emits nav_tti for /Tab/Home/NewsHome once the feed has rendered.
  useMarkInteractive(!isPending);

  // Only the main feed gates first paint. The header-only queries (video
  // news, partner books, trending) stream into their sections when ready.
  if (isPending) {
    return <HomeListSkeleton />;
  }

  return (
    <LegendList
      contentContainerStyle={{
        paddingBottom: tabBarHeight + 20,
        paddingTop: 15,
      }}
      data={flattenedNews}
      getEstimatedItemSize={getEstimatedItemSize}
      getItemType={getItemType}
      ItemSeparatorComponent={MemoizedSeparator}
      keyExtractor={keyExtractor}
      ListFooterComponent={FooterItem}
      ListHeaderComponent={
        <MemoizedListHeader
          books={flattenedPartnerContent ?? EMPTY_BOOKS}
          news={trendingNews.data ?? EMPTY_DOCS}
          /**
           * Always empty: Special Coverage is video news, and video is
           * switched off server-side — the News collection offers only
           * "article" and its beforeValidate hook refuses anything else, so
           * the `useAllNews({ type: "video" })` that used to feed this could
           * only ever return zero rows. It was an infinite query firing on
           * every mount of the home feed for a section that renders `null`
           * when empty. Switch video back on in the News collection and
           * restore that hook to bring the section back.
           */
          specialCoverage={EMPTY_DOCS}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      onRefresh={handleRefresh}
      recycleItems
      ref={ref}
      refreshing={isRefetchingByUser}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      // suggestEstimatedItemSize
      viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
    />
  );
});

export default Latest;
