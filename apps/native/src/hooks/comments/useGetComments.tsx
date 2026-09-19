import { useInfiniteQuery } from "@tanstack/react-query";

import { orpc } from "#/lib/orpc";

export default function useGetComments(
  newsId: string,
  _isRepliesScreen: boolean
) {
  return useInfiniteQuery(
    orpc.comments.all.infiniteOptions({
      input: (pageParam: number | undefined) => ({
        newsId,
        page: pageParam,
      }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextPage,
      staleTime: 0,
      enabled: !!newsId,
    })
  );
}
