import { os } from "@orpc/server";

import type { Context } from "../context";
import { commonErrors } from "../errors";

const base = os.$context<Context>().errors(commonErrors);
export const optionalAuth = base.middleware(async ({ context, next }) =>
  next({
    context: {
      session: context.session,
      user: context.user,
    },
  })
);

export const requireAuth = base.middleware(({ errors, context, next }) => {
  if (!(context.session && context.user)) {
    throw errors.UNAUTHORIZED();
  }
  return next({
    context: {
      session: context.session,
      user: context.user,
    },
  });
});

// Rejects anonymous/guest users - for endpoints only registered users can access
export const requireAuthNoGuest = base.middleware(
  ({ errors, context, next }) => {
    if (!(context.session && context.user)) {
      throw errors.UNAUTHORIZED();
    }
    if (context.user.isAnonymous) {
      throw errors.FORBIDDEN({
        message: "Guest users cannot perform this action",
      });
    }
    return next({
      context: {
        session: context.session,
        user: context.user,
      },
    });
  }
);
