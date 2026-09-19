import type { LegendListRef } from "@legendapp/list/react-native";
import type { NewsCategory } from "@news-spend-media/payload/types";
import { useScrollToTop } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";
import { useMMKVObject } from "react-native-mmkv";
import {
  type Route,
  TabBar,
  TabBarIndicator,
  TabView,
} from "react-native-tab-view";

import Latest from "#/components/News/categories/Latest";
import NewsCategoryComponent from "#/components/News/categories/NewsCategory";
import { setTabName } from "#/state/route-state";

export default function NewsHome() {
  const [index, setIndex] = useState(0);
  const layout = useWindowDimensions();

  const [categories] = useMMKVObject<NewsCategory["items"]>("CATEGORIES");

  const routes = useMemo<Route[]>(
    () => [
      { key: "latest", title: "Latest" },
      ...(categories ?? []).map(
        (item, key): Route => ({
          key:
            typeof item.category === "string"
              ? item.category
              : (item.category?.id ??
                item.category?.title ??
                `category-${key}`),
          title:
            typeof item.category === "string"
              ? item.category
              : item.category?.title,
        })
      ),
    ],
    [categories]
  );

  // Create refs object for all lists
  const listRefs = useRef<Record<string, LegendListRef>>({});

  // Ref for the active list that will work with useScrollToTop
  const activeListRef = useRef<LegendListRef>(null);

  // Update active ref when index changes
  useEffect(() => {
    activeListRef.current = listRefs.current[routes[index].key];
  }, [index, routes]);

  useScrollToTop(activeListRef);

  const createSetRef = useCallback(
    (routeKey: string) => (ref: LegendListRef | null) => {
      if (ref) {
        listRefs.current[routeKey] = ref;
        if (routes[index].key === routeKey) {
          activeListRef.current = ref;
        }
      }
    },
    [index, routes]
  );

  const renderScene = useCallback(
    ({ route }: { route: Route }) => {
      switch (route.key) {
        case "latest":
          return <Latest ref={createSetRef("latest")} />;
        default:
          return (
            <NewsCategoryComponent
              ref={createSetRef(route.key)}
              route={route.key}
            />
          );
      }
    },
    [createSetRef]
  );

  const onIndexChange = useCallback(
    (newIndex: number) => {
      setIndex(newIndex);
      setTabName(routes[newIndex].key);
    },
    [routes]
  );

  const renderTabBar = useCallback(
    (props: any) => (
      <TabBar
        {...props}
        bounces
        inactiveColor="gray"
        indicatorStyle={{
          backgroundColor: "#fff",
        }}
        pressColor="transparent"
        renderIndicator={(indicatorProps) => {
          const width = indicatorProps.getTabWidth(index) - 10;
          return <TabBarIndicator {...indicatorProps} width={width} />;
        }}
        scrollEnabled
        style={{
          backgroundColor: "#00223d",
          height: 35,
        }}
        tabStyle={{
          width: "auto",
          padding: 0,
        }}
      />
    ),
    [index]
  );

  return (
    <TabView
      commonOptions={{
        labelStyle: {
          color: "#fff",
          fontSize: 14,
          fontFamily: "Inter-SemiBold",
          textTransform: "capitalize",
        },
        sceneStyle: {
          backgroundColor: "white",
        },
      }}
      initialLayout={{ width: layout.width, height: 0 }}
      lazy
      navigationState={{ index, routes }}
      onIndexChange={onIndexChange}
      pagerStyle={{ zIndex: -3 }}
      renderLazyPlaceholder={() => (
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator />
        </View>
      )}
      renderScene={renderScene}
      renderTabBar={renderTabBar}
      style={{ zIndex: -3 }}
      swipeEnabled
    />
  );
}
