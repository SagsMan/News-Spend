import type { TaskConfig } from "payload";

const RETENTION_DAYS = 90;
const BATCH_SIZE = 500;

export const cleanupAuditLogsTask = {
  slug: "cleanupAuditLogs",
  schedule: [
    {
      cron: "30 3 * * *",
      queue: "maintenance",
    },
  ],
  outputSchema: [
    {
      name: "deletedCount",
      type: "number",
    },
  ],
  retries: 1,
  handler: async ({ req }) => {
    const { payload } = req;
    const logger = payload.logger;

    logger.info("Starting audit log cleanup");

    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    let totalDeleted = 0;

    while (true) {
      const { docs: batch } = await payload.find({
        collection: "audit-logs",
        where: { createdAt: { less_than: cutoff } },
        limit: BATCH_SIZE,
        pagination: false,
        depth: 0,
      });

      if (batch.length === 0) {
        break;
      }

      const ids = batch.map((doc) => doc.id);

      try {
        const result = await payload.delete({
          collection: "audit-logs",
          where: { id: { in: ids } },
          overrideAccess: true,
        });

        const resultObj = result;

        totalDeleted += resultObj?.docs?.length ?? ids.length;
      } catch (err) {
        logger.error(
          { err, batchSize: ids.length },
          "Failed to delete batch of audit logs"
        );
      }
    }

    logger.info({ deletedCount: totalDeleted }, "Audit log cleanup completed");

    return { output: { deletedCount: totalDeleted } };
  },
} as TaskConfig;
