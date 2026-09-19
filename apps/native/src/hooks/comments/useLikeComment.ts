import { isInferableError } from "@orpc/client";
import { useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc, type RouterOutputs } from "#/lib/orpc";
import type { HomeTabRouteProps } from "#/types";

type Comment = RouterOutputs["comments"]["one"];

type ReactionResponse = {
  userReaction: "like" | "dislike" | "none";
  likesCount: number;
  dislikesCount: number;
};

function useLikeComment(newsId: string, parentId?: string) {
  const queryClient = useQueryClient();
  const route = useRoute<HomeTabRouteProps<"Comment" | "CommentReply">>();
  const _type = route.name.startsWith("Live") ? "video" : "article";
  const _commentId = route.params?.commentId;

  return useMutation(
    orpc.comments.like.mutationOptions({
      // Optimistic update: toggle userReaction and adjust counts.
      onMutate: async (targetCommentId: string) => {
        await queryClient.cancelQueries({
          queryKey: orpc.comments.one.queryOptions({ input: targetCommentId })
            .queryKey,
        });
        await queryClient.cancelQueries({
          queryKey: orpc.comments.all.key(),
        });

        const previousComment = queryClient.getQueryData<Comment>(
          orpc.comments.one.queryOptions({ input: targetCommentId }).queryKey
        );

        const previousComments = queryClient.getQueryData(
          orpc.comments.all.infiniteKey({
            input: (pageParam: number | undefined) => ({
              newsId,
              parentId,
              page: pageParam,
            }),
            initialPageParam: undefined,
          })
        );

        const applyOptimistic = (comment: Comment): Comment => {
          const current = comment.userReaction ?? "none";
          const next: ReactionResponse["userReaction"] =
            current === "like" ? "none" : "like";
          const likesDelta = current === "like" ? -1 : 1;
          return {
            ...comment,
            userReaction: next,
            likesCount: Math.max(0, (comment.likesCount ?? 0) + likesDelta),
            dislikesCount: comment.dislikesCount ?? 0,
          };
        };

        if (previousComment) {
          queryClient.setQueryData(
            orpc.comments.one.queryKey({ input: targetCommentId }),
            applyOptimistic(previousComment)
          );
        }

        if (previousComments?.pages) {
          const newPages = previousComments.pages.map(
            (page: { docs: Comment[] }) => ({
              ...page,
              docs: page.docs.map((comment) =>
                comment.id === targetCommentId
                  ? applyOptimistic(comment)
                  : comment
              ),
            })
          );
          queryClient.setQueryData(
            orpc.comments.all.infiniteKey({
              input: (pageParam: number | undefined) => ({
                newsId,
                parentId,
                page: pageParam,
              }),
              initialPageParam: undefined,
            }),
            { ...previousComments, pages: newPages }
          );
        }

        return { previousComment, previousComments };
      },

      // Rollback on error
      onError: (error, variable, context) => {
        if (isInferableError(error)) {
          if (context?.previousComment) {
            queryClient.setQueryData(
              orpc.comments.one.queryKey({ input: variable }),
              context.previousComment
            );
          }
          if (context?.previousComments) {
            queryClient.setQueryData(
              orpc.comments.all.infiniteKey({
                input: (pageParam) => ({ newsId, parentId, page: pageParam }),
                initialPageParam: undefined,
              }),
              context.previousComments
            );
          }
        }
      },

      // Reconcile cache with server truth. Server returns
      // { userReaction, likesCount, dislikesCount }.
      onSuccess: (serverResponse, targetCommentId) => {
        const applyServer = (comment: Comment): Comment => ({
          ...comment,
          userReaction: serverResponse.userReaction,
          likesCount: serverResponse.likesCount,
          dislikesCount: serverResponse.dislikesCount,
        });

        const singleKey = orpc.comments.one.queryKey({
          input: targetCommentId,
        });
        const previousComment = queryClient.getQueryData<Comment>(singleKey);
        if (previousComment) {
          queryClient.setQueryData(singleKey, applyServer(previousComment));
        }

        const infiniteKey = orpc.comments.all.infiniteKey({
          input: (pageParam: number | undefined) => ({
            newsId,
            parentId,
            page: pageParam,
          }),
          initialPageParam: undefined,
        });
        const currentInfinite = queryClient.getQueryData(infiniteKey);
        if (currentInfinite?.pages) {
          const newPages = currentInfinite.pages.map(
            (page: { docs: Comment[] }) => ({
              ...page,
              docs: page.docs.map((comment) =>
                comment.id === targetCommentId ? applyServer(comment) : comment
              ),
            })
          );
          queryClient.setQueryData(infiniteKey, {
            ...currentInfinite,
            pages: newPages,
          });
        }
      },
    })
  );
}

export default useLikeComment;
