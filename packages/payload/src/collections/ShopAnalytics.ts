import type { CollectionConfig } from "payload";

const ShopAnalytics: CollectionConfig = {
  slug: "shop-analytics",
  access: {
    read: () => true,
    create: () => true,
    update: () => false,
    delete: () => false,
  },
  admin: {
    useAsTitle: "type",
    group: "Analytics",
  },
  fields: [
    {
      name: "store",
      type: "relationship",
      relationTo: "partners",
      required: true,
      index: true,
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "View", value: "view" },
        { label: "Click", value: "click" },
      ],
      index: true,
    },
    {
      name: "userId",
      type: "text",
    },
    {
      name: "device",
      type: "select",
      options: [
        { label: "Mobile", value: "mobile" },
        { label: "Tablet", value: "tablet" },
        { label: "Desktop", value: "desktop" },
        { label: "Unknown", value: "unknown" },
      ],
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
      name: "timestamp",
      type: "date",
      required: true,
      defaultValue: () => new Date().toISOString(),
      index: true,
    },
  ],
};

export default ShopAnalytics;
