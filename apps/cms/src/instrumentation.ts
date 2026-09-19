import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Without this, App Router server component and route handler errors are
// swallowed by Next's own error boundary and never reach Sentry.
export const onRequestError = Sentry.captureRequestError;
