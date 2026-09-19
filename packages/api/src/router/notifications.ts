import { sendNotification } from "@news-spend-media/payload/lib/send-notification";
import z from "zod";

import { publicProcedure } from "../index";

// Input schema for test notification
const TestNotificationInput = z.object({
  userId: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
  data: z.record(z.string(), z.any()).optional(),
});

const NewsCreateInput = z.object({
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.any()).optional(),
});

const testNotification = publicProcedure
  .input(TestNotificationInput)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const { userId, title, body, data } = input;

    // Find push tokens for the user
    const { docs: pushTokens } = await payload.find({
      collection: "push-tokens",
      where: {
        userId: {
          equals: userId,
        },
      },
    });

    if (!pushTokens.length) {
      return { success: false, message: "No push tokens found for user" };
    }

    await sendNotification({
      pushTokens,
      title: title ?? "Test Notification",
      body: body ?? "This is a test notification",
      data: data ?? {},
    });

    return { success: true };
  });

const newsCreate = publicProcedure
  .input(NewsCreateInput)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const { title, body, data } = input;

    // Find users with BREAKING_NEWS enabled
    const { docs: users } = await payload.find({
      collection: "users",
      where: {
        "notificationPreferences.types.BREAKING_NEWS": { equals: true },
      },
    });

    const { docs: pushTokens } = await payload.find({
      collection: "push-tokens",
      where: {
        user: { in: users.map((user) => user.id) },
      },
    });

    await sendNotification({
      pushTokens,
      title,
      body,
      data: data ?? {},
    });

    return { success: true };
  });

const trackOpenInput = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  routeName: z.string().optional(),
});

const trackOpen = publicProcedure
  .input(trackOpenInput)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const notificationId = input.data?.notificationId as string | undefined;
    const deviceToken = input.data?.deviceToken as string | undefined;

    if (notificationId && deviceToken) {
      const { docs } = await payload.find({
        collection: "notification-deliveries",
        where: {
          and: [
            { notification: { equals: notificationId } },
            { deviceToken: { equals: deviceToken } },
          ],
        },
        limit: 1,
        depth: 0,
      });

      if (docs[0]) {
        await payload.update({
          collection: "notification-deliveries",
          id: docs[0].id,
          data: {
            openedAt: new Date().toISOString(),
            status: "opened",
          },
        });
      }
    }

    return { success: true };
  });

export const notificationsRouter = {
  testNotification,
  newsCreate,
  trackOpen,
};
