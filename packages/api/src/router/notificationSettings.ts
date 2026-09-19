import z from "zod";

import { protectedNoGuestProcedure } from "../index";

// Notification types as const object
export const notification_type = {
  BREAKING_NEWS: "BREAKING_NEWS",
  NEWS: "NEWS",
  COMMENT: "COMMENT",
  EARNING_OPPORTUNITY: "EARNING_OPPORTUNITY",
  MISC: "MISC",
} as const;

export type NotificationType =
  (typeof notification_type)[keyof typeof notification_type];

// Input schema for update
const UpdateNotificationSettingsInput = z.object({
  notification_type: z.enum([
    notification_type.BREAKING_NEWS,
    notification_type.NEWS,
    notification_type.COMMENT,
    notification_type.EARNING_OPPORTUNITY,
    notification_type.MISC,
  ]),
  enabled: z.boolean(),
});

const update = protectedNoGuestProcedure
  .input(UpdateNotificationSettingsInput)
  .handler(async ({ input, context }) => {
    const {
      payload,
      user: { id: userId },
    } = context;

    // Fetch user
    const user = await payload.findByID({
      collection: "users",
      id: userId,
    });

    const notificationPreference = user?.notificationPreferences;

    const newPreference = {
      ...notificationPreference,
      types: {
        ...notificationPreference?.types,
        [input.notification_type]: input.enabled,
      },
    };

    const updatedUser = await payload.update({
      collection: "users",
      id: userId,
      data: {
        notificationPreferences: newPreference,
      },
    });

    return updatedUser;
  });

const get = protectedNoGuestProcedure.handler(async ({ context }) => {
  const {
    payload,
    user: { id: userId },
  } = context;

  // Fetch user
  const user = await payload.findByID({
    collection: "users",
    id: userId,
  });

  return user?.notificationPreferences ?? null;
});

export const notificationSettingsRouter = {
  update,
  get,
};
