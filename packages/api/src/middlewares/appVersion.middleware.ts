import { os } from "@orpc/server";

import type { Context } from "../context";
import { commonErrors } from "../errors";
import { APP_VERSION_HEADER, isBelowMinimum } from "../lib/appVersion";

/**
 * Refuse a build the server no longer supports, and say so plainly.
 *
 * Placed on `basicProcedure`, so it covers every procedure including the
 * unauthenticated ones. A client too old to be served is too old to sign in:
 * letting it authenticate and then fail on the next call is how "the app is
 * broken" gets reported instead of "the app asked me to update".
 *
 * Reads the version from a header rather than an input field, because it has
 * to apply to calls that were written before this existed and to calls whose
 * input shape has nothing to do with versioning.
 */
export const requireSupportedAppVersion = os
  .$context<Context>()
  .errors(commonErrors)
  .middleware(async ({ context, next, errors }) => {
    const version = context.headers?.get(APP_VERSION_HEADER);

    if (isBelowMinimum(version)) {
      throw errors.UPGRADE_REQUIRED();
    }

    return await next();
  });
