import { sql } from "@payloadcms/db-postgres";
import type { CollectionConfig } from "payload";

import { authenticated } from "../access/authenticated";

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
    group: "User Management",
  },
  hooks: {
    afterChange: [],
    beforeDelete: [
      async ({ id, req }) => {
        const logger = req.payload.logger;
        const drizzle = req.payload.db.drizzle;
        // Wipe every child collection that holds a NOT NULL FK to users before
        // the user row goes away. The companion migration
        // (20260621_130000_fix_user_news_cascade) flips these FKs to CASCADE,
        // so this hook is belt-and-braces; it makes the cleanup auditable
        // and covers hasMany junction tables.
        const statements: ReturnType<typeof sql>[] = [
          sql`DELETE FROM push_tokens WHERE user_id = ${id}`,
          sql`DELETE FROM activities WHERE user_id = ${id}`,
          sql`DELETE FROM comments WHERE user_id = ${id}`,
          sql`DELETE FROM reactions WHERE user_id = ${id}`,
          sql`DELETE FROM content_reports WHERE reported_by_id = ${id}`,
          sql`DELETE FROM notification_inbox WHERE user_id = ${id}`,
          sql`DELETE FROM notification_deliveries WHERE user_id = ${id}`,
          sql`DELETE FROM partner_conversions WHERE user_id = ${id}`,
          sql`DELETE FROM notifications_rels WHERE users_id = ${id}`,
          sql`DELETE FROM survey_rels WHERE users_id = ${id}`,
          sql`DELETE FROM comments_rels WHERE users_id = ${id}`,
          // Both directions: rows where this user did the blocking, and rows
          // where they were the one blocked. Both columns are NOT NULL with an
          // ON DELETE SET NULL foreign key, so leaving either behind makes the
          // user delete fail outright.
          sql`DELETE FROM user_blocks WHERE blocker_id = ${id} OR blocked_id = ${id}`,
        ];
        try {
          await Promise.all(statements.map((stmt) => drizzle.execute(stmt)));
        } catch (err) {
          logger.error(
            { err, userId: id },
            "Error during user pre-delete cleanup"
          );
          throw err;
        }
      },
    ],
  },
  access: {
    // read: ({ req, id }) => {
    //   if (!req.user) return false
    //   return req.user.id === id || req.user.collection === 'admins'
    // },
    // update: ({ req, id }) => {
    //   if (!req.user) return false
    //   return req.user.id === id || req.user.collection === 'admins'
    // },
    // delete: ({ req, id }) => {
    //   if (!req.user) return false
    //   return req.user.id === id || req.user.collection === 'admins'
    // },
    read: authenticated,
    create: () => false,
    update: () => false,
    delete: () => false,
  },

  fields: [
    {
      name: "userId",
      type: "text",
      // unique: true,
      // maxLength: 10,
    },
    {
      name: "email",
      type: "text",
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      type: "text",
      name: "image",
    },
    {
      name: "username",
      type: "text",
      unique: true,
      required: true,
    },
    {
      name: "wish",
      type: "text",
      required: true,
    },
    {
      name: "phone",
      type: "text",
      admin: {
        description:
          "No longer collected at sign-up (App Store guideline 5.1.1(v)). Retained for existing users and admin edits.",
      },
    },
    {
      name: "dateOfBirth",
      type: "date",
      index: true,
      admin: {
        date: { pickerAppearance: "dayOnly" },
        description:
          "Required to take part in giveaways, as prizes of real value are age-restricted. Deliberately not self-editable in the app: a user who fails the age check could otherwise simply correct their birthday. Change it here if someone mistyped it.",
      },
    },
    {
      name: "country",
      type: "text",
      index: true,
      admin: {
        description:
          "ISO country code the user selected. A display signal only; it decides currency and copy, never eligibility, because it is typed into a form and can be changed at will.",
      },
    },
    {
      name: "verifiedCountry",
      type: "text",
      index: true,
      admin: {
        readOnly: true,
        description:
          "Country from the identity document, once verified. This is the version anyone has actually checked, so it outranks the self-reported one wherever the answer has consequences.",
      },
    },
    {
      name: "_verified",
      type: "checkbox",
      required: true,
    },
    {
      name: "isAnonymous",
      type: "checkbox",
    },
    {
      name: "dailyRead",
      type: "json",
      required: true,
      jsonSchema: {
        uri: "a://b/foo2.json",
        fileMatch: ["a://b/foo2.json"], // required
        schema: {
          title: "Daily Read",
          type: "object",
          properties: {
            count: {
              type: "integer",
              minimum: 0,
              maximum: 5,
              default: 0,
            },
            updatedAt: {
              type: "string",
            },
          },
        },
      },
      defaultValue: {
        count: 0,
        updatedAt: "2025-02-19T18:06:57.781Z",
      },
    },
    {
      name: "notificationPreferences",
      type: "json",
      index: true,
      jsonSchema: {
        uri: "a://b/foo.json", // required
        fileMatch: ["a://b/foo.json"], // required
        schema: {
          type: "object",
          properties: {
            types: {
              type: "object",
              properties: {
                BREAKING_NEWS: {
                  type: "boolean",
                },
                NEWS: {
                  type: "boolean",
                },
                COMMENT: {
                  type: "boolean",
                },
                EARNING_OPPORTUNITY: {
                  type: "boolean",
                },
                MISC: {
                  type: "boolean",
                },
              },
            },
          },
        },
      },
      defaultValue: {
        // TODO: changes 'types' to 'categories' or 'preferences'
        types: {
          BREAKING_NEWS: true,
          NEWS: true,
          COMMENT: false,
          EARNING_OPPORTUNITY: false,
          MISC: false,
        },
      },
    },
    {
      name: "lastActive",
      type: "date",
      admin: {
        description: "Last time the user was active in the app",
      },
    },
    {
      name: "customAttributes",
      type: "json",
      admin: {
        description: "Custom user attributes for advanced segmentation",
      },
    },
    /**
     * The last completed giveaway whose result this user has been shown.
     *
     * A single pointer rather than a row per giveaway, because the reveal only
     * ever concerns the most recent completed draw: someone who misses one
     * giveaway's result should see the next one, not a backlog. Moving the
     * pointer forward retires every older result at once.
     *
     * On the user rather than in its own collection so that "have they seen
     * it" survives a reinstall and agrees across devices. A "you didn't win"
     * message must be said once and never repeated.
     */
    {
      name: "lastGiveawayResultSeen",
      type: "relationship",
      relationTo: "giveaways",
      index: true,
      admin: {
        readOnly: true,
        description:
          "Set when the user acknowledges a giveaway result. Suppresses that result's reveal from then on.",
      },
    },
  ],
};
