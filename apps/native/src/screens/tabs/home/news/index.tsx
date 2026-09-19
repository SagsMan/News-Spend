import { Galeria } from "@nandorojo/galeria";
import { isInferableError } from "@orpc/client";
import { useNavigation, useRoute } from "@react-navigation/native";
import { format } from "date-fns/format";
import { Separator } from "heroui-native/separator";
import { SkeletonGroup } from "heroui-native/skeleton-group";
import { useEffect } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Button } from "#/components/heroui/button";
import { Icon } from "#/components/heroui/icon";
import { Image } from "#/components/heroui/image";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { PayloadLexicalReactRenderer } from "#/components/lexical/payload-lexical-react-renderer";
import type { PayloadLexicalReactRendererContent } from "#/components/lexical/types";
import { NewsActionBar } from "#/components/News/NewsActionBar";
import { ReadingTrackerDebug } from "#/components/News/ReadinTrackerDebug";
import usePrefetchComments from "#/hooks/comments/usePrefetchComments";
import { useNews } from "#/hooks/news";
import { useMarkInteractive } from "#/hooks/useMarkInteractive";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { ArrowLeftIcon, UserIcon } from "#/lib/icons";
import { getImageData } from "#/utils/getImageData";
import { useArticleActions } from "./hooks/use-article-actions";
import { useArticleTracking } from "./hooks/use-article-tracking";

const SingleNews = () => {
  const navigation = useNavigation("News");
  const { slug } = useRoute("News").params;

  const {
    data,
    refetch,
    isError,
    error,
    isFetchedAfterMount,
    isFetching,
    isPlaceholderData,
  } = useNews(slug as string);
  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  const {
    handleScroll,
    elapsedSeconds,
    minReadingSeconds,
    hasScrolledThreshold,
    inRapidScroll,
    isTracking,
    trackShare,
    trackComment,
  } = useArticleTracking(data);

  const { handleLike, handleDislike } = useArticleActions(
    data
    // pass analytics callbacks as optional deps
    // if you want to keep trackLike/trackDislike wired in,
    // expose them from useArticleTracking instead
  );

  // Emits nav_tti for /Tab/Home/News once the article content has rendered.
  useMarkInteractive(Boolean(data));

  // Warm the comments cache so the comments screen opens instantly.
  usePrefetchComments(data?.id);

  // Redirect on NOT_FOUND
  useEffect(() => {
    if (isError && isInferableError(error) && error?.code === "NOT_FOUND") {
      navigation.replace("NotFound");
    }
  }, [isError, error, navigation.replace]);

  if (isFetchedAfterMount && isError) {
    return (
      <Screen
        className="flex-1 items-center justify-center"
        navigationBarButtonStyle="dark"
        statusBarStyle="auto"
      >
        <Button
          className="absolute top-safe-offset-2 left-2.5 z-20 size-8 rounded-full bg-white/80"
          onPress={() => navigation.goBack()}
          variant="ghost"
        >
          <ArrowLeftIcon color="#00223d" size={20} />
        </Button>
        <Text className="text-center">Failed to load news article</Text>
      </Screen>
    );
  }

  const { url, blurhash } = getImageData(data?.image);

  return (
    <Screen navigationBarButtonStyle="dark" statusBarStyle="auto">
      <Button
        className="absolute top-safe-offset-2 left-2.5 z-20 size-8 rounded-full bg-white/80"
        onPress={() => navigation.goBack()}
        variant="ghost"
      >
        <ArrowLeftIcon color="#00223d" size={20} />
      </Button>
      <SkeletonGroup className="flex-1" isLoading={!data}>
        <ScrollView
          className="bg-white"
          contentContainerClassName="pb-4"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl
              onRefresh={refetchByUser}
              refreshing={isRefetchingByUser}
            />
          }
          scrollEnabled={Boolean(data)}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-3">
            <SkeletonGroup.Item className="h-[30vh] w-full rounded-md">
              <Galeria urls={[url]}>
                <Galeria.Image>
                  <Image
                    className="h-[30vh] w-full"
                    contentFit="cover"
                    placeholder={{ blurhash }}
                    placeholderContentFit="cover"
                    source={url}
                  />
                </Galeria.Image>
              </Galeria>
            </SkeletonGroup.Item>
          </View>

          <View className="gap-5 px-3">
            <SkeletonGroup.Item className="h-12.5 w-full rounded-md">
              <Text className="font-bold text-[20px] leading-6.25">
                {data?.title}
              </Text>
            </SkeletonGroup.Item>

            <View className="flex-row items-center justify-between">
              <SkeletonGroup.Item className="h-4.25 w-25 rounded-md">
                <View className="flex-row items-center gap-0.75">
                  <Icon name={UserIcon} size={15} />
                  <Text className="font-bold">
                    {typeof data?.author === "object"
                      ? data?.author.fullName
                      : ""}
                  </Text>
                </View>
              </SkeletonGroup.Item>

              <SkeletonGroup.Item className="h-4.25 w-32.5 rounded-md">
                {data ? (
                  <Text className="text-[#737373] text-xs">
                    {format(
                      new Date(data.createdAt ?? new Date()),
                      "do MMMM yyy | p"
                    )}
                  </Text>
                ) : null}
              </SkeletonGroup.Item>
            </View>

            <SkeletonGroup.Item
              className="h-[60vh] w-full rounded-md"
              isLoading={!data?.keyPoints}
            >
              <View className="mt-1">
                <Separator />
                <Text className="mb-3 font-bold text-base">KEY POINTS</Text>
                {data?.keyPoints?.map(({ point }, i) => (
                  <View className="flex-row gap-2 pb-2" key={i}>
                    <Text className="text-xs">{"\u2B24"}</Text>
                    <Text className="flex-1 p-0" selectable>
                      {point}
                    </Text>
                  </View>
                ))}
                <Separator />
              </View>
            </SkeletonGroup.Item>

            {isFetching && isPlaceholderData ? (
              <View className="h-[60vh] w-full rounded-lg bg-neutral-200" />
            ) : (
              <SkeletonGroup.Item
                className="h-[60vh] w-full rounded-md"
                isLoading={!data?.content}
              >
                <PayloadLexicalReactRenderer
                  content={data?.content as PayloadLexicalReactRendererContent}
                />
              </SkeletonGroup.Item>
            )}
          </View>
        </ScrollView>

        <NewsActionBar
          news={data}
          onComment={trackComment}
          onDislike={handleDislike}
          onLike={handleLike}
          onShare={trackShare}
        />
      </SkeletonGroup>

      <ReadingTrackerDebug
        elapsedSeconds={elapsedSeconds}
        hasScrolledThreshold={hasScrolledThreshold}
        inRapidScroll={inRapidScroll}
        isTracking={isTracking}
        minReadingSeconds={minReadingSeconds}
        wordCount={data?.wordCount ?? 0}
      />
    </Screen>
  );
};

export default SingleNews;
