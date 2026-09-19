import type { CollectionConfig, PayloadRequest } from "payload";

import { authenticated } from "../access/authenticated";
import { adminOnly } from "../access/hasRole";
import { NOTIFICATION_TYPES } from "./NotificationInbox";

/**
 * Drop any send still waiting for this notification.
 *
 * The afterChange hook queues on every published save, so without this a
 * second save before the send time leaves two jobs waiting on the same
 * notification and everyone receives it twice. Editing a scheduled
 * notification is normal (a typo, a reworded title, or a time an
 * administrator in another timezone believed was wrong), so the duplicate was
 * easy to produce and invisible until the pushes landed.
 *
 * Only unstarted jobs are removed: one already running or completed is a send
 * that has happened, and deleting its row would not unsend it.
 */
async function cancelPendingSends(
  notificationId: string,
  req: PayloadRequest
): Promise<void> {
  try {
    await req.payload.delete({
      collection: "payload-jobs",
      where: {
        and: [
          { taskSlug: { equals: "sendScheduledNotification" } },
          { "input.notificationId": { equals: notificationId } },
          { completedAt: { exists: false } },
          { processing: { not_equals: true } },
        ],
      },
      req,
    });
  } catch (err) {
    // A failure to tidy up must not block the save. The worst case is the
    // duplicate this exists to prevent, which is better than an editor being
    // unable to fix a typo.
    req.payload.logger.error({
      msg: "Notifications: could not cancel pending scheduled sends",
      err,
      notificationId,
    });
  }
}

const Notifications: CollectionConfig = {
  slug: "notifications",
  admin: {
    useAsTitle: "title",
    group: "Push Notifications",
  },
  versions: {
    drafts: true,
  },
  access: {
    read: authenticated,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: {
        description: "Notification title",
      },
    },
    {
      name: "body",
      type: "textarea",
      required: true,
      admin: {
        description: "Notification message body",
      },
    },
    {
      name: "type",
      type: "select",
      options: NOTIFICATION_TYPES,
      defaultValue: "misc",
      admin: {
        description: "Notification category",
      },
    },
    {
      name: "data",
      type: "json",
      admin: {
        description: "Additional data to send with the notification",
      },
    },
    {
      name: "deliveryAction",
      type: "radio",
      options: [
        {
          label: "Send Immediately",
          value: "send-now",
        },
        {
          label: "Schedule",
          value: "schedule",
        },
      ],
      defaultValue: "send-now",
      admin: {
        description: "Choose when to deliver this notification",
      },
    },
    {
      name: "scheduledFor",
      type: "date",
      /**
       * The instant is absolute; the timezone records who chose it.
       *
       * `scheduled_for` is a `timestamptz`, so the moment of delivery has
       * never been in doubt: the job runner fires it at one instant and every
       * reader on earth gets it then. What was missing is the *intent* behind
       * the number. Without a recorded zone, an administrator in Lagos who
       * schedules 10:00 and one in Toronto who opens the same document see
       * 10:00 and 05:00, and the second may "correct" a time that was never
       * wrong, moving the send for everyone.
       *
       * Storing the zone alongside makes the entry self-describing: the
       * document says "10:00 Africa/Lagos", which reads the same in Toronto.
       */
      timezone: true,
      admin: {
        condition: (data) => data?.deliveryAction === "schedule",
        description:
          "When to send this notification. Pick the time and the timezone you mean it in; everyone receives it at that same moment, shown in their own local time.",
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "targetType",
      type: "select",
      options: ["all", "segment", "specific"],
      defaultValue: "all",
      admin: {
        description: "Target audience type",
      },
    },
    {
      name: "segment",
      type: "select",
      options: [
        {
          label: "Active Users",
          value: "active-users",
        },
        {
          label: "Inactive Users (30+ days)",
          value: "inactive-users",
        },
        {
          label: "New Users (7 days)",
          value: "new-users",
        },
      ],
      admin: {
        condition: (data) => data?.targetType === "segment",
        description: "User segment to target",
      },
    },
    {
      name: "specificUsers",
      type: "relationship",
      relationTo: "users",
      hasMany: true,
      admin: {
        condition: (data) => data?.targetType === "specific",
        description: "Specific users to target",
      },
    },
    {
      name: "deviceTypes",
      type: "select",
      options: ["all", "ios", "android"],
      defaultValue: "all",
      hasMany: true,
      admin: {
        description: "Device types to target",
      },
    },
    {
      name: "priority",
      type: "select",
      options: ["default", "high", "normal"],
      defaultValue: "default",
      admin: {
        description: "Notification priority",
      },
    },
    {
      name: "sound",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description: "Play sound when notification is received",
      },
    },
    {
      name: "badge",
      type: "number",
      admin: {
        description: "Number to display on app icon badge (iOS only)",
      },
    },
    {
      name: "sentAt",
      type: "date",
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: "dayAndTime",
        },
        description: "When this notification was sent",
      },
    },
    {
      name: "totalDelivered",
      type: "number",
      virtual: true,
      admin: {
        readOnly: true,
        description:
          "Total number of recipients who received this notification",
      },
    },
    {
      name: "totalFailed",
      type: "number",
      virtual: true,
      admin: {
        readOnly: true,
        description:
          "Total number of recipients who failed to receive this notification",
      },
    },
    {
      name: "totalOpened",
      type: "number",
      virtual: true,
      admin: {
        readOnly: true,
        description: "Total number of recipients who opened this notification",
      },
    },
    {
      name: "createdAt",
      type: "date",
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "updatedAt",
      type: "date",
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    afterDelete: [
      async ({ doc, req }) => {
        await req.payload.delete({
          collection: "notification-inbox",
          where: { notification: { equals: doc.id } },
          req,
        });

        await req.payload.delete({
          collection: "notification-deliveries",
          where: { notification: { equals: doc.id } },
          req,
        });
      },
    ],
    afterChange: [
      async ({ operation, doc, req }) => {
        if (operation !== "create" && operation !== "update") {
          return doc;
        }

        if (doc._status !== "published") {
          return doc;
        }

        if (doc.sentAt) {
          return doc;
        }

        const deliveryAction = doc.deliveryAction;

        if (deliveryAction === "schedule" && doc.scheduledFor) {
          await cancelPendingSends(doc.id, req);

          await req.payload.jobs.queue({
            task: "sendScheduledNotification",
            input: { notificationId: doc.id },
            waitUntil: new Date(doc.scheduledFor),
          });
          return doc;
        }

        // Switched from scheduled back to immediate, or unscheduled entirely:
        // whatever was waiting must not still fire.
        if (deliveryAction !== "schedule") {
          await cancelPendingSends(doc.id, req);
        }

        if (deliveryAction === "send-now") {
          const { sendNotification } = await import("../lib/expo-push-service");
          await sendNotification(doc.id, req);
        }

        return doc;
      },
    ],
    afterRead: [
      async ({ req, doc }) => {
        const [delivered, failed, opened] = await Promise.all([
          req.payload.count({
            collection: "notification-deliveries",
            where: {
              status: { equals: "delivered" },
              notification: { equals: doc.id },
            },
          }),
          req.payload.count({
            collection: "notification-deliveries",
            where: {
              status: { equals: "failed" },
              notification: { equals: doc.id },
            },
          }),
          req.payload.count({
            collection: "notification-inbox",
            where: {
              clickCount: { greater_than: 0 },
              notification: { equals: doc.id },
            },
          }),
        ]);

        doc.totalDelivered = delivered.totalDocs;
        doc.totalFailed = failed.totalDocs;
        doc.totalOpened = opened.totalDocs;

        return doc;
      },
    ],
  },
  endpoints: [
    {
      path: "/:id/errors",
      method: "get",
      handler: async (req) => {
        const errorLogs = await req.payload.find({
          collection: "notification-deliveries",
          pagination: false,
          depth: 0,
          where: {
            status: { equals: "failed" },
            notification: { equals: req.routeParams?.id },
          },
        });

        return Response.json(errorLogs);
      },
    },
  ],
};

export default Notifications;
