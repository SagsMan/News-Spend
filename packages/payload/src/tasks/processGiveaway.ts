import type { BasePayload, TaskConfig } from "payload";

import { expireLapsedClaims } from "../lib/giveaway/claim";
import { fulfilPendingPrizes } from "../lib/giveaway/fulfilPrizes";
import { GiveawayEngine } from "../lib/giveaway/GiveawayEngine";
import { retryFailedWinnerReports } from "../lib/giveaway/sendWinnerReport";

/**
 * Draw every active giveaway whose countdown has ended.
 *
 * Safe to call repeatedly. The engine refuses to start a draw for a giveaway
 * that is not `active`, and a draw moves the giveaway out of `active` as its
 * first act, so a second caller arriving mid-draw finds nothing to do.
 *
 * A giveaway that stopped part-way is deliberately left alone. Section 19 requires an
 * administrator to authorize a resumption, and a job that resumed draws by
 * itself would be exactly the "ordinary user restarting the draw" the
 * specification forbids.
 */
async function drawEndedGiveaways(payload: BasePayload): Promise<number> {
  const logger = payload.logger;

  const active = await payload.find({
    collection: "giveaways",
    where: {
      and: [
        { status: { equals: "active" } },
        { endDate: { less_than_equal: new Date().toISOString() } },
      ],
    },
    pagination: false,
    depth: 0,
  });

  let drawn = 0;

  for (const giveaway of active.docs) {
    logger.info(
      `[giveaway] drawing ${giveaway.id} (${giveaway.name}), ended ${giveaway.endDate}`
    );

    try {
      const result = await new GiveawayEngine(payload).runDraw(giveaway.id);
      logger.info(
        `[giveaway] ${giveaway.id} complete: ${result.totalWinners} winners from ${result.totalValidParticipants} participants`
      );
      drawn += 1;
    } catch (error) {
      /**
       * One giveaway failing must not stop the others, and must not fail the
       * task. The engine has already recorded the interruption and preserved
       * everything it awarded; failing here would burn the task's retries
       * re-attempting a draw that needs an administrator, and section 19 says only an
       * administrator may authorize that.
       */
      logger.error(
        { err: error, giveawayId: giveaway.id },
        "[giveaway] draw stopped: an administrator must review it"
      );
    }
  }

  return drawn;
}

/**
 * Payload job task: processGiveaway
 *
 * 1. Draws any active giveaway that has passed its end date.
 * 2. Pays out claimed airtime and data prizes through Reloadly (spec 15).
 * 3. Expires prizes whose claim window has closed (spec 21).
 * 4. Retries Winner Report emails that previously failed (spec 21).
 *
 * Queued hourly, so a run missed because the database was unreachable is
 * retried an hour later rather than never, the failure mode that left a
 * lottery round undrawn with paid-for tickets. All four steps are repeat-safe.
 *
 * Unlike the lottery task, this does NOT create the next giveaway. A giveaway
 * is only meaningful once an administrator has chosen its prize pool and unit
 * counts, and an automatically created empty one would be worse than none:
 * it would take the single `active` slot and start selling tickets for prizes
 * nobody had picked.
 */
export const processGiveawayTask: TaskConfig<"processGiveaway"> = {
  slug: "processGiveaway",
  outputSchema: [
    { name: "drawn", type: "number" },
    { name: "prizesFulfilled", type: "number" },
    { name: "prizesFailed", type: "number" },
    { name: "claimsExpired", type: "number" },
    { name: "reportsRetried", type: "number" },
    { name: "reportsSent", type: "number" },
  ],
  retries: 2,
  handler: async ({ req }) => {
    const { payload } = req;

    const drawn = await drawEndedGiveaways(payload);
    const fulfilment = await fulfilPendingPrizes(payload);
    const claimsExpired = await expireLapsedClaims(payload);
    const reports = await retryFailedWinnerReports(payload);

    if (fulfilment.attempted > 0) {
      payload.logger.info(
        `[giveaway] fulfilment: ${fulfilment.sent} sent, ${fulfilment.failed} failed, ${fulfilment.skipped} skipped`
      );
    }

    if (claimsExpired > 0) {
      payload.logger.info(
        `[giveaway] expired ${claimsExpired} unclaimed prize(s)`
      );
    }

    if (reports.retried > 0) {
      payload.logger.info(
        `[giveaway] retried ${reports.retried} winner report(s), ${reports.sent} sent`
      );
    }

    return {
      output: {
        drawn,
        prizesFulfilled: fulfilment.sent,
        prizesFailed: fulfilment.failed,
        claimsExpired,
        reportsRetried: reports.retried,
        reportsSent: reports.sent,
      },
    };
  },
};

export default processGiveawayTask;
