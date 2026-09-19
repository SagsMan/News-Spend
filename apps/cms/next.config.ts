import path from "node:path";
import { fileURLToPath } from "node:url";

import { withPayload } from "@payloadcms/next/withPayload";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../.."
);

const nextConfig: NextConfig = {
  deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
  generateBuildId: () => process.env.RAILWAY_DEPLOYMENT_ID ?? null,
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  output: "standalone",
  // Memory (see Next.js "How to optimize memory usage" guide): the CMS idles
  // near its 1 GB Railway limit, so trade boot/first-hit speed for RSS.
  // `webpackMemoryOptimizations` lowers peak build memory at a small compile
  // time cost; disabling `preloadEntriesOnStart` stops Next from preloading
  // every route's modules (including the large Payload admin bundle) into
  // memory at server start — the first request pays the load cost instead.
  experimental: {
    webpackMemoryOptimizations: true,
    preloadEntriesOnStart: false,
  },
  // Keeps ssh2 and its optional cpu-features native binding out of the server
  // bundle, required by the cPanel SFTP storage adapter. This replaces an
  // equivalent `webpack.externals` block: declaring it here works under both
  // Webpack and Turbopack, whereas the webpack-only version made `next dev
  // --turbopack` warn that the two bundlers were configured differently.
  serverExternalPackages: ["ssh2", "cpu-features"],
  // `withPayload` always attaches a `webpack` config, and defaults `turbopack`
  // to `{}`. Next flattens the config and only counts a key it can actually
  // enumerate, so an empty object reads as "Turbopack not configured" and it
  // warns that the two bundlers disagree. Declaring the monorepo root is both
  // the correct setting here (Turbopack resolves nothing above this path)
  // and enough for that check to see a real Turbopack config.
  turbopack: {
    root: monorepoRoot,
  },
};

export default withSentryConfig(withPayload(nextConfig), {
  org: process.env.SENTRY_ORG || "news-spend-media",
  project: process.env.SENTRY_PROJECT || "cms",

  // Source map upload is skipped entirely when SENTRY_AUTH_TOKEN is absent, so
  // local and PR builds do not fail on a missing credential.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,

  // The maps are uploaded to Sentry and then deleted from the build output, so
  // stack traces stay readable without shipping sources to the browser.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Routes the browser SDK's requests through the app's own origin, so ad and
  // tracker blockers do not silently drop client-side errors.
  tunnelRoute: "/monitoring",

  // Strips the Sentry SDK's own debug logging from the production bundle.
  disableLogger: true,

  // Payload's admin bundle is large and already slow to build; instrumenting
  // every dependency's server components on top of that is not worth the time.
  widenClientFileUpload: false,
});
