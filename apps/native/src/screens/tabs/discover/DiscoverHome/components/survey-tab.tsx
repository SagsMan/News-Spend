import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Card } from "heroui-native/card";
import { Chip } from "heroui-native/chip";
import { useCallback } from "react";
import { Platform, View } from "react-native";
import { TabLegendList } from "react-native-collapsible-tab/legend-list";
import { useSnapshot } from "valtio";

import { Button } from "#/components/heroui/button";
import { Text } from "#/components/heroui/text";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc, type RouterOutputs } from "#/lib/orpc";
import { authState } from "#/state/auth";
import { useTabBarHeight } from "#/state/route-state";
import {
  PullToRefreshIndicator,
  triggerRefreshHaptic,
} from "./pull-to-refresh-indicator";

type Offer = RouterOutputs["survey"]["offers"]["getOffers"][number];

const PROVIDER_COLORS: Record<string, string> = {
  cpx: "#4CAF50",
  rapido: "#2196F3",
  theorem: "#FF9800",
};

const PROVIDER_NAMES: Record<string, string> = {
  cpx: "CPX",
  rapido: "Rapido",
  theorem: "Theorem",
};

export function SurveyTab() {
  const navigation = useNavigation("DiscoverHome");
  const { user } = useSnapshot(authState);
  const tabBarHeight = useTabBarHeight();

  const surveyQuery = useQuery(
    orpc.survey.offers.getOffers.queryOptions({
      input: { limit: 20 },
      staleTime: 60 * 1000,
    })
  );

  const offers = ((surveyQuery.data ?? []) as Offer[]).sort(
    (a, b) => b.points - a.points
  );
  const topRatedSurvey = offers.length ? offers[0] : null;
  const otherSurveys = offers.slice(1);

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(
    surveyQuery.refetch
  );

  const handleStartSurvey = useCallback(
    (offer: Offer) => {
      if (!user || user.isAnonymous) {
        navigation.navigate("SignIn", { redirect: "SurveyTab" } as never);
        return;
      }

      if (offer.url) {
        navigation.navigate("InAppBrowser", {
          url: offer.url,
          title: offer.title,
        });
      }
    },
    [navigation, user]
  );

  const renderSurveyCard = useCallback(
    ({ item, index }: { item: Offer; index: number }) => (
      <Card
        className="mb-3 flex-1 gap-4 rounded-lg p-3"
        style={{
          marginLeft: index % 2 === 0 ? 0 : 8,
          marginRight: index % 2 === 0 ? 8 : 0,
        }}
      >
        <Card.Body className="gap-1 p-0">
          <View className="flex-row flex-wrap items-center justify-between">
            <Text className="font-semibold text-sm" numberOfLines={1}>
              {item.title}
            </Text>
            <Text
              className="rounded-md px-1 text-white text-xs"
              style={{
                backgroundColor: PROVIDER_COLORS[item.provider] || "#9CA3AF",
              }}
            >
              {PROVIDER_NAMES[item.provider]}
            </Text>
          </View>
          <Text className="text-gray-500 text-sm">
            {item.description || `${item.estimatedTime || "?"} mins`}
          </Text>
          <Text className="font-bold text-lg">
            {item.points} pt{item.points === 1 ? "" : "s"}
          </Text>
        </Card.Body>
        <Card.Footer>
          <Button onPress={() => handleStartSurvey(item)} size="sm">
            <Button.Label>Start Survey</Button.Label>
          </Button>
        </Card.Footer>
      </Card>
    ),
    [handleStartSurvey]
  );

  const renderTopRatedCard = useCallback(() => {
    if (!topRatedSurvey) {
      return null;
    }

    if (!user) {
      return (
        <View className="mb-6 items-center gap-3.5 rounded-lg bg-gray-100 p-3">
          <View className="flex-row gap-1 self-start">
            <Text className="rounded-full bg-purple-600 px-2 text-sm text-white">
              Guest Preview
            </Text>
          </View>

          <View className="items-center justify-center">
            <Text className="font-bold text-xl">
              {topRatedSurvey.points} Points
            </Text>
            <Text className="text-gray-500">
              {topRatedSurvey.description ||
                `${topRatedSurvey.estimatedTime || "?"} mins`}
            </Text>
          </View>

          <Button
            className="self-stretch"
            onPress={() =>
              navigation.navigate(
                "SignIn" as never,
                { redirect: "SurveyTab" } as never
              )
            }
          >
            <Button.Label>Sign In to Take Survey</Button.Label>
          </Button>
        </View>
      );
    }

    return (
      <View className="mb-6 items-center gap-3.5 rounded-lg bg-gray-100 p-3">
        <View className="flex-row gap-1 self-start">
          <Chip className="bg-green-600" size="sm">
            Top Rated
          </Chip>
          <Chip
            size="sm"
            style={{
              backgroundColor:
                PROVIDER_COLORS[topRatedSurvey.provider] || "#9CA3AF",
            }}
          >
            {PROVIDER_NAMES[topRatedSurvey.provider]}
          </Chip>
        </View>

        <View className="items-center justify-center">
          <Text className="font-bold text-xl">
            {topRatedSurvey.points} Points
          </Text>
          <Text className="text-gray-500">
            {topRatedSurvey.description ||
              `${topRatedSurvey.estimatedTime || "?"} mins`}
          </Text>
        </View>

        <Button
          className="self-stretch"
          onPress={() => handleStartSurvey(topRatedSurvey)}
        >
          <Button.Label>Start Survey</Button.Label>
        </Button>
      </View>
    );
  }, [topRatedSurvey, handleStartSurvey, navigation, user]);

  const renderListEmptyComponent = useCallback(() => {
    if (surveyQuery.isPending) {
      return (
        <View className="items-center py-10">
          <Text>Loading offers...</Text>
        </View>
      );
    }

    if (surveyQuery.isError) {
      return (
        <View className="w-full flex-1 items-center justify-center gap-2 p-4">
          <Text className="text-center font-semibold">
            Error loading surveys. Please try again later.
          </Text>
          <Button onPress={refetchByUser}>
            <Button.Label>Retry</Button.Label>
          </Button>
        </View>
      );
    }

    if (!user && offers.length > 0) {
      return (
        <View className="w-full flex-1 items-center justify-center gap-2 p-4">
          <Text className="text-center font-semibold">
            Sign in to earn points by completing surveys
          </Text>
          <Button
            onPress={() =>
              navigation.navigate("SignIn", {
                redirect: "SurveyTab",
              } as never)
            }
          >
            <Button.Label>Sign In</Button.Label>
          </Button>
        </View>
      );
    }

    if (offers.length === 0) {
      return (
        <View className="w-full flex-1 items-center justify-center gap-2 p-4">
          <Text className="text-center font-semibold">
            No offers available right now
          </Text>
          <Text className="text-center text-gray-500">
            Check back later for new surveys
          </Text>
          <Button onPress={refetchByUser}>
            <Button.Label>Refresh</Button.Label>
          </Button>
        </View>
      );
    }

    return null;
  }, [
    surveyQuery.isPending,
    surveyQuery.isError,
    offers.length,
    user,
    refetchByUser,
    navigation,
  ]);

  return (
    <View className="flex-1">
      <PullToRefreshIndicator refreshing={isRefetchingByUser} />
      <TabLegendList
        contentContainerStyle={{
          padding: 15,
          paddingBottom: 15 + tabBarHeight,
        }}
        data={otherSurveys}
        keyExtractor={(item: Offer) => item?.id ?? ""}
        ListEmptyComponent={renderListEmptyComponent}
        ListHeaderComponent={renderTopRatedCard}
        numColumns={2}
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
        renderItem={renderSurveyCard}
        {...(Platform.OS === "android"
          ? {
              onRefresh: refetchByUser,
              progressViewOffset: 0,
              refreshing: isRefetchingByUser,
            }
          : {})}
      />
    </View>
  );
}
