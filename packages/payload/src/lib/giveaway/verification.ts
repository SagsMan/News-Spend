import type { BasePayload } from "payload";

import { DIDIT_APPROVED, DiditClient, diditConfigFromEnv } from "./didit";

/**
 * Identity verification state for one person (spec 16).
 *
 * Verification is per user rather than per prize: the question is "is this the
 * person they say they are", and the answer does not change between one prize
 * and the next. Re-asking for every prize would be an insult dressed up as
 * diligence, and would lose prizes to the claim clock for no gain.
 */
export async function isUserVerified(
  payload: BasePayload,
  userId: string
): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: "identity-checks",
    where: {
      and: [
        { user: { equals: userId } },
        { status: { equals: DIDIT_APPROVED } },
      ],
    },
  });

  return totalDocs > 0;
}

/**
 * Start a verification session, reusing one that is already open.
 *
 * A person who backgrounds the app mid-flow and comes back should land in the
 * session they started, not a second one. Two open sessions for the same user
 * means two decisions racing, and whichever webhook arrives last wins.
 */
export async function startVerification(
  payload: BasePayload,
  userId: string,
  { client }: { client?: DiditClient } = {}
): Promise<{ sessionId: string; url: string; token: string | null }> {
  const config = diditConfigFromEnv();
  const resolved = client ?? (config ? new DiditClient(config) : null);

  if (!resolved) {
    throw new Error("No identity verification provider is configured.");
  }

  const session = await resolved.createSession(userId);

  /**
   * The provider hands back the session already open for this `vendor_data`
   * rather than minting a second one, so the same id arrives again whenever
   * somebody taps start twice. `sessionId` is unique here, deliberately, so a
   * replayed webhook updates one row instead of forking a person's history. A
   * blind insert would throw and lose them the flow entirely.
   */
  const existing = await payload.find({
    collection: "identity-checks",
    where: { sessionId: { equals: session.sessionId } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  if (!existing.docs[0]) {
    await payload.create({
      collection: "identity-checks",
      data: {
        user: userId,
        provider: "didit",
        sessionId: session.sessionId,
        status: "Not Started",
      },
    });
  }

  return session;
}

/**
 * Apply a provider decision, and release anything it was holding up.
 *
 * Called by the webhook once a payload's signature has been checked, never
 * with an unverified body, since an approval here is what lets a prize leave
 * the building.
 */
export async function recordDecision(
  payload: BasePayload,
  {
    sessionId,
    userId,
    status,
  }: { sessionId: string; userId: string; status: string }
): Promise<{ released: number; unknownUser?: true }> {
  /**
   * `vendor_data` is whatever was on the session, and a session can outlive
   * the account it was opened for, or carry a value from testing that was
   * never a user id at all. Writing it straight to a uuid column throws, and
   * because the caller answers 5xx on a throw, the provider would retry a
   * decision that can never succeed for as long as it keeps retrying.
   */
  if (!(await userExists(payload, userId))) {
    payload.logger.warn(
      { sessionId, userId, status },
      "[verification] decision for an unknown user: acknowledged, not stored"
    );
    return { released: 0, unknownUser: true };
  }

  const existing = await payload.find({
    collection: "identity-checks",
    where: { sessionId: { equals: sessionId } },
    limit: 1,
    pagination: false,
  });

  const row = existing.docs[0];
  const isFinal = status === DIDIT_APPROVED || status === "Declined";
  const data = {
    status,
    lastWebhookAt: new Date().toISOString(),
    ...(isFinal ? { decidedAt: new Date().toISOString() } : {}),
  };

  if (row) {
    await payload.update({
      collection: "identity-checks",
      id: row.id,
      data,
    });
  } else {
    // A decision for a session we have no record of still matters. Losing it
    // would strand a winner who did everything asked of them.
    await payload.create({
      collection: "identity-checks",
      data: {
        user: userId,
        provider: "didit",
        sessionId,
        ...data,
      },
    });
  }

  if (status !== DIDIT_APPROVED) {
    return { released: 0 };
  }

  return { released: await releaseHeldPrizes(payload, userId) };
}

/**
 * Whether this id belongs to a real account.
 *
 * `count` rather than `findByID`, because a malformed id (anything that is not
 * a uuid) makes the database reject the query outright rather than return
 * nothing, and a lookup that throws is exactly what this exists to avoid.
 */
async function userExists(
  payload: BasePayload,
  userId: string
): Promise<boolean> {
  try {
    const { totalDocs } = await payload.count({
      collection: "users",
      where: { id: { equals: userId } },
    });
    return totalDocs > 0;
  } catch {
    return false;
  }
}

/**
 * Move this user's prizes out of `awaiting_verification` now they are verified.
 *
 * Only that state is touched. A prize `on_hold` stays held, because that is an
 * administrator's decision and identity has nothing to say about it (22.8).
 */
async function releaseHeldPrizes(
  payload: BasePayload,
  userId: string
): Promise<number> {
  const waiting = await payload.find({
    collection: "giveaway-winners",
    where: {
      and: [
        { user: { equals: userId } },
        { fulfilmentStatus: { equals: "awaiting_verification" } },
        { claimStatus: { equals: "claimed" } },
      ],
    },
    limit: 100,
    pagination: false,
    depth: 0,
  });

  let released = 0;

  for (const winner of waiting.docs) {
    await payload.update({
      collection: "giveaway-winners",
      id: winner.id,
      data: { fulfilmentStatus: "pending" },
    });
    released += 1;
  }

  return released;
}
