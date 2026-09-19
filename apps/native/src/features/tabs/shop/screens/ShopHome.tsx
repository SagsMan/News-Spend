import { LegendList } from "@legendapp/list/react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Tabs } from "heroui-native/tabs";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc } from "#/lib/orpc";
import { useFavoriteStores } from "#/state/favoriteStoreState";
import { useTabBarHeight } from "#/state/route-state";
import ShopItem from "../components/ShopItem";

function ShopHome() {
  const [activeTab, setActiveTab] = useState("allStores");
  const { stores: favorites } = useFavoriteStores();
  const bottomTabBarHeight = useTabBarHeight();

  const {
    data: allStoresData,
    isPending: allStoresPending,
    isLoading: allStoresLoading,
    refetch: refetchAllStores,
    fetchNextPage: fetchNextAllStores,
    hasNextPage: hasNextAllStores,
  } = useInfiniteQuery(
    orpc.store.all.infiniteOptions({
      input: (pageParam: number | undefined) => ({
        page: pageParam,
        limit: 12,
        sortBy: "newest",
      }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextPage,
    })
  );

  const {
    data: popularStores,
    isPending: popularPending,
    refetch: refetchPopular,
  } = useQuery({
    ...orpc.store.popular.queryOptions({
      input: {
        limit: 12,
      },
    }),
    enabled: activeTab === "popular",
  });

  const { refetchByUser, isRefetchingByUser } = useRefreshByUser(() => {
    if (activeTab === "allStores") {
      refetchAllStores();
    } else if (activeTab === "popular") {
      refetchPopular();
    }
  });

  const allStores = allStoresData?.pages.flatMap((page) => page.docs) ?? [];

  // Emits nav_tti for /Tab/Shop/ShopHome once the default tab's stores load.
  useMarkInteractive(!allStoresPending);

  return (
    <Screen className="bg-white" preset="fixed" statusBarStyle="light">
      <Tabs
        className="mx-2 flex-1 pt-4"
        onValueChange={setActiveTab}
        value={activeTab}
        variant="primary"
      >
        <Tabs.List className="w-full justify-between rounded-lg">
          <Tabs.Indicator className="rounded-lg bg-p-400" />
          <Tabs.Trigger className="flex-1" value="allStores">
            {({ isSelected }) => (
              <Tabs.Label
                className={
                  isSelected ? "text-accent-foreground" : "text-foreground"
                }
              >
                All Stores
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Separator betweenValues={["allStores", "popular"]} />
          <Tabs.Trigger className="flex-1" value="popular">
            {({ isSelected }) => (
              <Tabs.Label
                className={
                  isSelected ? "text-accent-foreground" : "text-foreground"
                }
              >
                Popular
              </Tabs.Label>
            )}
          </Tabs.Trigger>
          <Tabs.Separator betweenValues={["popular", "favorites"]} />
          <Tabs.Trigger className="flex-1" value="favorites">
            {({ isSelected }) => (
              <Tabs.Label
                className={
                  isSelected ? "text-accent-foreground" : "text-foreground"
                }
              >
                Favorites
              </Tabs.Label>
            )}
          </Tabs.Trigger>
        </Tabs.List>

        <Text className="py-2" variant="body">
          Earn credit while shopping at your favorite store
        </Text>

        <Tabs.Content
          forceMount
          style={activeTab === "allStores" ? { flex: 1 } : { display: "none" }}
          value="allStores"
        >
          <LegendList
            contentContainerStyle={{ paddingBottom: bottomTabBarHeight }}
            data={allStores}
            ItemSeparatorComponent={() => <View style={{ height: 40 }} />}
            keyExtractor={(item) => item?.id}
            ListEmptyComponent={
              allStoresPending || allStoresLoading ? (
                <ActivityIndicator />
              ) : null
            }
            onEndReached={() => {
              if (hasNextAllStores) {
                fetchNextAllStores();
              }
            }}
            onRefresh={refetchByUser}
            recycleItems={false}
            refreshing={isRefetchingByUser}
            renderItem={({ item }) => <ShopItem item={item} />}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          />
        </Tabs.Content>

        <Tabs.Content
          forceMount
          style={activeTab === "popular" ? { flex: 1 } : { display: "none" }}
          value="popular"
        >
          <LegendList
            contentContainerStyle={{ paddingBottom: bottomTabBarHeight }}
            data={popularStores ?? []}
            ItemSeparatorComponent={() => <View style={{ height: 40 }} />}
            keyExtractor={(item) => item?.id}
            ListEmptyComponent={popularPending ? <ActivityIndicator /> : null}
            onRefresh={refetchByUser}
            recycleItems={false}
            refreshing={isRefetchingByUser}
            renderItem={({ item }) => <ShopItem item={item} />}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          />
        </Tabs.Content>

        <Tabs.Content
          forceMount
          style={activeTab === "favorites" ? { flex: 1 } : { display: "none" }}
          value="favorites"
        >
          <LegendList
            contentContainerStyle={{ paddingBottom: bottomTabBarHeight }}
            data={favorites}
            ItemSeparatorComponent={() => <View style={{ height: 40 }} />}
            keyExtractor={(item) => item?.id!}
            recycleItems={false}
            renderItem={({ item }) => <ShopItem item={item} />}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          />
        </Tabs.Content>
      </Tabs>
    </Screen>
  );
}

export default ShopHome;
