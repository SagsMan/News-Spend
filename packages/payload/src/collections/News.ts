import { BlocksFeature, lexicalEditor } from "@payloadcms/richtext-lexical";
import { type CollectionConfig, slugField, ValidationError } from "payload";

import { authenticated } from "../access/authenticated";
import { authenticatedOrPublished } from "../access/authenticatedOrPublished";
import { AdsBlock, ReadAlsoBlock } from "../blocks";
import { IMAGE_ONLY } from "../fields/uploadMimeFilters";
import { trimUrlHook } from "../fields/urlField";
import { calculateNewsMetrics, sendNotificationOnCreate } from "../hooks";
import type { Admin } from "../payload-types";

const News: CollectionConfig = {
  slug: "news",
  access: {
    read: authenticatedOrPublished,
    create: authenticated,
  },
  admin: {
    useAsTitle: "title",
  },
  hooks: {
    // beforeOperation: [
    //   ({ args, operation }) => {
    //     if (operation === 'update' || operation === 'create') {
    //       args.depth = 2
    //     }
    //     return args
    //   },
    // ],
    beforeValidate: [
      /**
       * Video news is disabled for now.
       *
       * Removing the option stops the admin panel offering it, but the option
       * list is a UI and field-validation concern reached through Payload's
       * own form. This refuses `type: "video"` arriving any other way — REST,
       * GraphQL, a seed script — rather than trusting the picker.
       */
      ({ data }) => {
        if (data?.type === "video") {
          throw new ValidationError({
            collection: "news",
            errors: [
              {
                path: "type",
                message:
                  "Video news is switched off for now. Publish this as an article.",
              },
            ],
          });
        }

        return data;
      },
    ],
    beforeChange: [
      calculateNewsMetrics,
      // totalComments, likesCount, and dislikesCount are all maintained by raw
      // SQL in the Comments/NewsReactions hooks. Strip them from incoming
      // Payload writes (admin edits, republishes, version restores) so a
      // stale form/version value can't overwrite the counters.
      ({ data, operation }) => {
        if (operation === "update" && data) {
          for (const field of [
            "totalComments",
            "likesCount",
            "dislikesCount",
          ]) {
            if (field in data) {
              delete data[field];
            }
          }
        }
        return data;
      },
    ],
    afterChange: [sendNotificationOnCreate],
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: "type",
      label: "News Type",
      type: "select",
      /**
       * Video is switched off, so it is no longer an option at all.
       *
       * Safe to drop rather than merely hide because production holds no video
       * pieces: Payload validates a select against its own option list, so a
       * stored "video" would otherwise become unsaveable on its next edit.
       *
       * The Video entry previously carried `admin: { disabled: true }`, which
       * looks like a guard but is not one — a select option is only
       * `{ label, value }`, so Payload ignored the extra key and video stayed
       * selectable the whole time. TypeScript had been flagging it.
       */
      options: [{ label: "Article", value: "article" }],
      defaultValue: "article",
      admin: {
        readOnly: true,
        description:
          "💡 Video news is switched off for now, so new pieces are articles.",
      },
    },
    {
      name: "title",
      type: "text",
      required: true,
      admin: {
        description: "💡 Title of the news article",
      },
    },
    slugField({
      position: "sidebar",
    }),
    {
      name: "image",
      type: "upload",
      relationTo: "media",
      required: true,
      displayPreview: true,
      /**
       * Media deliberately accepts `video/*` as well as `image/*`, so without
       * this an editor could pick a video file here and the article would ship
       * with a header that never renders. Filtering by mime type narrows the
       * picker and is enforced on save, rather than relying on the person
       * choosing correctly.
       */
      filterOptions: IMAGE_ONLY,
    },
    {
      name: "keyPoints",
      type: "array",
      fields: [
        {
          name: "point",
          type: "text",
        },
      ],
      admin: {
        condition: (data, _siblingData) => data.type === "article",
      },
      validate: (_val) => {
        // if (!val || (val && (val?.length < 1 || val?.length > 3))) {
        //   return 'Articles must have between 1 and 3 key points'
        // }
        return true;
      },
    },
    {
      name: "content",
      type: "richText",
      editor: lexicalEditor({
        features({ defaultFeatures }) {
          return [
            ...defaultFeatures,
            BlocksFeature({
              blocks: [
                AdsBlock,
                ReadAlsoBlock,
                "twitterEmbed",
                "youtubeEmbed",
                "instagramEmbed",
              ],
            }),
          ];
        },
      }),
      admin: {
        condition: (data) => data.type === "article",
      },
    },
    {
      name: "url",
      label: "Video URL",
      type: "text",
      hooks: {
        beforeChange: [trimUrlHook],
      },
      validate: (val: any, { siblingData }: any) => {
        if (siblingData.type !== "video") {
          return true;
        }
        try {
          new URL(val);
          return true;
        } catch {
          return "Please enter a valid URL";
        }
      },
      admin: {
        description: "💡 https://www.youtube.com/embed/video-id",
        condition: (data) => data.type === "video",
      },
    },
    {
      name: "wordCount",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: process.env.NODE_ENV !== "development",
        condition: (data) => data.type === "article",
      },
    },
    {
      name: "readTimeMinutes",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: process.env.NODE_ENV !== "development",
        condition: (data) => data.type === "article",
      },
    },
    {
      name: "views",
      type: "number",
      defaultValue: 0,
      admin: {
        description: "💡 Number of views",
        readOnly: process.env.NODE_ENV !== "development",
      },
    },
    {
      name: "excerpt",
      type: "text",
      admin: {
        description: "💡 Summary of the article",
      },
      maxLength: 100,
    },
    {
      name: "publishedAt",
      type: "date",
      required: true,
      defaultValue: () => new Date(),
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
    },
    {
      name: "updatedAt",
      type: "date",
      defaultValue: () => new Date(),
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
    },
    {
      name: "points",
      type: "number",
      defaultValue: 0,
      admin: {
        description: "💡 Amount of points to be awarded for this news",
      },
    },
    // TODO: only the admin name and email
    {
      name: "author",
      type: "relationship",
      relationTo: "admins",
      hasMany: false,
      required: true,
      defaultValue: ({ user }: { user?: Admin | null }) =>
        user?.id ?? undefined,
      admin: {
        position: "sidebar",
        allowCreate: false,
      },
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      required: true,
      admin: {
        position: "sidebar",
        allowCreate: false,
      },
    },
    {
      name: "hasBeenPublished",
      type: "checkbox",
      defaultValue: false,
      admin: {
        // readOnly: true,
        hidden: process.env.NODE_ENV !== "development",
      },
    },
    // persisted count fields (updated by hooks on Comments collection)
    {
      name: "totalComments",
      type: "number",
      admin: {
        readOnly: true,
        hidden: process.env.NODE_ENV !== "development",
      },
      defaultValue: 0,
    },
    {
      name: "totalCommentLikes",
      type: "number",
      defaultValue: 0,
      virtual: true,
      admin: {
        readOnly: true,
        hidden: process.env.NODE_ENV !== "development",
      },
    },
    {
      name: "likesCount",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: true,
        hidden: process.env.NODE_ENV !== "development",
      },
    },
    {
      name: "dislikesCount",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: true,
        hidden: process.env.NODE_ENV !== "development",
      },
    },
  ],
};

export default News;
