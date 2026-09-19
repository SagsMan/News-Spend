import * as Sentry from "@sentry/nextjs";

import {
  SENTRY_DSN,
  SENTRY_ENABLED,
  SENTRY_ENVIRONMENT,
  SENTRY_RELEASE,
  SENTRY_TRACES_SAMPLE_RATE,
} from "./sentry.shared";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: SENTRY_ENVIRONMENT,
  release: SENTRY_RELEASE,
  sendDefaultPii: true,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  enableLogs: true,
});

// Feeds navigation timing into the traces above; without it client-side route
// changes in the Payload admin produce no transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
