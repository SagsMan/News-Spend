import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { Platform, RefreshControl, View } from "react-native";
import { TabLegendList } from "react-native-collapsible-tab/legend-list";
import { useSnapshot } from "valtio";
import { Text } from "#/components/heroui/text";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { authState } from "#/state/auth";
import { useTabBarHeight } from "#/state/route-state";
import { GameItem } from "./game-item";
import {
  PullToRefreshIndicator,
  triggerRefreshHaptic,
} from "./pull-to-refresh-indicator";

export function GamesTab() {
  const { user } = useSnapshot(authState);
  const navigation = useNavigation();
  const tabBarHeight = useTabBarHeight();
  const { data, isPending, refetch } = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const page = Math.floor(Math.random() * 850) + 1;
      const res = await fetch(
        `https://feeds.gamepix.com/v2/json?sid=SW281&pagination=12&page=${page}`
      );
      const res_1 = await res.json();
      return res_1?.items ?? [];
    },
    staleTime: Number.POSITIVE_INFINITY,
  });

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  const onItemClick = useCallback(
    (gameUrl?: string, title?: string) => {
      if (!user || user.isAnonymous) {
        navigation.navigate("SignIn", { redirect: "SurveyTab" });
        return;
      }

      if (gameUrl) {
        navigation.navigate("InAppBrowser" as any, {
          url: gameUrl,
          type: "game",
          title,
          hideHeader: true,
        });
      }
    },
    [navigation, user]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <GameItem item={item} onPress={() => onItemClick(item.url, item.title)} />
    ),
    [onItemClick]
  );

  const refreshControl = useMemo(
    () =>
      Platform.OS === "android" ? (
        <RefreshControl
          onRefresh={refetchByUser}
          progressViewOffset={0}
          refreshing={isRefetchingByUser}
        />
      ) : undefined,
    [refetchByUser, isRefetchingByUser]
  );

  return (
    <View className="flex-1">
      <TabLegendList
        contentContainerStyle={{
          paddingBottom: 25 + tabBarHeight,
        }}
        data={data}
        estimatedItemSize={120}
        keyExtractor={(item: any) => item.id}
        ListEmptyComponent={
          isPending ? (
            <View className="flex-1 items-center justify-center">
              <Text>Loading...</Text>
            </View>
          ) : null
        }
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
        refreshControl={Platform.OS === "android" ? refreshControl : undefined}
        renderItem={renderItem}
      />
      <PullToRefreshIndicator refreshing={isRefetchingByUser} />
    </View>
  );
}
