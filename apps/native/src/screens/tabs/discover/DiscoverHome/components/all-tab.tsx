import {
  LegendList,
  type LegendListRef,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import type { PartnerContent } from "@news-spend-media/payload/types";
import { useIsFocused } from "@react-navigation/native";
import { type QueryObserverResult, useQueries } from "@tanstack/react-query";
import { Card } from "heroui-native/card";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Skeleton } from "heroui-native/skeleton";
import { cn } from "heroui-native/utils";
import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  type ScrollViewProps,
  View,
} from "react-native";
import { TabLegendList } from "react-native-collapsible-tab/legend-list";
import { ScrollView } from "react-native-gesture-handler";
import { useSnapshot } from "valtio";
import { Button } from "#/components/heroui/button";
import { Image } from "#/components/heroui/image";
import { Text } from "#/components/heroui/text";
import { usePartnerClick } from "#/hooks/usePartnerClick";
import { orpc } from "#/lib/orpc";
import { navigationRef } from "#/navigation/navigationUtils";
import { authState } from "#/state/auth";
import { useTabBarHeight } from "#/state/route-state";
import { getImageData } from "#/utils/getImageData";
import { AppItem } from "./app-item";
import { GameItem } from "./game-item";
import {
  PullToRefreshIndicator,
  triggerRefreshHaptic,
} from "./pull-to-refresh-indicator";

// ─── Types ──────────────────────────────────────────────────────────────────

type GameItemData = {
  id: string;
  title?: string;
  description?: string;
  image?: string;
  url?: string;
};

type SurveyItem = {
  href?: string;
  payout?: number;
  loi?: number;
  title?: string;
  [key: string]: unknown;
};

type SectionItem =
  | { type: "header"; title: string }
  | { type: "section-loading" }
  | { type: "section-error"; onRetry: () => void }
  | { type: "empty"; message: string }
  | { type: "app"; data: PartnerContent; onPress: () => void; loading: boolean }
  | { type: "game"; data: GameItemData; onPress: () => void }
  | {
      type: "book";
      data: PartnerContent[];
      onPress: (item: PartnerContent) => void;
      loading: (id: string) => boolean;
    }
  | { type: "survey"; data: SurveyItem[] };

// ─── Query definitions ───────────────────────────────────────────────────────

const gamesQuery = {
  queryKey: ["games", "all-tab"],
  queryFn: async (): Promise<GameItemData[]> => {
    const res = await fetch(
      "https://feeds.gamepix.com/v2/json?sid=SW281&pagination=12&page=1"
    );
    const data = await res.json();
    return (data?.items ?? []).slice(0, 6);
  },
  staleTime: Number.POSITIVE_INFINITY,
};

const appsQuery = orpc.partnerContent.filtered.queryOptions({
  input: { limit: 5, type: ["app"], placement: ["points-mall-apps"] },
});

const booksQuery = orpc.partnerContent.filtered.queryOptions({
  input: { limit: 5, type: ["book"], placement: ["points-mall-books"] },
});

const surveysSelect = (data: unknown) =>
  Array.isArray(data)
    ? [...data].sort(
        (a: any, b: any) => Number(b.payout ?? 0) - Number(a.payout ?? 0)
      )
    : data;

// ─── Combine helper ──────────────────────────────────────────────────────────

const combineAllTabResults = (results: QueryObserverResult[]) => ({
  appsData:
    (results[0].data as { docs: PartnerContent[] } | undefined)?.docs ?? [],
  appsPending: results[0].isPending,
  appsError: results[0].error,

  booksData:
    (results[1].data as { docs: PartnerContent[] } | undefined)?.docs ?? [],
  booksPending: results[1].isPending,
  booksError: results[1].error,

  gamesData: (results[2].data as GameItemData[]) ?? [],
  gamesPending: results[2].isPending,
  gamesError: results[2].error,

  surveysData: (results[3].data as SurveyItem[]) ?? [],
  surveysPending: results[3].isPending,
  surveysError: results[3].error,

  isRefetching: results.some((r) => r.isRefetching),
  refetchAll: () => results.forEach((r) => r.refetch()),
});

// ─── Section builder ─────────────────────────────────────────────────────────

type SectionState = { pending: boolean; error: unknown; dataLength: number };

function buildSection(
  items: SectionItem[],
  title: string,
  state: SectionState,
  onRetry: () => void,
  renderData: () => SectionItem | SectionItem[]
): void {
  items.push({ type: "header", title });

  if (state.pending && state.dataLength === 0) {
    items.push({ type: "section-loading" });
    return;
  }

  if (state.error) {
    items.push({ type: "section-error", onRetry });
    return;
  }

  if (state.dataLength === 0) {
    items.push({
      type: "empty",
      message: `No ${title.toLowerCase()} available`,
    });
    return;
  }

  const rendered = renderData();
  if (Array.isArray(rendered)) {
    items.push(...rendered);
  } else {
    items.push(rendered);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CustomScrollView = (props: ScrollViewProps) => <ScrollView {...props} />;

const onItemClick = (gameUrl?: string, title?: string) => {
  const { user } = authState;
  if (!user || user.isAnonymous) {
    navigationRef.navigate("SignIn", { redirect: "SurveyTab" });
    return;
  }
  if (gameUrl) {
    navigationRef.navigate("InAppBrowser" as any, {
      url: gameUrl,
      type: "game",
      title,
      hideHeader: true,
    });
  }
};

const handleStartSurvey = (surveyUrl?: string) => {
  const { user } = authState;
  if (!user || user.isAnonymous || surveyUrl === "login-required") {
    navigationRef.navigate("SignIn", { redirect: "SurveyTab" });
    return;
  }
  if (surveyUrl) {
    navigationRef.navigate("InAppBrowser" as any, { url: surveyUrl });
  }
};

// ─── Section Components ──────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="bg-white px-3 py-2">
      <Text className="font-bold text-lg">{title}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <Skeleton>
      <View className="flex-row items-center gap-3 px-3 py-3">
        <View className="h-20 w-20 rounded-lg bg-gray-200" />
        <View className="flex-1 gap-2">
          <View className="h-4 w-3/4 rounded bg-gray-200" />
          <View className="h-3 w-1/2 rounded bg-gray-200" />
          <View className="h-5 w-16 self-end rounded-full bg-gray-200" />
        </View>
      </View>
    </Skeleton>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center gap-2 px-3 py-4">
      <Text className="text-gray-50 text-sm">Failed to load</Text>
      <Button onPress={onRetry} size="sm" variant="ghost">
        <Button.Label>Retry</Button.Label>
      </Button>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="px-3 py-4">
      <Text className="text-gray-50 text-sm">{message}</Text>
    </View>
  );
}

// ─── BookItem ────────────────────────────────────────────────────────────────

const BookItem = ({
  item,
  onPress,
  loading,
}: {
  item: PartnerContent;
  onPress: () => void;
  loading?: boolean;
}) => {
  const { url } = getImageData(item.media);

  return (
    <PressableFeedback onPress={onPress}>
      <PressableFeedback.Scale>
        <View
          className={cn(
            "mr-4 mb-2 w-32.5 overflow-hidden",
            loading && "opacity-70"
          )}
        >
          <Image
            className="rounded-lg"
            contentFit="cover"
            placeholder={{
              blurhash: item.media?.blurhash,
            }}
            source={{ uri: url || "" }}
            style={{ aspectRatio: 0.7, width: "100%" }}
          />
          <View className="mt-2 flex-row items-center gap-2">
            <Text
              className="flex-1 font-semibold text-gray-50 text-sm italic"
              numberOfLines={2}
            >
              {item.condition}
            </Text>
            {loading ? <ActivityIndicator color="#666" size="small" /> : null}
          </View>
        </View>
      </PressableFeedback.Scale>
      <PressableFeedback.Ripple />
    </PressableFeedback>
  );
};

// ─── BooksSection ─────────────────────────────────────────────────────────────

const BooksSection = ({
  data,
  onPress,
  loading,
}: {
  data: PartnerContent[];
  onPress: (item: PartnerContent) => void;
  loading: (id: string) => boolean;
}) => (
  <View className="h-62.5 px-3">
    <LegendList
      data={data}
      estimatedItemSize={200}
      horizontal
      recycleItems={false}
      renderItem={({ item }) => (
        <BookItem
          item={item}
          loading={loading(item.id)}
          onPress={() => onPress(item)}
        />
      )}
      renderScrollComponent={CustomScrollView}
      showsHorizontalScrollIndicator={false}
    />
  </View>
);

// ─── SurveysSection ───────────────────────────────────────────────────────────

const SurveysSection = ({ data }: { data: SurveyItem[] }) => (
  <View className="flex-row flex-wrap justify-between gap-2 px-3">
    {data.map((item, index) => (
      <Card className="w-[48%] gap-4 rounded-lg p-3" key={`survey-${index}`}>
        <View className="gap-1">
          <Text className="font-bold text-xl">
            {Math.floor(item.payout ?? 0)} Points
          </Text>
          <Text className="text-xs">{item.loi ?? "?"} min</Text>
        </View>
        <Button onPress={() => handleStartSurvey(item.href)} size="sm">
          <Button.Label>Start Survey</Button.Label>
        </Button>
      </Card>
    ))}
  </View>
);

// ─── renderSectionContent ─────────────────────────────────────────────────────

function renderSectionContent(item: SectionItem) {
  switch (item.type) {
    case "app":
      return (
        <AppItem
          item={item.data}
          loading={item.loading}
          onPress={() => item.onPress()}
        />
      );
    case "game":
      return <GameItem item={item.data} onPress={() => item.onPress()} />;
    case "book":
      return (
        <BooksSection
          data={item.data}
          loading={(id) => item.loading(id)}
          onPress={(i) => item.onPress(i)}
        />
      );
    case "survey":
      return <SurveysSection data={item.data} />;
    default:
      return null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const AllTab = () => {
  const { user } = useSnapshot(authState);
  const isFocused = useIsFocused();
  const { handleClick, isLoading: isPartnerLoading } = usePartnerClick();
  const listRef = useRef<LegendListRef>(null);
  const tabBarHeight = useTabBarHeight();

  const {
    appsData,
    appsPending,
    appsError,
    booksData,
    booksPending,
    booksError,
    gamesData,
    gamesPending,
    gamesError,
    surveysData,
    surveysPending,
    surveysError,
    isRefetching,
    refetchAll,
  } = useQueries({
    queries: [
      appsQuery,
      booksQuery,
      gamesQuery,
      {
        ...orpc.survey.cpx.getSurveys.queryOptions({
          refetchInterval: user && isFocused ? 10 * 60 * 1000 : undefined, // every 15 minutes
          meta: { persist: false },
        }),
        select: surveysSelect,
      },
    ],
    combine: combineAllTabResults,
  });

  const sections: SectionItem[] = useMemo(() => {
    const items: SectionItem[] = [];

    buildSection(
      items,
      "Apps",
      { pending: appsPending, error: appsError, dataLength: appsData.length },
      refetchAll,
      () =>
        appsData.map((app) => ({
          type: "app" as const,
          data: app,
          onPress: () => handleClick(app),
          loading: isPartnerLoading(app.id),
        }))
    );

    buildSection(
      items,
      "Games",
      {
        pending: gamesPending,
        error: gamesError,
        dataLength: gamesData.length,
      },
      refetchAll,
      () =>
        gamesData.map((game) => ({
          type: "game" as const,
          data: game,
          onPress: () => onItemClick(game.url, game.title),
        }))
    );

    buildSection(
      items,
      "Books",
      {
        pending: booksPending,
        error: booksError,
        dataLength: booksData.length,
      },
      refetchAll,
      () => ({
        type: "book" as const,
        data: booksData,
        onPress: handleClick,
        loading: isPartnerLoading,
      })
    );

    buildSection(
      items,
      "Surveys",
      {
        pending: surveysPending,
        error: surveysError,
        dataLength: surveysData.length,
      },
      refetchAll,
      () => ({ type: "survey" as const, data: surveysData })
    );

    return items;
  }, [
    appsData,
    appsPending,
    appsError,
    gamesData,
    gamesPending,
    gamesError,
    booksData,
    booksPending,
    booksError,
    surveysData,
    surveysPending,
    surveysError,
    handleClick,
    isPartnerLoading,
    refetchAll,
  ]);

  const stickyHeaderIndices = useMemo(
    () =>
      sections
        .map((item, index) => (item.type === "header" ? index : null))
        .filter((i): i is number => i !== null),
    [sections]
  );

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<SectionItem>) => {
      switch (item.type) {
        case "header":
          return <SectionHeader title={item.title} />;
        case "section-loading":
          return <LoadingSkeleton />;
        case "section-error":
          return <ErrorState onRetry={item.onRetry} />;
        case "empty":
          return <EmptyState message={item.message} />;
        default:
          return renderSectionContent(item);
      }
    },
    []
  );

  const keyExtractor = useCallback((item: SectionItem, index: number) => {
    switch (item.type) {
      case "header":
        return `header-${item.title}`;
      case "app":
      case "game":
        return `${item.type}-${item.data.id}`;
      case "book":
      case "survey":
        return item.type;
      case "section-loading":
        return `loading-${index}`;
      case "section-error":
        return `error-${index}`;
      default:
        return `empty-${index}`;
    }
  }, []);

  const refreshControl = useMemo(
    () =>
      Platform.OS === "android" ? (
        <RefreshControl
          onRefresh={refetchAll}
          progressViewOffset={0}
          refreshing={isRefetching}
        />
      ) : undefined,
    [isRefetching, refetchAll]
  );

  return (
    <View className="flex-1">
      <TabLegendList
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 12 + tabBarHeight,
        }}
        data={sections}
        keyExtractor={keyExtractor}
        onScrollEndDrag={(e) => {
          if (Platform.OS === "ios") {
            const pull = -e.nativeEvent.contentOffset.y;
            if (pull >= 80) {
              triggerRefreshHaptic();
              refetchAll();
            }
          }
        }}
        recycleItems={false}
        ref={listRef}
        refreshControl={Platform.OS === "android" ? refreshControl : undefined}
        renderItem={renderItem}
        stickyHeaderIndices={stickyHeaderIndices}
      />
      <PullToRefreshIndicator refreshing={isRefetching} />
    </View>
  );
};
