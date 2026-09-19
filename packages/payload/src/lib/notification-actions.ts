"use server";

import { headers } from "next/headers";

import { getPayload } from "./getPayload";

// Types for notification data
type NotificationData = {
  title: string;
  body: string;
  data?: string;
  schedule?: boolean;
  scheduledDate?: Date;
  scheduledTime?: string;
  priority?: "default" | "high" | "normal";
  sound?: boolean;
  badge?: number;
  targetType: "all" | "segment" | "specific";
  segmentId?: string;
  specificUsers?: string;
  deviceTypes: ("all" | "ios" | "android" | "web")[];
};

interface ScheduledNotificationData extends NotificationData {
  scheduledAt: string;
}

/**
 * Send a push notification immediately by creating a Notifications campaign document.
 * The Notifications afterChange hook picks up status="sending" and dispatches via Expo.
 */
export async function processNotification(data: NotificationData) {
  const payload = await getPayload();
  const headerList = await headers();
  const auth = await payload.auth({ headers: headerList });

  // Build data separately so TypeScript can resolve the concrete type
  // before passing to payload.create (avoids draft-overload ambiguity).
  const createData = {
    title: data.title,
    body: data.body,
    type: "misc" as const,
    status: "sending" as const,
    targetType: data.targetType,
    deviceTypes: data.deviceTypes,
    priority: data.priority ?? ("default" as const),
    ...(data.data === undefined ? {} : { data: data.data }),
    ...(data.sound === undefined ? {} : { sound: data.sound }),
    ...(data.badge === undefined ? {} : { badge: data.badge }),
    ...(data.specificUsers ? { specificUsers: [data.specificUsers] } : {}),
    ...(auth.user
      ? { createdBy: { value: auth.user.id, relationTo: "admins" as const } }
      : {}),
  };

  // Payload's create() overload incorrectly resolves to the draft overload when
  // `data` is built with spread operators, even though `notifications` has no
  // versions/drafts configured. @ts-expect-error is the minimal workaround.
  await payload.create({
    collection: "notifications",
    // @ts-expect-error: draft overload false match, see comment above
    data: createData,
  });

  return { success: true };
}

/**
 * Schedule a push notification for later delivery.
 * Full implementation deferred. Use the Notifications admin UI for now.
 */
export async function scheduleNotification(data: ScheduledNotificationData) {
  console.log("Scheduling notification:", data);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { success: true };
}
