import type { CollectionConfig } from "payload";

const Activities: CollectionConfig = {
  slug: "activities",
  access: {
    create: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: "type",
      type: "select",
      options: [
        { label: "Point", value: "point" },
        { label: "Badge", value: "badge" },
        { label: "Reward", value: "reward" },
      ],
      defaultValue: "point",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "point",
      type: "number",
      required: true,
      defaultValue: 0,
      index: true,
    },
    {
      name: "reward",
      type: "text",
    },
    {
      name: "action",
      type: "select",
      required: true,
      options: [
        { label: "Sign up", value: "signUp" },
        { label: "Watch live news", value: "watchLive" },
        { label: "Read news", value: "read" },
        { label: "Daily login", value: "dailyLogin" },
        { label: "Share news", value: "share" },
        { label: "Connect Brand Ad", value: "connectBrandAd" },
        { label: "Referral", value: "referral" },
        { label: "Ticket Purchase", value: "ticketPurchase" },
        // Value kept as "lottery" because the live giveaway claim path
        // writes it and historical rows carry it; only the label moved on.
        { label: "Giveaway", value: "lottery" },
        { label: "Survey Task", value: "surveyTask" },
        { label: "Music Listening Time", value: "musicListeningTime" },
        { label: "Partner Content Task", value: "partnerContentTask" },
        { label: "Point Reversal", value: "pointReversal" },
      ],
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "description",
      type: "text",
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      hasMany: false,
      required: true,
    },
    {
      name: "news",
      type: "relationship",
      relationTo: "news",
      hasMany: false,
      // validate: (val, {operation}) => {

      // }
    },
    {
      name: "metadata",
      type: "json",
      admin: {
        position: "sidebar",
      },
    },
  ],
};

export default Activities;
