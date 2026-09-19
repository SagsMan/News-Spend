import type { TaskConfig } from "payload";

/**
 * Payload job task: sendScheduledNotification
 *
 * Queued by the Notifications afterChange hook when a notification is saved
 * with `isScheduled: true`. The job runner fires it at `waitUntil` (scheduledFor).
 *
 * Usage:
 *   await req.payload.jobs.queue({
 *     task: 'sendScheduledNotification',
 *     input: { notificationId: doc.id },
 *     waitUntil: new Date(doc.scheduledFor),
 *   })
 */
export const sendScheduledNotificationTask = {
  slug: "sendScheduledNotification",
  inputSchema: [
    {
      name: "notificationId",
      type: "text",
      required: true,
    },
  ],
  outputSchema: [
    {
      name: "sent",
      type: "checkbox",
      required: true,
    },
  ],
  retries: 2,
  handler: async ({ input, req }) => {
    // Dynamic import avoids circular dependency with the hook that queues this task
    const { sendNotification } = await import("../lib/expo-push-service");
    await sendNotification(input.notificationId, req);
    return { output: { sent: true } };
  },
} as TaskConfig<"sendScheduledNotification">;
