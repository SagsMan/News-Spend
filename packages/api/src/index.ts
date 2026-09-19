import { os } from "@orpc/server";
import * as Sentry from "@sentry/node";

import type { Context } from "./context";
import { commonErrors } from "./errors";
import { rateLimitMiddleware } from "./lib/ratelimit";
import { requireSupportedAppVersion } from "./middlewares/appVersion.middleware";
import {
  optionalAuth,
  requireAuth,
  requireAuthNoGuest,
} from "./middlewares/auth.middleware";
import { recordLastActive } from "./middlewares/lastActive.middleware";

export const sentryMiddleware = os.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
});

export const basicProcedure = os
  .$context<Context>()
  .errors(commonErrors)
  .use(sentryMiddleware)
  // Before anything else, including auth: an unsupported build should be told
  // to update rather than told its credentials are wrong.
  .use(requireSupportedAppVersion);
export const publicProcedure = basicProcedure.use(optionalAuth);
// Activity is recorded after auth, so the middleware has a user to attribute
// it to. Public procedures record too: a reader browsing news while signed in
// is active, and only counting the authenticated-only calls would make the
// segments measure engagement with a subset of the app.
export const protectedProcedure = basicProcedure
  .use(requireAuth)
  .use(recordLastActive);
export const protectedNoGuestProcedure = basicProcedure
  .use(requireAuthNoGuest)
  .use(recordLastActive);

export const rateLimitedPublicProcedure =
  publicProcedure.use(rateLimitMiddleware);
