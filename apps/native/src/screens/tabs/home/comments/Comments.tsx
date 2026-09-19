import {
  LegendList,
  type LegendListRenderItemProps,
} from "@legendapp/list/react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CaretDownIcon } from "#/lib/icons";
import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, type TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import CommentCard from "#/components/comment/CommentCard";
import { Button } from "#/components/heroui/button";
import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { CommentBox } from "#/components/index";
import { Image } from "#/components/ui";
import useGetComments from "#/hooks/comments/useGetComments";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc } from "#/lib/orpc";
import { getImageData } from "#/utils/getImageData";

const Comments = () => {
  const queryClient = useQueryClient();
  const route = useRoute();
  const params = route.params as
    | { newsId?: string; newsSlug?: string; focus?: boolean }
    | undefined;
  const { newsId, newsSlug } = params ?? {};

  const news = useQuery(
    orpc.news.one.queryOptions({
      input: {
        slug: newsSlug ?? "",
        type: "article",
      },
      initialData: () =>
        queryClient.getQueryData(
          orpc.news.one.queryKey({
            input: { slug: newsSlug ?? "", type: "article" },
          })
        ),
      initialDataUpdatedAt: () => {
        const qKey = orpc.news.one.queryKey({
          input: {
            slug: newsSlug ?? "",
            type: "article",
          },
        });

        return queryClient.getQueryState(qKey)?.dataUpdatedAt;
      },
    })
  );
  const { data, fetchNextPage, isFetchingNextPage, hasNextPage, refetch } =
    useGetComments(newsId ?? "", false);

  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(refetch);

  const navigation = useNavigation();

  // input ref
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    if (params?.focus && ref.current) {
      const timeout = setTimeout(() => {
        ref.current?.focus();
      }, 100);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [params?.focus]);

  const renderItem = useCallback(
    ({ item }: LegendListRenderItemProps<Comment>) => (
      <CommentCard comment={item} />
    ),
    []
  );

  const onEndReached = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) {
      return;
    }
    fetchNextPage();
  }, [isFetchingNextPage, fetchNextPage, hasNextPage]);

  const keyExtractor = useCallback((item) => item.id, []);

  // if ((news.isError || isError) && isConnected) {
  //   return (
  //     <YStack flex={1} justifyContent="center" ai="center">
  //       <Text>An error occurred</Text>
  //     </YStack>
  //   );
  // }

  if (news.isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const allPages = data?.pages.flatMap((page) => page.docs) || [];
  const { url, blurhash } = getImageData(news.data?.image);

  return (
    <Screen
      contentContainerClassName="py-safe"
      disableKeyboardAvoidingView
      statusBarStyle="auto"
    >
      <KeyboardAvoidingView
        behavior="padding"
        // keyboardVerticalOffset={10}
        style={{ flex: 1 }}
      >
        <LegendList
          data={allPages}
          keyExtractor={keyExtractor}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <Text>No comments yet</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator /> : null
          }
          ListHeaderComponent={
            <View className="mb-6 gap-3">
              <View className="flex-row items-center px-2">
                <Button
                  hitSlop={14}
                  onPress={() => navigation.goBack()}
                  size="sm"
                  variant="ghost"
                >
                  <CaretDownIcon size={20} />
                </Button>
                <Image
                  className="h-full w-15 rounded-[10px]"
                  contentFit="cover"
                  placeholder={{
                    blurhash,
                  }}
                  source={url}
                />
                <View className="flex-1 self-start px-2.5">
                  <Text className="font-semibold leading-4.5" numberOfLines={3}>
                    {news.data?.title}
                  </Text>
                </View>
              </View>

              <Text className="mt-2 pl-4 font-normal text-lg">
                Comments ({allPages?.length ?? 0})
              </Text>
            </View>
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          onRefresh={refetchByUser}
          recycleItems={false}
          refreshing={isRefetchingByUser}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
        <CommentBox inputRef={ref} newsId={newsId} newsSlug={newsSlug} />
      </KeyboardAvoidingView>
    </Screen>
  );
};

export default Comments;
