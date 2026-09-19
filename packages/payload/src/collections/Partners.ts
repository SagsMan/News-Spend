import { randomUUID } from "node:crypto";

import { type CollectionConfig, slugField } from "payload";
import { IMAGE_ONLY } from "../fields/uploadMimeFilters";
import { urlField } from "../fields/urlField";

export const Partners: CollectionConfig = {
  slug: "partners",
  admin: {
    group: "Partners",
    useAsTitle: "companyName",
    defaultColumns: ["companyName", "status", "category", "contractSigned"],
  },
  fields: [
    {
      name: "companyName",
      type: "text",
      required: true,
    },
    slugField({
      useAsSlug: "companyName",
      position: "sidebar",
      overrides(field) {
        return {
          ...field,
          admin: {
            ...field.admin,
            condition: () => process.env.NODE_ENV === "development",
          },
        };
      },
    }),
    {
      name: "description",
      type: "textarea",
    },
    urlField({
      name: "websiteUrl",
      required: true,
    }),
    {
      name: "status",
      type: "select",
      options: [
        { label: "Prospective", value: "prospective" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "prospective",
    },
    {
      name: "contractSigned",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "inShopTab",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "cashBack",
      type: "number",
      defaultValue: 0,
      admin: {
        description:
          "💡 Cashback is in percentage. For example, if the cashback is 5%, enter 5.",
        condition: (data) => data.inShopTab,
      },
    },
    {
      name: "popularityScore",
      type: "number",
      defaultValue: 0,
      index: true,
      admin: {
        description:
          "Auto-calculated popularity score based on views and clicks for the shop tab.",
        readOnly: true,
        position: "sidebar",
        condition: (data) => data.inShopTab,
      },
    },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Books & Publishing", value: "books" },
        { label: "E-commerce", value: "ecommerce" },
        { label: "Education", value: "education" },
        { label: "Food & Delivery", value: "food" },
        { label: "Digital Services", value: "digital" },
        { label: "Business Services", value: "business" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
      filterOptions: IMAGE_ONLY,
    },
    {
      name: "contactInfo",
      type: "group",
      fields: [
        {
          name: "contactPerson",
          type: "text",
        },
        {
          name: "email",
          type: "email",
        },
        {
          name: "phone",
          type: "text",
        },
      ],
    },
    {
      type: "collapsible",
      label: "CPA Integration",
      admin: {
        description: "Settings for CPA (Cost Per Action) tracking",
      },
      fields: [
        {
          name: "integrationMethod",
          type: "select",
          required: true,
          defaultValue: "manual",
          options: [
            { label: "📧 Manual (Email/Spreadsheet)", value: "manual" },
            { label: "🔗 Webhook (Real-time API)", value: "webhook" },
            { label: "📤 Postback URL", value: "postback" },
            { label: "📁 CSV Upload", value: "csv" },
          ],
          admin: {
            description: "How will this partner send conversion data?",
          },
        },
        {
          name: "webhookUrl",
          type: "text",
          admin: {
            readOnly: true,
            description: "Share this URL with technical partners",
            condition: (data) =>
              data.integrationMethod === "webhook" ||
              data.integrationMethod === "postback",
          },
        },
        {
          name: "webhookSecret",
          type: "text",
          admin: {
            description: "Secret key for webhook verification",
            condition: (data) =>
              data.integrationMethod === "webhook" ||
              data.integrationMethod === "postback",
          },
        },
        {
          name: "awardOnClick",
          label: "Count a click as a completed conversion",
          type: "checkbox",
          defaultValue: false,
          index: true,
          admin: {
            description:
              "ONLY for a partner that cannot post back yet. Points are credited and the Featured Offer counted the moment the link is opened, with nothing to confirm the user did anything. Turn it off the day their postback works. While it is on, this partner's offers are effectively free to complete.",
          },
        },
        {
          name: "apiKey",
          type: "text",
          admin: {
            readOnly: true,
            description: "API key for partner authentication",
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        // Auto-generate API key for new partners
        if (operation === "create" && !data.apiKey) {
          data.apiKey = `pk_${randomUUID().replace(/-/g, "")}`;
        }

        // Auto-generate webhook secret for webhook/postback partners
        if (
          (data.integrationMethod === "webhook" ||
            data.integrationMethod === "postback") &&
          !data.webhookSecret
        ) {
          data.webhookSecret = randomUUID().replace(/-/g, "");
        }

        // Auto-generate webhook URL (after partner is created with ID)
        if (
          (data.integrationMethod === "webhook" ||
            data.integrationMethod === "postback") &&
          !data.webhookUrl
        ) {
          const baseUrl =
            process.env.NEXT_PUBLIC_API_URL ||
            "https://api.news-spend-media.com";
          const partnerId = data.id || "PENDING";
          data.webhookUrl = `${baseUrl}/api/partner-conversions/webhook/${partnerId}`;
        }

        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        // If webhookUrl was PENDING, update it now that we have the ID
        if (operation === "create" && doc.webhookUrl?.includes("PENDING")) {
          const baseUrl =
            process.env.NEXT_PUBLIC_API_URL ||
            "https://api.news-spend-media.com";
          const webhookUrl = `${baseUrl}/api/partner-conversions/webhook/${doc.id}`;

          /**
           * `req` is passed so this runs inside the transaction that created
           * the partner. Without it the update opens its own connection, which
           * cannot see the uncommitted row, and every attempt to create a
           * webhook or postback partner fails with "Not Found". The create is
           * rolled back and the partner never exists.
           */
          await req.payload.update({
            collection: "partners",
            id: doc.id,
            data: {
              webhookUrl,
            },
            req,
          });
        }
      },
    ],
  },
};
