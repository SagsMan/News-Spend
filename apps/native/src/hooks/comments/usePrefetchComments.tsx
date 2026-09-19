import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { orpc } from "#/lib/orpc";

/**
 * Prefetches the first page of comments for a news article so the comments
 * screen paints instantly from cache when opened (its own query still
 * revalidates in the background). Options must mirror useGetComments exactly
 * so the cache keys match.
 */
export default function usePrefetchComments(newsId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!newsId) {
      return;
    }
    queryClient.prefetchInfiniteQuery(
      orpc.comments.all.infiniteOptions({
        input: (pageParam: number | undefined) => ({
          newsId,
          page: pageParam,
        }),
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextPage,
      })
    );
  }, [newsId, queryClient]);
}
