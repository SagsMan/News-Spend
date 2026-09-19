import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "#/components/heroui/toast";
import { userQueryOptions } from "#/hooks/auth/useUser";
import { useNewsAnalytics } from "#/hooks/news/useNewsAnalytics";
import { useReadingTracker } from "#/hooks/news/useNewsTracker";
import { orpc } from "#/lib/orpc";
import { queryClient } from "#/lib/tanstackQuery";
import { authState } from "#/state/auth";

export function useArticleTracking(data: ReturnType<typeof useNews>["data"]) {
  const recordViewMutation = useMutation(
    orpc.news.recordView.mutationOptions()
  );
  const addActivityMutation = useMutation(orpc.activity.add.mutationOptions());

  const {
    trackView,
    trackRead,
    trackLike,
    trackDislike,
    trackShare,
    trackComment,
  } = useNewsAnalytics(data ? { id: data.id, slug: data.slug } : undefined);

  const getUserPoint = useQuery(
    orpc.activity.byNewsId.queryOptions({
      input: { newsId: data?.id ?? "", action: "read" },
      enabled: !!authState.user && !!data,
    })
  );

  const {
    elapsedSeconds,
    minReadingSeconds,
    hasScrolledThreshold,
    inRapidScroll,
    isTracking,
    handleScroll,
    stopTracking,
  } = useReadingTracker(data, getUserPoint.data);

  // Track view + record view in one focus effect
  const hasTrackedView = useRef(false);
  const hasRecordedView = useRef(false);
  const prevId = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!data) {
        return;
      }

      // Reset flags when navigating to a different article
      if (prevId.current !== data.id) {
        hasTrackedView.current = false;
        hasRecordedView.current = false;
        prevId.current = data.id;
      }

      if (!hasTrackedView.current) {
        hasTrackedView.current = true;
        trackView();
      }

      if (!hasRecordedView.current) {
        hasRecordedView.current = true;
        recordViewMutation.mutate({ newsId: data.id });
      }
    }, [data, trackView, recordViewMutation.mutate])
  );

  // Award points once reading conditions are met
  useEffect(() => {
    const user = authState.user;
    if (
      user &&
      !user.isAnonymous &&
      data &&
      !addActivityMutation.isPending &&
      !addActivityMutation.isSuccess &&
      !addActivityMutation.isError &&
      !getUserPoint.data?.length &&
      !inRapidScroll &&
      elapsedSeconds >= minReadingSeconds &&
      hasScrolledThreshold
    ) {
      stopTracking();
      trackRead(elapsedSeconds, 0.85);
      addActivityMutation.mutate(
        {
          newsId: data.id,
          action: "read",
          type: "point",
          point: data.points ?? 0,
          description: "Read a news article",
        },
        {
          onSuccess: (res) => {
            if (res?.message === "ALREADY_READ") {
              return;
            }
            toast.success("Points earned", {
              description: `You earned ${data.points} points for reading this article!`,
            });
            queryClient.invalidateQueries({
              queryKey: orpc.activity.byNewsId.queryKey({
                input: { newsId: data.id, action: "read" },
              }),
            });
            queryClient.invalidateQueries(userQueryOptions);
          },
        }
      );
    }
  }, [
    elapsedSeconds,
    minReadingSeconds,
    hasScrolledThreshold,
    inRapidScroll,
    data,
    getUserPoint.data,
    addActivityMutation.isPending,
    addActivityMutation.isSuccess,
    addActivityMutation.isError,
    trackRead,
    stopTracking,
    addActivityMutation.mutate,
  ]);

  return {
    handleScroll,
    elapsedSeconds,
    minReadingSeconds,
    hasScrolledThreshold,
    inRapidScroll,
    isTracking,
    trackShare,
    trackComment,
  };
}
