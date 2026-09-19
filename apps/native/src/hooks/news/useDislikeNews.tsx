import { useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import type { HomeTabRouteProps } from "#/types";

type UserReaction = "like" | "dislike" | "none";

export default function useDislikeNews() {
  const route = useRoute<HomeTabRouteProps<"News">>();
  const type = route.name === "News" ? "article" : "video";

  return useMutation(
    orpc.news.dislike.mutationOptions({
      onMutate: async (data) => {
        // Cancel any outgoing refetch
        // (so they don't overwrite our optimistic update)
        queryClient.cancelQueries({
          queryKey: orpc.news.one.queryKey({
            input: { slug: data.slug, type },
          }),
        });

        // Snapshot the previous value
        const prevNews = queryClient.getQueryData(
          orpc.news.one.queryKey({ input: { slug: data.slug, type } })
        );

        let newLikesCount = prevNews?.likesCount ?? 0;
        let newDislikesCount = prevNews?.dislikesCount ?? 0;
        let newUserReaction: UserReaction = prevNews?.userReaction ?? "none";

        if (newUserReaction === "dislike") {
          // User is un-disliking
          newUserReaction = "none";
          newDislikesCount = Math.max(0, newDislikesCount - 1);
        } else if (newUserReaction === "like") {
          // User previously liked, now disliking
          newUserReaction = "dislike";
          newDislikesCount += 1;
          newLikesCount = Math.max(0, newLikesCount - 1);
        } else {
          // newUserReaction === "none"
          // User had no reaction, now disliking
          newUserReaction = "dislike";
          newDislikesCount += 1;
        }

        const optimisticNews = {
          ...prevNews,
          userReaction: newUserReaction,
          dislikesCount: newDislikesCount,
          likesCount: newLikesCount,
        };

        queryClient.setQueryData(
          orpc.news.one.queryKey({ input: { slug: data.slug, type } }),
          optimisticNews
        );

        return { prevNews, optimisticNews };
      },
      // If the mutation fails, use the context we returned above
      onError: (_err, news, context) => {
        queryClient.setQueryData(
          orpc.news.one.queryKey({ input: { slug: news.slug, type } }),
          context?.prevNews
        );
      },
      // Reconcile cache with server truth instead of refetching. A refetch
      // re-reads the news doc and clobbers our optimistic userReaction.
      onSettled: (serverReaction, _error, variables) => {
        const slug = variables?.slug;
        if (!(slug && serverReaction)) {
          return;
        }
        const queryKey = orpc.news.one.queryKey({
          input: { slug, type },
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
