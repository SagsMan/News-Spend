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
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  enableLogs: true,
});
