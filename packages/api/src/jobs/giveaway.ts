import { getPayload } from "@news-spend-media/payload";
import { Cron } from "croner";

/**
 * Queue the giveaway draw task every hour.
 *
 * Hourly rather than on the giveaway's own schedule, for the reason the
 * lottery job learned the hard way: a job that fires once per round has no
 * second chance. When Postgres was unreachable at that one moment, a round sat
 * past its end date with paid-for tickets and no winners until someone
 * noticed. An hourly sweep makes a missed window self-healing.
 *
 * This is only safe because the task is repeat-safe: the engine refuses to
 * draw a giveaway that is not `active`, and a draw leaves `active` as its
 * first act, so an overlapping run finds nothing to do.
 */
export function startGiveawayJob() {
  const expr = "0 * * * *";

  // see trending.ts, an unhandled rejection here exits the process
  const job = new Cron(
    expr,
    {
      catch: (err: unknown) =>
        console.error("giveaway job failed to queue", err),
    },
    async () => {
      try {
        // inside the try: getPayload() throws when Postgres is unreachable
        const payload = await getPayload();

        payload.logger.info("Queuing scheduled giveaway processing task");

        await payload.jobs.queue({
          task: "processGiveaway",
          input: {},
        });
      } catch (error) {
        console.error("giveaway job failed", error);
      }
    }
  );

  return job;
}

export default startGiveawayJob;
