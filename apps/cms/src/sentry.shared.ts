// Settings shared by the server, edge and client Sentry initialisations so the
// three runtimes cannot drift apart on environment, release or sampling.

// Not a secret: a DSN only grants the ability to send events in. Kept as a
// fallback so a deploy that has not had the env var set still reports.
const FALLBACK_DSN =
  "https://bc94d3ac557ba118f6eec8d4b98c60a3@o4507648362938368.ingest.de.sentry.io/4510804652392528";

export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || FALLBACK_DSN;

export const SENTRY_ENVIRONMENT =
  process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || "local";

// Next only inlines NEXT_PUBLIC_* into the browser bundle, so the bare Railway
// variable resolves on the server but comes out undefined on the client. The
// Dockerfile maps the commit SHA onto the public name for that reason; without
// it, client-side events arrive with no release attached.
export const SENTRY_RELEASE =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.RAILWAY_GIT_COMMIT_SHA;

const isProduction = SENTRY_ENVIRONMENT === "production";

// Off in local development unless explicitly opted in, so day-to-day work does
// not pollute the production issue stream.
export const SENTRY_ENABLED =
  SENTRY_ENVIRONMENT !== "local" ||
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";

// Tracing every request is affordable at current volume but is the first thing
// to turn down if the quota gets tight, hence the env override.
export const SENTRY_TRACES_SAMPLE_RATE = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? 0.2 : 1)
);
