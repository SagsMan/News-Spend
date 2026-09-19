import { useRoute } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import type { HomeTabRouteProps } from "#/types";

function useUpdateComment(_slug: string) {
  const route = useRoute<
    | HomeTabRouteProps<"Comment">
    | HomeTabRouteProps<"CommentReply">
  >();

  const _type =
    route.name === "Comment" || route.name === "CommentReply"
      ? "article"
      : "video";

  const { params } = route;

  return useMutation(
    orpc.comments.update.mutationOptions({
      // TODO:update the comments list optimistically
      // onMutate(variables) {
      //   // if we are on reply screen
      //   if (params.commentId) {
      //     utils.comments.one.cancel(params.commentId);

      //     const previousComment = utils.comments.one.getData(params.commentId);
      //     const prevComments = utils.comments.all.getData(params.newsId);

      //     // if it is the parent comment
      //     if (params.commentId === variables.commentId) {
      //       utils.comments.all.setData(params.newsId, (data) => {
      //         return data?.map((comment) => {
      //           if (comment._id === params.commentId) {
      //             return {
      //               ...comment,
      //               text: variables.text,
      //             };
      //           }
      //           return comment;
      //         });
      //       });

      //       utils.comments.one.setData(params.commentId, (data) => {
      //         return {
      //           ...data,
      //           text: variables.text,
      //         };
      //       });
      //     } else {
      //       const replies = previousComment?.replies ?? [];
      //       utils.comments.one.setData(params.commentId, (data) => {
      //         return {
      //           ...data,
      //           replies: replies.map((reply) => {
      //             if (reply._id === variables.commentId) {
      //               return {
      //                 ...reply,
      //                 text: variables.text,
      //               };
      //             }
      //             return reply;
      //           }),
      //         };
      //       });
      //     }

      //     return {
      //       previousComment,
      //       prevComments,
      //     };
      //   } else {
      //     utils.comments.all.cancel(params.newsId);

      //     const previousComments = utils.comments.all.getData(params.newsId);

      //     utils.comments.all.setData(params.newsId, (data) => {
      //       return data?.map((comment) => {
      //         if (comment._id === variables.commentId) {
      //           return {
      //             ...comment,
      //             text: variables.text,
      //           };
      //         }
      //         return comment;
      //       });
      //     });

      //     return {
      //       previousComments,
      //     };
      //   }
      // },
      onError(error, _variables, _context) {
        console.error(error);

        // if (params?.commentId) {
        //   if (params.commentId === variables.commentId) {
        //     utils.comments.all.setData(params.newsId, context?.prevComments);
        //   }
        //   utils.comments.one.setData(params.commentId, context?.previousComment);
        // } else {
        //   utils.comments.all.setData(params.newsId, context?.previousComments);
        // }
      },
      onSuccess: (_data, { commentId }) => {
        //TODO: still considering if this is needed
        // yes, it is
        return queryClient.invalidateQueries({ queryKey: orpc.comments.key() });
        // if (params?.commentId) {
        //   if (params.commentId === commentId) {
        //     utils.comments.all.invalidate(params.newsId);
        //   } else {
        //     utils.comments.one.invalidate(params.commentId);
        //   }
        // } else {
        //   utils.comments.all.invalidate(params.newsId); // invalidate comments
        // }
      },
    })
  );
}

export default useUpdateComment;
