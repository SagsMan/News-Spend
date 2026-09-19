import { client } from "#/lib/orpc";

export function trackNotificationOpen(data: {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  routeName?: string;
}) {
  client.notifications.trackOpen(data).catch(() => {});
}
