import type { BasePayload } from "payload";

import { DEFAULT_GIVEAWAY_COUNTRY } from "../../collections/giveaway/constants";
import { notifyFulfilmentProblem } from "./notifyFulfilmentProblem";
import {
  ReloadlyClient,
  ReloadlyError,
  reloadlyConfigFromEnv,
} from "./reloadly";

/** How many payouts one pass will attempt. */
const FULFILMENT_BATCH_SIZE = 50;

/**
 * Retryable failures tolerated before a prize is handed to a human.
 *
 * A provider outage clears on its own within a few hourly passes. Something
 * still failing after this many is not transient, and leaving it in the queue
 * would retry it silently forever.
 */
const MAX_RETRYABLE_ATTEMPTS = 5;

export type FulfilmentSummary = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

type AttemptOutcome =
  | "sent"
  | "already_sent"
  | "retryable_failure"
  | "permanent_failure"
  | "skipped";

type RecordAttempt = (data: {
  outcome: AttemptOutcome;
  error?: string;
  providerTransactionId?: string;
  operatorId?: number;
  operatorName?: string;
  localAmount?: number;
}) => Promise<unknown>;

/**
 * Pay out claimed airtime and data prizes (spec 15).
 *
 * Only touches winners whose prize is delivered by the provider and whose
 * fulfilment is `pending`, a prize on hold, awaiting verification, or already
 * fulfilled is deliberately out of scope, so the states that stop a dispatch
 * keep stopping it.
 *
 * Never throws. This runs inside the scheduled task alongside the draw, and a
 * provider being unreachable must not take down the draw that shares the run.
 */
export async function fulfilPendingPrizes(
  payload: BasePayload,
  {
    client,
    limit = FULFILMENT_BATCH_SIZE,
  }: { client?: ReloadlyClient; limit?: number } = {}
): Promise<FulfilmentSummary> {
  const summary: FulfilmentSummary = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  const resolved = client ?? defaultClient(payload);
  if (!resolved) {
    return summary;
  }

  const pending = await payload.find({
    collection: "giveaway-winners",
    where: {
      and: [
        { claimStatus: { equals: "claimed" } },
        { fulfilmentStatus: { equals: "pending" } },
      ],
    },
    sort: "claimedAt",
    limit,
    pagination: false,
    depth: 1,
  });

  for (const winner of pending.docs) {
    const prize = winner.prize;
    const prizeDoc = typeof prize === "object" && prize !== null ? prize : null;
    const type = prizeDoc?.fulfilmentType;

    // Anything the provider does not deliver is somebody else's job.
    if (!(type === "airtime" || type === "data")) {
      continue;
    }

    summary.attempted += 1;

    /**
     * Mark the attempt before making it. `in_progress` existed in the schema
     * and nothing ever set it, which left `pending` covering two different
     * things: queued, and being sent right now. The app could only say
     * "Claimed" to both, so a winner watching for their airtime saw no
     * difference between "we have not started" and "we are trying".
     *
     * Set even though a pass usually finishes in seconds: a run that dies
     * mid-dispatch leaves a visible `in_progress` rather than a prize that
     * looks untouched, and the next pass picks it up either way.
     */
    await payload.update({
      collection: "giveaway-winners",
      id: winner.id,
      data: { fulfilmentStatus: "in_progress" },
    });

    const outcome = await fulfilOne(payload, resolved, winner);

    if (outcome === "sent") {
      summary.sent += 1;
    } else if (outcome === "skipped") {
      summary.skipped += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

function defaultClient(payload: BasePayload): ReloadlyClient | null {
  const config = reloadlyConfigFromEnv();

  if (!config) {
    payload.logger.warn(
      "[giveaway] Reloadly is not configured: airtime and data prizes will wait"
    );
    return null;
  }

  return new ReloadlyClient(config);
}

type Outcome = "sent" | "failed" | "skipped";

/**
 * The prize cannot be sent as configured, and no amount of retrying changes
 * that, held immediately rather than run through the provider's retry
 * classification, which has nothing to say about a decision made entirely on
 * this side.
 */
class UnresolvablePlanError extends Error {}

/**
 * Which network a detected operator belongs to, matched on its name.
 *
 * Deliberately not matched on `operatorId`. Reloadly's sandbox and live
 * catalogues are separate lists and an id that means "MTN Nigeria" in one is
 * not promised to mean anything in the other, so an id-based map silently
 * stops working the day the environment switches, and if an id happens to be
 * reused for a different network it resolves to the wrong one and sends an MTN
 * bundle to an Airtel SIM. The operator's name survives that switch.
 *
 * Matching a distinctive word rather than the full name, because the same
 * network appears as "MTN Nigeria" for airtime and "MTN Nigeria Data" for
 * bundles, and 9mobile still trades under its older names in some listings.
 */
const NETWORK_PATTERNS: { network: string; pattern: RegExp }[] = [
  { network: "mtn", pattern: /\bmtn\b/i },
  { network: "airtel", pattern: /\bairtel\b/i },
  { network: "glo", pattern: /\bglo\b/i },
  { network: "t2", pattern: /\b(t2|9\s*mobile|etisalat)\b/i },
];

/** The network family of a detected operator, or null if unrecognised. */
function networkOf(operatorName: string | undefined | null): string | null {
  if (!operatorName) {
    return null;
  }
  const matches = NETWORK_PATTERNS.filter((entry) =>
    entry.pattern.test(operatorName)
  );

  // Two matches means the name is ambiguous and picking either would be a
  // guess about somebody's payout. Treat it as unrecognised and hold.
  return matches.length === 1 ? matches[0].network : null;
}

async function fulfilOne(
  payload: BasePayload,
  client: ReloadlyClient,
  winner: Record<string, any>
): Promise<Outcome> {
  const prize = winner.prize as Record<string, any>;
  const phone = (winner.claimPhone as string | null)?.trim();
  const winnerId = String(winner.id);

  const record: RecordAttempt = (data) =>
    payload
      .create({
        collection: "giveaway-fulfilment-attempts",
        data: {
          winner: winnerId,
          provider: "reloadly",
          environment: client.isSandbox ? "sandbox" : "live",
          providerReference: winnerId,
          recipientPhone: phone,
          attemptedAt: new Date().toISOString(),
          ...data,
        },
      })
      .catch((error) => {
        // A lost log entry must not stop a payout that otherwise worked.
        payload.logger.error(
          { err: error, winnerId },
          "[giveaway] could not write a fulfilment attempt"
        );
      });

  if (!phone) {
    await hold(payload, winnerId, "No phone number was captured at claim.");
    await record({ outcome: "skipped", error: "no phone number" });
    return "skipped";
  }

  const isData = prize?.fulfilmentType === "data";
  let localAmount = 0;

  try {
    const plan = isData
      ? await resolveDataPlan(client, prize, phone)
      : await resolveAirtimeTopup(client, prize, phone);
    localAmount = plan.localAmount;

    const result = await client.topup({
      operatorId: plan.operatorId,
      localAmount: plan.localAmount,
      phone,
      countryCode: DEFAULT_GIVEAWAY_COUNTRY,
      customIdentifier: winnerId,
    });

    await payload.update({
      collection: "giveaway-winners",
      id: winnerId,
      data: {
        fulfilmentStatus: "fulfilled",
        fulfilledAt: new Date().toISOString(),
      },
    });

    await record({
      outcome: "sent",
      providerTransactionId: String(result.transactionId ?? ""),
      operatorId: plan.operatorId,
      operatorName: result.operatorName ?? "",
      localAmount: plan.localAmount,
    });

    return "sent";
  } catch (error) {
    if (error instanceof UnresolvablePlanError) {
      await hold(payload, winnerId, error.message);
      await record({ outcome: "skipped", error: error.message });
      return "skipped";
    }

    return await handleFailure(payload, winnerId, error, record, localAmount);
  }
}

/**
 * Airtime needs only an amount configured by a person: the network itself is
 * detected from the winner's phone number at send time, since airtime (unlike
 * data) is not locked to a specific carrier's own SIMs the same way.
 */
async function resolveAirtimeTopup(
  client: ReloadlyClient,
  prize: Record<string, any>,
  phone: string
): Promise<{ operatorId: number; localAmount: number }> {
  const localAmount = Number(
    prize?.reloadlyLocalAmount ?? prize?.valueNaira ?? 0
  );

  if (!(localAmount > 0)) {
    throw new UnresolvablePlanError("Prize has no value to send.");
  }

  const detected = await client.detectOperator(phone, DEFAULT_GIVEAWAY_COUNTRY);
  return { operatorId: detected.operatorId, localAmount };
}

/**
 * Match the winner's actual network to a data plan configured for it.
 *
 * A data bundle is provisioned by one specific network for that network's own
 * SIMs; an MTN bundle does nothing for an Airtel winner. So the winner's real
 * network is detected from their phone number, exactly as for airtime, and
 * then looked up against the rows a person configured on the prize. A network
 * with no configured row is held for review rather than sent a different
 * network's bundle, which would either silently fail or deliver nothing.
 */
async function resolveDataPlan(
  client: ReloadlyClient,
  prize: Record<string, any>,
  phone: string
): Promise<{ operatorId: number; operatorName: string; localAmount: number }> {
  const plans = (prize?.reloadlyDataPlans ?? []) as {
    network: string;
    reloadlyOperatorId: number;
    reloadlyLocalAmount: number;
  }[];

  if (plans.length === 0) {
    throw new UnresolvablePlanError(
      "Data prize has no Reloadly plans configured for any network."
    );
  }

  const detected = await client.detectOperator(phone, DEFAULT_GIVEAWAY_COUNTRY);
  const network = networkOf(detected.name);
  const plan = network ? plans.find((p) => p.network === network) : undefined;

  if (!plan) {
    throw new UnresolvablePlanError(
      `No data plan configured for the winner's network (${detected.name}).`
    );
  }

  return {
    operatorId: plan.reloadlyOperatorId,
    operatorName: detected.name,
    localAmount: plan.reloadlyLocalAmount,
  };
}

async function handleFailure(
  payload: BasePayload,
  winnerId: string,
  error: unknown,
  record: RecordAttempt,
  localAmount: number
): Promise<Outcome> {
  const message = error instanceof Error ? error.message : "Unknown error";

  /**
   * The provider recognised the identifier, which means the money already
   * went out on an earlier pass that died before recording it. Marking it
   * fulfilled is the correct reading: the alternative is a prize that looks
   * unpaid forever and a winner who has already been paid.
   */
  if (error instanceof ReloadlyError && error.isAlreadySent) {
    await payload.update({
      collection: "giveaway-winners",
      id: winnerId,
      data: {
        fulfilmentStatus: "fulfilled",
        fulfilledAt: new Date().toISOString(),
      },
    });
    await record({ outcome: "already_sent", localAmount, error: message });
    return "sent";
  }

  const retryable = error instanceof ReloadlyError ? error.retryable : true;

  if (!retryable) {
    await hold(payload, winnerId, `Provider rejected the payout: ${message}`);
    await record({ outcome: "permanent_failure", localAmount, error: message });
    return "failed";
  }

  const attempts = await payload.count({
    collection: "giveaway-fulfilment-attempts",
    where: {
      and: [
        { winner: { equals: winnerId } },
        { outcome: { equals: "retryable_failure" } },
      ],
    },
  });

  // Counting the attempt about to be written, not just the ones before it.
  if (attempts.totalDocs + 1 >= MAX_RETRYABLE_ATTEMPTS) {
    await hold(
      payload,
      winnerId,
      `Payout failed ${attempts.totalDocs + 1} times. Last error: ${message}`
    );
  } else {
    /**
     * Put it back in the queue.
     *
     * `in_progress` is a claim, not a label: the sweep selects `pending`, so a
     * prize left `in_progress` after a failure is invisible to every future
     * pass, retryable in name and abandoned in fact. This is the line that
     * makes the retry real, and it must stay paired with the claim above.
     */
    await payload.update({
      collection: "giveaway-winners",
      id: winnerId,
      data: { fulfilmentStatus: "pending" },
    });
  }

  await record({ outcome: "retryable_failure", localAmount, error: message });
  return "failed";
}

/**
 * Take a prize out of the queue and put it in front of a person.
 *
 * Both the administrator and the winner are told. Only the administrator was,
 * until now, and the winner is the one who may be able to fix the cause: a
 * mistyped phone number is the commonest reason a payout is rejected, and it
 * is invisible from the inside.
 */
async function hold(payload: BasePayload, winnerId: string, reason: string) {
  await payload.update({
    collection: "giveaway-winners",
    id: winnerId,
    data: { fulfilmentStatus: "on_hold", reviewNote: reason },
  });

  // Never throws; a notification failure must not undo a handled hold.
  await notifyFulfilmentProblem(payload, winnerId);
}
