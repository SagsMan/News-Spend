import { LegendList } from "@legendapp/list/react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { useRoute } from "@react-navigation/native";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQueries,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ActivityIndicator, type TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { CommentBox } from "#/components/CommentBox";
import CommentCard from "#/components/comment/CommentCard";
import { HighlightedReply } from "#/components/comment/HighlightedReply";
import Reply from "#/components/comment/Reply";

import { Screen } from "#/components/heroui/screen";
import { Text } from "#/components/heroui/text";
import { useRefreshByUser } from "#/hooks/useRefreshByUser";
import { orpc, type RouterOutputs } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

function CommentReplies() {
  const { commentId, highlightCommentId, ...rest } = useRoute("CommentReply")
    .params as {
    commentId: string;
    highlightCommentId?: string;
    newsId?: string;
    newsSlug?: string;
    focus?: boolean;
  };
  const ref = useRef<TextInput>(null);
  const { isConnected } = useNetInfo();

  useEffect(() => {
    if (rest?.focus && ref.current) {
      const timeout = setTimeout(() => {
        ref.current?.focus();
      }, 100);

      return () => {
        clearTimeout(timeout);
      };
    }
  }, [rest?.focus]);
  const showHighlight =
    Boolean(highlightCommentId) && highlightCommentId !== commentId;

  // Shared helper to seed a single-comment query from the paginated all-comments
  // cache, avoiding a network round-trip when the comment was already loaded.
  const getCommentFromCache = (
    targetId: string
  ): RouterOutputs["comments"]["one"] | undefined => {
    if (!rest.newsId) {
      return;
    }
    const comments = queryClient.getQueryData<
      InfiniteData<RouterOutputs["comments"]["all"]>
    >(
      orpc.comments.all.infiniteKey({
        input: (pageParam) => ({
          newsId: rest.newsId,
          page: pageParam,
        }),
        initialPageParam: undefined,
      })
    );
    const found = comments?.pages
      .flatMap((page) => page.docs)
      .find((comment) => comment.id === targetId);
    if (!found) {
      return;
    }
    return {
      ...found,
      user: found.user ?? { id: "", username: "" },
    } as RouterOutputs["comments"]["one"];
  };

  const [rootCommentQuery, highlightedCommentQuery] = useQueries({
    queries: [
      orpc.comments.one.queryOptions({
        input: commentId,
        initialData: () => getCommentFromCache(commentId),
        initialDataUpdatedAt: () => {
          const qKey = orpc.comments.all.infiniteKey({
            input: (pageParam) => ({
              newsId: rest.newsId ?? "",
              page: pageParam,
            }),
            initialPageParam: undefined,
          });
          return queryClient.getQueryState(qKey)?.dataUpdatedAt;
        },
      }),
      orpc.comments.one.queryOptions({
        input: highlightCommentId ?? "",
        enabled: showHighlight,
        initialData: () =>
          highlightCommentId
            ? getCommentFromCache(highlightCommentId)
            : undefined,
      }),
    ],
  });

  const { data, isPending, isError } = rootCommentQuery;
  const effectiveNewsId =
    rest.newsId ??
    (typeof data?.news === "string" ? data?.news : data?.news?.id);

  const replies = useInfiniteQuery(
    orpc.comments.all.infiniteOptions({
      input: (pageParam: number | undefined) => ({
        // Guarded by `enabled` below, so it never actually fetches with "".
        newsId: effectiveNewsId ?? "",
        parentId: commentId,
        page: pageParam,
      }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      staleTime: 0,
      enabled: Boolean(effectiveNewsId),
    })
  );

  const onEndReached = () => {
    if (replies.hasNextPage && !replies.isFetchingNextPage) {
      replies.fetchNextPage();
    }
  };

  // The notification's target comment is pinned under the root header, so
  // drop it from the regular list to avoid rendering it twice.
  const allPages = (
    replies.data?.pages.flatMap((page) => page.docs) ?? []
  ).filter((item) => !showHighlight || item.id !== highlightCommentId);
  const { isRefetchingByUser, refetchByUser } = useRefreshByUser(
    replies.refetch
  );

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-2.5">
          <Text className="text-center">
            {isError ? "Something went wrong" : "This comment has been deleted"}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      contentContainerClassName="py-safe"
      disableKeyboardAvoidingView
      statusBarStyle="auto"
    >
      <KeyboardAvoidingView
        behavior="padding"
        // keyboardVerticalOffset={50}
        style={{ flex: 1 }}
      >
        <LegendList
          data={allPages}
          keyExtractor={(item) => (typeof item === "string" ? item : item.id)}
          ListEmptyComponent={
            replies.isLoading ? (
              <ActivityIndicator />
            ) : showHighlight ? null : (
              <View className="flex-1 items-center justify-center">
                <Text>No replies yet</Text>
              </View>
            )
          }
          ListFooterComponent={
            replies.isFetchingNextPage ? <ActivityIndicator /> : null
          }
          ListHeaderComponent={
            <>
              <CommentCard comment={data} ref={ref} />
              {showHighlight && highlightedCommentQuery.data ? (
                <HighlightedReply
                  comment={highlightedCommentQuery.data}
                  inputRef={ref}
                />
              ) : null}
            </>
          }
          ListHeaderComponentStyle={{ marginVertical: 15 }}
          // showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          onRefresh={refetchByUser}
          recycleItems={false}
          refreshing={isRefetchingByUser && !replies.isFetchingNextPage}
          renderItem={({ item }) => <Reply comment={item} ref={ref} />}
          // ItemSeparatorComponent={() => <Stack h={15} />}
        />
        <CommentBox
          inputRef={ref}
          newsId={typeof data?.news === "string" ? data?.news : data?.news?.id}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default CommentReplies;
