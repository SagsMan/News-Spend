import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "#/components/heroui/toast";
import { orpc } from "#/lib/orpc";
import type { HomeTabRouteProps } from "#/types";

export default function useDeleteComment() {
  const route = useRoute<
    | HomeTabRouteProps<"Comment">
    | HomeTabRouteProps<"CommentReply">
  >();
  const { newsSlug: slug, newsId, commentId } = route.params;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const type =
    route.name === "Comment" || route.name === "CommentReply"
      ? "article"
      : "video";

  return useMutation(
    orpc.comments.delete.mutationOptions({
      onMutate(commentToDeleteId) {
        toast.loading("Deleting comment...", {
          duration: Number.POSITIVE_INFINITY,
        });

        const prevNews = queryClient.getQueryData(
          orpc.news.one.queryKey({ input: { slug, type } })
        );

        // If deleting a reply (not parent)
        if (commentId && commentToDeleteId !== commentId) {
          queryClient.cancelQueries({
            queryKey: orpc.comments.one.queryKey({ input: commentId }),
          });

          const previousComment = queryClient.getQueryData(
            orpc.comments.one.queryKey({ input: commentId })
          );
          const previousComments = queryClient.getQueryData(
            orpc.comments.all.infiniteKey({
              input: (pageParam) => ({
                newsId,
                parentId: commentId,
                page: pageParam,
              }),
              initialPageParam: undefined,
            })
          );

          queryClient.setQueryData(
            orpc.comments.one.queryKey({ input: commentId }),
            (data) => {
              if (!data) {
                return data;
              }
              return {
                ...data,
                totalReplies: Math.max((data.totalReplies ?? 0) - 1, 0),
                id: data.id, // Ensure id is preserved and not possibly undefined
              };
            }
          );

          queryClient.setQueryData(
            orpc.comments.all.infiniteKey({
              input: (pageParam) => ({
                newsId,
                parentId: commentId,
                page: pageParam,
              }),
              initialPageParam: undefined,
            }),
            (data) => {
              if (!data) {
                return data;
              }
              return {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  docs: page.docs.filter(
                    (comment) => comment.id !== commentToDeleteId
                  ),
                })),
                pageParams: data.pageParams,
              };
            }
          );

          queryClient.setQueryData(
            orpc.news.one.queryKey({ input: { slug, type } }),
            (data) => {
              if (!data) {
                return data;
              }
              return {
                ...data,
                totalComments: Math.max((data?.totalComments ?? 0) - 1, 0),
              };
            }
          );

          return { previousComment, previousComments, prevNews };
        }

        // Deleting parent comment or top-level comment
        queryClient.cancelQueries({
          queryKey: orpc.comments.all.infiniteKey({
            input: (pageParam) => ({ newsId, page: pageParam }),
            initialPageParam: undefined,
          }),
        });

        const previousComments = queryClient.getQueryData(
          orpc.comments.all.infiniteKey({
            input: (pageParam) => ({ newsId, page: pageParam }),
            initialPageParam: undefined,
          })
        );
        const _previousComment = commentId
          ? queryClient.getQueryData(
              orpc.comments.one.queryKey({ input: commentId })
            )
          : undefined;

        queryClient.setQueryData(
          orpc.comments.all.infiniteKey({
            input: (pageParam) => ({ newsId, page: pageParam }),
            initialPageParam: undefined,
          }),
          (data) => {
            if (!data) {
              return data;
            }
            return {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                docs: page.docs.filter(
                  (comment) => comment.id !== commentToDeleteId
                ),
              })),
              pageParams: data.pageParams,
            };
          }
        );

        // If deleting parent comment on reply screen
        if (commentId && commentToDeleteId === commentId) {
          navigation.goBack();
        } else {
          queryClient.setQueryData(
            orpc.news.one.queryKey({ input: { slug, type } }),
            (data) => {
              if (!data) {
                return data;
              }
              return {
                ...data,
                totalComments: Math.max((data.totalComments ?? 0) - 1, 0),
              };
            }
          );
        }

        return { previousComments, prevNews };
      },

      onError(error, variables, context) {
        console.log(error);
        toast.dismiss();
        toast.error("Something went wrong");

        queryClient.setQueryData(
          orpc.news.one.queryKey({ input: { slug, type } }),
          context?.prevNews
        );

        // If deleting a reply (not parent)
        if (context?.previousComment && context?.previousComments) {
          queryClient.setQueryData(
            orpc.comments.one.queryKey({ input: variables }),
            context.previousComment
          );
          queryClient.setQueryData(
            orpc.comments.all.infiniteKey({
              input: (pageParam) => ({
                newsId,
                parentId: variables,
                page: pageParam,
              }),
              initialPageParam: undefined,
            }),
            context.previousComments
          );
        }

        // If deleting parent/top-level comment
        if (context?.previousComments && !context?.previousComment) {
          queryClient.setQueryData(
            orpc.comments.all.infiniteKey({
              input: (pageParam) => ({ newsId, page: pageParam }),
              initialPageParam: undefined,
            }),
            context.previousComments
          );
        }
      },

      onSuccess(_data, variables, context) {
        toast.dismiss();
        toast.success("Comment deleted");

        // If deleting a reply (not parent)
        if (context?.previousComment && context?.previousComments) {
          queryClient.invalidateQueries({
            queryKey: orpc.comments.one.queryKey({ input: commentId }),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.comments.all.infiniteKey({
              input: (pageParam) => ({
                newsId,
                parentId: variables,
                page: pageParam,
              }),
              initialPageParam: undefined,
            }),
          });
          queryClient.invalidateQueries({
            queryKey: orpc.comments.all.infiniteKey({
              input: (pageParam) => ({ newsId, page: pageParam }),
              initialPageParam: undefined,
            }),
          });
        }

        // If deleting parent/top-level comment
        if (context?.previousComments && !context?.previousComment) {
          queryClient.invalidateQueries({
            queryKey: orpc.comments.all.infiniteKey({
              input: (pageParam) => ({ newsId, page: pageParam }),
              initialPageParam: undefined,
            }),
          });
        }
      },
    })
  );
}
