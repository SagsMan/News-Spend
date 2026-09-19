import { Expo } from "expo-server-sdk";
import type { PayloadRequest, TaskConfig } from "payload";

/**
 * Payload job task: checkPushReceipts
 *
 * Polls Expo's receipt API to confirm delivery status for a given notification.
 * Queued by expo-push-service.ts ~30 minutes after a send completes, replacing
 * the previous setTimeout approach.
 *
 * On DeviceNotRegistered: deletes the stale push token and marks the
 * notification-delivery record as failed.
 *
 * Usage:
 *   await req.payload.jobs.queue({
 *     task: 'checkPushReceipts',
 *     input: { notificationId: doc.id },
 *     waitUntil: new Date(Date.now() + 30 * 60 * 1000),
 *   })
 */

type TicketEntry = { deliveryId: string; pushToken: string };

async function processReceiptChunk(opts: {
  expo: Expo;
  chunk: string[];
  ticketMap: Map<string, TicketEntry>;
  req: PayloadRequest;
  notificationId: string;
}): Promise<number> {
  const { expo, chunk, ticketMap, req, notificationId } = opts;
  const payload = req.payload;
  let processed = 0;

  try {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

    for (const [receiptId, receipt] of Object.entries(receipts)) {
      const entry = ticketMap.get(receiptId);
      if (!entry) {
        continue;
      }

      processed += 1;
      const { deliveryId, pushToken } = entry;

      if (receipt.status === "ok") {
        await payload.update({
          collection: "notification-deliveries",
          id: deliveryId,
          data: {
            status: "delivered",
            deliveredAt: new Date().toISOString(),
            expoTicketId: null,
          },
          req,
        });
      } else if (receipt.status === "error") {
        const errorCode = receipt.details?.error;
        const message = `${receipt.message ?? "Unknown error"}${errorCode ? ` (${errorCode})` : ""}`;

        await payload.update({
          collection: "notification-deliveries",
          id: deliveryId,
          data: { status: "failed", errorMessage: message },
          req,
        });

        if (errorCode === "DeviceNotRegistered") {
          await payload.delete({
            collection: "push-tokens",
            where: { token: { equals: pushToken } },
            req,
          });
        }
      }
    }
  } catch (error) {
    req.payload.logger.error({
      msg: "checkPushReceipts: failed to fetch receipt chunk",
      err: error,
      notificationId,
    });
  }

  return processed;
}

export const checkPushReceiptsTask = {
  slug: "checkPushReceipts",
  inputSchema: [
    {
      name: "notificationId",
      type: "text",
      required: true,
    },
  ],
  outputSchema: [
    {
      name: "processed",
      type: "number",
      required: true,
    },
  ],
  retries: 1,
  handler: async ({ input, req }) => {
    const expo = new Expo();
    const payload = req.payload;

    const deliveries = await payload.find({
      collection: "notification-deliveries",
      where: {
        and: [
          { notification: { equals: input.notificationId } },
          { expoTicketId: { exists: true } },
          { status: { equals: "pending" } },
        ],
      },
      pagination: false,
      depth: 0,
    });

    if (deliveries.docs.length === 0) {
      return { output: { processed: 0 } };
    }

    const ticketMap = new Map<string, TicketEntry>();
    const receiptIds: string[] = [];

    for (const delivery of deliveries.docs) {
      if (delivery.expoTicketId) {
        ticketMap.set(delivery.expoTicketId, {
          deliveryId: delivery.id,
          pushToken: delivery.pushToken,
        });
        receiptIds.push(delivery.expoTicketId);
      }
    }

    const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    let totalProcessed = 0;

    for (const chunk of receiptChunks) {
      const count = await processReceiptChunk({
        expo,
        chunk,
        ticketMap,
        req,
        notificationId: input.notificationId,
      });
      totalProcessed += count;
    }

    return { output: { processed: totalProcessed } };
  },
} as TaskConfig<"checkPushReceipts">;
