import type { CollectionConfig } from "payload";

const NewsAnalytics: CollectionConfig = {
  slug: "news-analytics",
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: () => false,
    delete: () => false,
  },
  admin: {
    useAsTitle: "event",
    group: "Analytics",
    defaultColumns: ["article", "event", "platform", "timestamp"],
  },
  fields: [
    {
      name: "article",
      type: "relationship",
      relationTo: "news",
      required: true,
      index: true,
    },
    {
      name: "event",
      type: "select",
      required: true,
      index: true,
      options: [
        { label: "Impression", value: "impression" },
        { label: "View", value: "view" },
        { label: "Read", value: "read" },
        { label: "Like", value: "like" },
        { label: "Dislike", value: "dislike" },
        { label: "Share", value: "share" },
        { label: "Comment", value: "comment" },
      ],
    },
    {
      name: "userId",
      type: "text",
      index: true,
    },
    {
      name: "sessionId",
      type: "text",
      required: true,
    },
    {
      name: "deviceId",
      type: "text",
      required: true,
    },
    {
      name: "platform",
      type: "select",
      options: [
        { label: "Android", value: "android" },
        { label: "iOS", value: "ios" },
        { label: "Web", value: "web" },
      ],
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        description:
          "Event-specific data: position, screen, timeSpent, scrollDepth, shareMethod",
      },
    },
    {
      name: "timestamp",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
    },
  ],
};

export default NewsAnalytics;
