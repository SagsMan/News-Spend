import { useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";

function useCreateComment(slug: string) {
  const route = useRoute();

  const type =
    route.name === "Comment" || route.name === "CommentReply"
      ? "article"
      : "video";

  return useMutation(
    orpc.comments.create.mutationOptions({
      // TODO:update the comments list optimistically
      onSuccess: (_data, { newsId, parentId, replyingTo, text }) => {
        if (parentId) {
          queryClient.invalidateQueries({
            queryKey: orpc.comments.one.queryKey({ input: parentId }),
          }); // invalidate parent comment if it's a reply
          queryClient.invalidateQueries({
            queryKey: orpc.comments.all.infiniteKey({
              input: (pageParam) => ({ newsId, parentId, page: pageParam }),
              initialPageParam: undefined,
            }),
          }); // invalidate replies
        }

        queryClient.invalidateQueries({
          queryKey: orpc.news.one.queryKey({
            input: {
              slug,
              type,
            },
          }),
        }); // invalidate news if it's a top-level comment
        return queryClient.invalidateQueries({
          queryKey: orpc.comments.all.infiniteKey({
            input: (pageParam) => ({ newsId, page: pageParam }),
            initialPageParam: undefined,
          }),
        }); // invalidate comments
      },
    })
  );
}

export default useCreateComment;
