import path from "node:path";
import { fileURLToPath } from "node:url";

import { cpanelSftpStorage } from "@news-spend-media/payload-cpanel-storage";
import { auditFieldsPlugin } from "@payload-bites/audit-fields";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { resendAdapter } from "@payloadcms/email-resend";
import { sentryPlugin } from "@payloadcms/plugin-sentry";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import * as Sentry from "@sentry/nextjs";
import {
  buildConfig,
  type Config,
  deepMerge,
  type SanitizedConfig,
} from "payload";
import computeBlurhash from "payload-blurhash-plugin";
import sharp from "sharp";

import { TwitterBlock } from "./blocks";
import { InstagramBlock } from "./blocks/Instagram/config";
import { YouTubeBlock } from "./blocks/YouTube/config";
import {
  Account,
  Activities,
  Categories,
  Comments,
  ContentReport,
  Feedback,
  GiveawayAccountFlags,
  GiveawayAuditLog,
  GiveawayDrawAttempts,
  GiveawayEngagements,
  GiveawayFulfilmentAttempts,
  GiveawayPoolSnapshots,
  GiveawayPrizes,
  GiveawayReportDeliveries,
  GiveawayStreaks,
  Giveaways,
  GiveawayTickets,
  GiveawayWinners,
  IdentityChecks,
  Media,
  News,
  NewsAnalytics,
  NotificationDeliveries,
  NotificationInbox,
  Notifications,
  PartnerContent,
  PartnerConversions,
  Partners,
  PrizeCatalogue,
  PromotionMedia,
  PushTokens,
  Reactions,
  Session,
  ShopAnalytics,
  Survey,
  Users,
  Verification,
  WitnessReport,
} from "./collections";
import Admins from "./collections/Admins";
import UserBlocks from "./collections/UserBlocks";
import ModerationSettings from "./globals/ModerationSettings";
import NewsCategory from "./globals/NewsCategory";
import { migrations } from "./migrations";
import { auditLogPlugin } from "./plugins/audit-log";
import { checkPushReceiptsTask } from "./tasks/checkPushReceipts";
import { cleanupAnonymousUsersTask } from "./tasks/cleanupAnonymousUsers";
import { deleteVideoThumbTempTask } from "./tasks/deleteVideoThumbTemp";
import { generateVideoThumbnailTask } from "./tasks/generateVideoThumbnail";
import { processGiveawayTask } from "./tasks/processGiveaway";
import { pruneNewsAnalyticsTask } from "./tasks/pruneNewsAnalytics";
import { sendCommentLikeNotificationTask } from "./tasks/sendCommentLikeNotification";
import { sendModerationDigestTask } from "./tasks/sendModerationDigest";
import { sendScheduledNotificationTask } from "./tasks/sendScheduledNotification";
import { sendUrgentModerationAlertTask } from "./tasks/sendUrgentModerationAlert";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const baseConfig: Config = {
  cors: "*",
  logger: "sync",
  admin: {
    user: Admins.slug,
    /**
     * Where an administrator is assumed to be composing times, unless they
     * say otherwise. The newsroom runs on WAT, so a scheduling field opens on
     * Lagos rather than on whatever zone the browser happens to report, and a
     * team member travelling or working from Canada has to choose their zone
     * deliberately rather than have it silently applied.
     */
    timezones: {
      defaultTimezone: "Africa/Lagos",
    },
    meta: {
      title: "News Spend Media CMS",
      description:
        "Read news, earn points, join our community and stay updated on the latest news and trends.",
      titleSuffix: " - News Spend Media",
      icons: [
        {
          rel: "icon",
          type: "image/png",
          url: "/images/logo.png",
        },
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    ...(process.env.NODE_ENV === "development" &&
      {
        // autoLogin: {
        //   email: 'admin@newsspend.com',
        //   password: 'admin',
        // },
      }),
    components: {
      graphics: {
        Logo: "@news-spend-media/payload/components/Logo#Logo",
        Icon: "@news-spend-media/payload/components/Icon#Icon",
      },
    },
  },
  blocks: [InstagramBlock, YouTubeBlock, TwitterBlock],
  globals: [NewsCategory, ModerationSettings],
  collections: [
    Account,
    Activities,
    Admins,
    // Ads,
    // Apps,
    Categories,
    Comments,
    ContentReport,
    Feedback,
    // Games,
    // --- Giveaway draw engine ---
    GiveawayAccountFlags,
    GiveawayAuditLog,
    GiveawayDrawAttempts,
    GiveawayEngagements,
    GiveawayFulfilmentAttempts,
    GiveawayPoolSnapshots,
    GiveawayPrizes,
    GiveawayReportDeliveries,
    Giveaways,
    GiveawayStreaks,
    GiveawayTickets,
    GiveawayWinners,
    IdentityChecks,
    PrizeCatalogue,
    Media,
    News,
    NewsAnalytics,
    NotificationDeliveries,
    NotificationInbox,
    Notifications,
    PartnerContent,
    PartnerConversions,
    Partners,
    PromotionMedia,
    PushTokens,
    Reactions,
    Session,
    ShopAnalytics,
    // Stores,
    Survey,
    UserBlocks,
    Users,
    Verification,
    WitnessReport,
    // VerificationOTP,
    // UserSegment,
  ],
  editor: lexicalEditor(),
  jobs: {
    tasks: [
      sendScheduledNotificationTask,
      sendCommentLikeNotificationTask,
      sendModerationDigestTask,
      sendUrgentModerationAlertTask,
      checkPushReceiptsTask,
      processGiveawayTask,
      cleanupAnonymousUsersTask,
      pruneNewsAnalyticsTask,
      generateVideoThumbnailTask,
      deleteVideoThumbTempTask,
    ],
    autoRun: [
      {
        cron: "*/5 * * * *",
        queue: "default",
        limit: 10,
      },
      {
        cron: "0 0,12 * * *",
        queue: "maintenance",
        limit: 10,
      },
    ],
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      if (!defaultJobsCollection.admin) {
        defaultJobsCollection.admin = {};
      }

      defaultJobsCollection.admin.hidden = false;
      return defaultJobsCollection;
    },
  },
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || "",
      // Memory: bound the pg pool on small containers. Unset = adapter
      // default (no behavior change for existing consumers); set e.g.
      // PG_POOL_MAX=5 on the 1 GB Railway CMS to cap idle connections.
      ...(process.env.PG_POOL_MAX
        ? { max: Number(process.env.PG_POOL_MAX) }
        : {}),
    },
    idType: "uuid",
    /**
     * Migrations live beside the schema they describe, not next to the CMS
     * app that happens to load it. Without this the adapter defaults to
     * `<config dir>/migrations`, which resolves into `apps/cms` and does not
     * exist, so `migrate:create` finds no snapshot to diff against and emits
     * the entire schema as a fresh migration rather than the one changed
     * column.
     */
    migrationDir: path.resolve(dirname, "migrations"),
    prodMigrations: migrations,
  }),
  sharp,
  upload: {
    debug: process.env.NODE_ENV === "development",
  },
  plugins: [
    cpanelSftpStorage({
      baseUrl: `https://media.newsspend.com/assets${process.env.NODE_ENV === "production" ? "" : "/dev"}`,
      uploadDir: `/media.newsspend.com/assets${process.env.NODE_ENV === "production" ? "" : "/dev"}`,
      collections: {
        [Media.slug]: {
          generateFileURL: ({ collection: col, filename: fname }) =>
            `https://media.newsspend.com/assets${process.env.NODE_ENV === "production" ? "" : "/dev"}/${col.slug}/${fname}`,
        },
      },
      connection: {
        host: process.env.SFTP_HOST || "host.com",
        username: process.env.SFTP_USERNAME || "user",
        password: process.env.SFTP_PASSWORD || "password",
        port: 22,
      },
      pool: {},
    }),
    computeBlurhash({ showBlurhashField: false }),
    sentryPlugin({
      Sentry,
      options: {
        /**
         * Say who was signed in when this happened.
         *
         * The plugin reports the error and the request but not the person, so
         * an admin-panel issue could be read and not attributed — and with a
         * handful of administrators, "who was doing this" is usually the
         * fastest route to "what were they doing".
         *
         * `req.user` is whoever is authenticated: an `admins` document in the
         * admin panel, a `users` one on the public API. The collection is
         * tagged alongside the id so the two cannot be confused — they are
         * different people who happen to share a shape.
         *
         * Id and email only. The request is already attached; this is
         * attribution, not a copy of the account.
         */
        context: ({ defaultContext, req }) => {
          const user = req?.user;

          if (!user?.id) {
            return defaultContext;
          }

          return {
            ...defaultContext,
            user: {
              id: String(user.id),
              email: user.email,
              ip_address: "{{auto}}",
            },
            tags: {
              ...defaultContext.tags,
              user_collection: user.collection ?? "unknown",
            },
          };
        },
      },
    }),
    auditFieldsPlugin(),
    auditLogPlugin,
  ],
  email: resendAdapter({
    defaultFromAddress:
      process.env.RESEND_DEFAULT_FROM_ADDRESS || "admin@mail.newsspend.com",
    defaultFromName: process.env.RESEND_DEFAULT_FROM_NAME || "News Spend Media",
    apiKey: process.env.RESEND_API_KEY || "",
  }),
  onInit: async (payload) => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    const existingUsers = await payload.find({
      collection: "admins",
      limit: 1,
    });

    if (existingUsers.docs.length === 0) {
      await payload.create({
        collection: "admins",
        data: {
          email: "admin@newsspend.com",
          password: "admin",
          role: "super-admin",
          fullName: "Super Admin",
        },
      });
    }
  },
};

const globalForPayload = global as typeof global & {
  __payloadConfig?: Promise<SanitizedConfig>;
};

export const configurePayload = (
  overrides?: Partial<Config>
): Promise<SanitizedConfig> => {
  if (globalForPayload.__payloadConfig && !overrides) {
    return globalForPayload.__payloadConfig;
  }

  const config = buildConfig(deepMerge(baseConfig, overrides ?? {}));

  if (!overrides) {
    globalForPayload.__payloadConfig = config;
  }

  return config;
};
