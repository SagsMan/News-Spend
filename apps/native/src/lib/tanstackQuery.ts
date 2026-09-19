import { ORPCError } from "@orpc/client";
import * as Sentry from "@sentry/react-native";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.log(error, query.queryKey);

      // 426 means the server will not serve this build at all. Nothing else
      // will succeed either, so surface it once, globally.
      if (error instanceof ORPCError && error.code === "UPGRADE_REQUIRED") {
        import("#/state/upgrade").then(({ requireUpgrade }) =>
          requireUpgrade()
        );
        return;
      }

      if (error instanceof ORPCError && error.data?.httpStatus === 401) {
        Sentry.captureMessage("Session expired after retries");
        console.log("🚀 ~ Query error 401 after retries, logging out");
        import("#/state/auth").then(({ logout }) => logout());
      }
      if (error instanceof ORPCError && error.inferable) {
        console.error(error.message);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      console.log(error);

      // 426 means the server will not serve this build at all. Nothing else
      // will succeed either, so surface it once, globally.
      if (error instanceof ORPCError && error.code === "UPGRADE_REQUIRED") {
        import("#/state/upgrade").then(({ requireUpgrade }) =>
          requireUpgrade()
        );
        return;
      }

      if (error instanceof ORPCError && error.data?.httpStatus === 401) {
        Sentry.captureMessage("Session expired after retries", {});
        console.log("🚀 ~ Mutation error 401 after retries, logging out");
        import("#/state/auth").then(({ logout }) => logout());
      }
      if (error instanceof ORPCError && error.inferable) {
        console.error(error.message);
      }
    },
  }),
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      // Configure retry behavior for cold starts
      retry: (failureCount, error: any) => {
        // Detect likely cold start scenarios
        const isColdStartIndicator =
          error?.message?.includes("network") ||
          error?.message?.includes("timeout") ||
          error?.name === "AbortError" ||
          // Sometimes initial 401s can be due to cold starts
          error?.data?.httpStatus === 401;

        // For cold starts, retry up to 3 times
        if (isColdStartIndicator) {
          return failureCount < 3;
        }

        // Don't retry other errors
        return false;
      },
      retryDelay: (attemptIndex) => {
        // Use longer delays for cold starts
        // 2s → 4s → 8s
        return Math.min(2000 * 2 ** attemptIndex, 10_000);
      },
    },
  },
});
