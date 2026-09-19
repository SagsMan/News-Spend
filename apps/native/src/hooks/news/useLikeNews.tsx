import { useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import type { HomeTabRouteProps } from "#/types";

type UserReaction = "like" | "dislike" | "none";

export default function useLikeNews() {
  const route = useRoute<HomeTabRouteProps<"News">>();
  const type = route.name === "News" ? "article" : "video";

  return useMutation(
    orpc.news.like.mutationOptions({
      onMutate: (data) => {
        // Cancel any outgoing refetches
        // (so they don't overwrite our optimistic update)
        queryClient.cancelQueries({
          queryKey: orpc.news.one.key({ input: { slug: data.slug, type } }),
        });

        // Snapshot the previous value
        const prevNews = queryClient.getQueryData(
          orpc.news.one.queryKey({ input: { slug: data.slug, type } })
        );

        const hasLiked = prevNews?.userReaction === "like";
        const hasDisliked = prevNews?.userReaction === "dislike";

        let newLikesCount = prevNews?.likesCount ?? 0;
        let newDislikesCount = prevNews?.dislikesCount ?? 0;
        let newUserReaction: UserReaction = prevNews?.userReaction ?? "none";

        if (hasLiked) {
          newLikesCount = Math.max(0, newLikesCount - 1);
          newUserReaction = "none";
        } else if (hasDisliked) {
          newLikesCount += 1;
          newDislikesCount = Math.max(0, newDislikesCount - 1);
          newUserReaction = "like";
        } else {
          newLikesCount += 1;
          newUserReaction = "like";
        }

        const optimisticNews = {
          ...prevNews,
          userReaction: newUserReaction,
          likesCount: newLikesCount,
          dislikesCount: newDislikesCount,
        };

        queryClient.setQueryData(
          orpc.news.one.queryKey({ input: { slug: data.slug, type } }),
          optimisticNews
        );

        return { prevNews, optimisticNews };
      },
      onError: (_err, variables, context) => {
        queryClient.setQueryData(
          orpc.news.one.queryKey({ input: { slug: variables?.slug, type } }),
          context?.prevNews
        );
      },
      // Reconcile cache with server truth instead of refetching. A refetch
      // re-reads the news doc and clobbers our optimistic userReaction (the
      // server's `userReaction` field lands in the refetched payload, so we
      // just trust the server response and merge it).
      onSuccess: (serverReaction, variables) => {
        const queryKey = orpc.news.one.queryKey({
          input: { slug: variables.slug, type },
        });
        const prevNews = queryClient.getQueryData(queryKey);
        if (!prevNews) {
          return;
        }
        queryClient.setQueryData(queryKey, {
          ...prevNews,
          userReaction: serverReaction.userReaction,
          likesCount: serverReaction.likesCount,
          dislikesCount: serverReaction.dislikesCount,
        });
      },
    })
  );
}
