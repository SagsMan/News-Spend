import { isIdentityProviderConfigured } from "@news-spend-media/payload/lib/giveaway/didit";
import {
  isUserVerified,
  startVerification,
} from "@news-spend-media/payload/lib/giveaway/verification";
import { ORPCError } from "@orpc/server";

import { protectedNoGuestProcedure } from "../index";

/**
 * Identity verification for the winner of a prize that requires it (spec 16).
 *
 * Guests are excluded throughout: a verification has to attach to an account
 * that will still exist when the prize ships.
 */

/** Whether this person has already been verified, and whether they can be. */
const status = protectedNoGuestProcedure.handler(async ({ context }) => {
  const verified = await isUserVerified(context.payload, context.user.id);

  return {
    verified,
    available: isIdentityProviderConfigured(),
  };
});

/**
 * Open a verification session and hand back what the app needs to run it.
 *
 * The session is created HERE rather than in the app. The provider attributes
 * a decision to whatever `vendor_data` the session carries, so creating it on
 * the client would let somebody put another person's user id in and have the
 * approval land on that account. The app receives an opaque url and token and
 * never sees a value it could change.
 */
const start = protectedNoGuestProcedure.handler(async ({ context }) => {
  if (!isIdentityProviderConfigured()) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Identity verification is not available right now.",
    });
  }

  // Nothing to do, and starting a second session for somebody already verified
  // would spend a provider check to learn what we know.
  if (await isUserVerified(context.payload, context.user.id)) {
    return { alreadyVerified: true, url: null, token: null };
  }

  try {
    const session = await startVerification(context.payload, context.user.id);

    return {
      alreadyVerified: false,
      url: session.url,
      token: session.token,
    };
  } catch (error) {
    context.payload.logger.error(
      { err: error, userId: context.user.id },
      "[verification] could not start a session"
    );
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "Could not start verification. Please try again shortly.",
    });
  }
});

export const verificationRouter = {
  status,
  start,
};
