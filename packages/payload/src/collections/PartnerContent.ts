import type { CollectionConfig } from "payload";
import { z } from "zod";

import { PromoImageBlock, PromoVideoSourceBlock } from "../blocks/PromoBlocks";
import { IMAGE_ONLY, VIDEO_ONLY } from "../fields/uploadMimeFilters";
import { urlField } from "../fields/urlField";

// ─── Google Ads standard sizes ────────────────────────────────────────────────
export const AD_SIZES = {
  BANNER: { label: "Banner", width: 320, height: 50, toleranceRatio: 0.15 },
  LARGE_BANNER: {
    label: "Large Banner",
    width: 468,
    height: 60,
    toleranceRatio: 0.15,
  },
  FULL_BANNER: {
    label: "Full Banner",
    width: 468,
    height: 60,
    toleranceRatio: 0.15,
  },
  LEADERBOARD: {
    label: "Leaderboard",
    width: 728,
    height: 90,
    toleranceRatio: 0.15,
  },
  INLINE_RECTANGLE: {
    label: "Inline Rectangle",
    width: 300,
    height: 250,
    toleranceRatio: 0.1,
  },
  MEDIUM_RECTANGLE: {
    label: "Medium Rectangle",
    width: 300,
    height: 250,
    toleranceRatio: 0.1,
  },
  LARGE_RECTANGLE: {
    label: "Large Rectangle",
    width: 336,
    height: 280,
    toleranceRatio: 0.1,
  },
  HALF_PAGE: {
    label: "Half Page",
    width: 300,
    height: 600,
    toleranceRatio: 0.1,
  },
  WIDE_SKYSCRAPER: {
    label: "Wide Skyscraper",
    width: 160,
    height: 600,
    toleranceRatio: 0.1,
  },
  BILLBOARD: {
    label: "Billboard",
    width: 970,
    height: 250,
    toleranceRatio: 0.1,
  },
  ANCHORED_ADAPTIVE: {
    label: "Adaptive Banner",
    width: 0,
    height: 0,
    toleranceRatio: 1,
  },
} as const;

type AdSizeKey = keyof typeof AD_SIZES;

const AD_SIZE_OPTIONS = Object.entries(AD_SIZES).map(
  ([value, { label, width, height }]) => ({
    label: width > 0 ? `${label} (${width}x${height})` : label,
    value,
  })
);

const checkRatio = (
  media: { width?: number; height?: number } | null | undefined,
  adSizeKey: AdSizeKey | undefined
): string | true => {
  if (!(adSizeKey && media?.width && media?.height)) {
    return true;
  }
  const spec = AD_SIZES[adSizeKey];
  if (!spec || spec.width === 0) {
    return true;
  }

  const actual = media.width / media.height;
  const expected = spec.width / spec.height;

  if (Math.abs(actual - expected) > spec.toleranceRatio) {
    return (
      `Image ratio (${media.width}x${media.height}) does not match ` +
      `${spec.label} (${spec.width}x${spec.height}). ` +
      "The app may crop or letterbox this ad. Please re-upload at the correct dimensions."
    );
  }
  return true;
};

// ─── Google Ads standard CTA labels ──────────────────────────────────────────
const _GOOGLE_CTA_OPTIONS = [
  { label: "Apply now", value: "APPLY_NOW" },
  { label: "Book now", value: "BOOK_NOW" },
  { label: "Buy now", value: "BUY_NOW" },
  { label: "Contact us", value: "CONTACT_US" },
  { label: "Download", value: "DOWNLOAD" },
  { label: "Find location", value: "FIND_LOCATION" },
  { label: "Get directions", value: "GET_DIRECTIONS" },
  { label: "Get offer", value: "GET_OFFER" },
  { label: "Get quote", value: "GET_QUOTE" },
  { label: "Get showtimes", value: "GET_SHOWTIMES" },
  { label: "Get tickets", value: "GET_TICKETS" },
  { label: "Install now", value: "INSTALL_NOW" },
  { label: "Learn more", value: "LEARN_MORE" },
  { label: "Subscribe", value: "SUBSCRIBE" },
  { label: "Watch now", value: "WATCH_NOW" },
];

const AD_SIZE_GUIDANCE: Record<string, string> = {
  BANNER: "320x50px: thin mobile banner, keep text minimal",
  LARGE_BANNER: "468x60px: wider mobile banner",
  FULL_BANNER: "468x60px: same dimensions as Large Banner",
  LEADERBOARD: "728x90px: top/bottom of page, landscape only",
  INLINE_RECTANGLE: "300x250px: most versatile, works in-feed and sidebars",
  MEDIUM_RECTANGLE: "300x250px: same dimensions as Inline Rectangle",
  LARGE_RECTANGLE: "336x280px: slightly larger in-content rectangle",
  HALF_PAGE: "300x600px: tall portrait, high visual impact",
  WIDE_SKYSCRAPER: "160x600px: narrow portrait, sidebar use",
  BILLBOARD: "970x250px: large landscape, desktop-primary",
  ANCHORED_ADAPTIVE: "Any size: slot adapts to screen width automatically",
};

const isBannerType = (data: any) => ["banner"].includes(data?.type);

// ─── YouTube thumbnail helper ─────────────────────────────────────────────────
export const getYoutubeThumbnailUrl = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match
    ? `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`
    : null;
};

export const PartnerContent: CollectionConfig = {
  slug: "partner-content",
  admin: {
    group: "Partners",
    defaultColumns: ["title", "type", "partner", "status", "points"],
    useAsTitle: "title",
    description:
      "Manage promotions for books, banners, videos, shop items, etc.",
  },
  access: { read: () => true },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (doc.type !== "promo-media") {
          return doc;
        }
        if (!["create", "update"].includes(operation)) {
          return doc;
        }

        const items: unknown[] = doc.items ?? [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i] as { layout?: unknown[] } | undefined;
          const blk = item?.layout?.[0] as
            | {
                blockType?: string;
                videoSource?: string;
                video?: unknown;
                url?: string;
                thumbnail?: unknown;
                thumbnailSource?: string;
              }
            | undefined;

          if (blk?.blockType !== "promo-video-source") {
            continue;
          }

          if (blk.videoSource === "youtube") {
            continue;
          }

          const currentSource =
            blk.videoSource === "upload"
              ? typeof blk.video === "object"
                ? (blk.video as { id?: string })?.id
                : (blk.video as string)
              : (blk.url as string);

          if (!currentSource) {
            continue;
          }

          const isManualThumbnail = blk.thumbnail && !blk.thumbnailSource;
          const isUnchanged =
            blk.thumbnail && (blk.thumbnailSource as string) === currentSource;

          if (isManualThumbnail || isUnchanged) {
            continue;
          }

          let videoUrl: string | undefined;

          if (blk.videoSource === "upload") {
            const videoId =
              typeof blk.video === "object"
                ? (blk.video as { id?: string })?.id
                : (blk.video as string);

            if (!videoId) {
              continue;
            }
            try {
              const mediaDoc = await req.payload.findByID({
                collection: "media",
                id: videoId,
              });
              const raw = (mediaDoc as { url?: string })?.url;
              if (!raw) {
                continue;
              }
              videoUrl = raw.startsWith("http")
                ? raw
                : `${process.env.PAYLOAD_PUBLIC_SERVER_URL}${raw}`;
            } catch (err) {
              req.payload.logger.error(
                { err },
                `Could not resolve media for video id ${videoId}`
              );
              continue;
            }
          } else {
            videoUrl = blk.url as string;
          }

          if (!videoUrl) {
            continue;
          }

          const isHLS = videoUrl.includes(".m3u8");

          const oldThumbnailId =
            blk.thumbnail && blk.thumbnailSource
              ? typeof blk.thumbnail === "object"
                ? (blk.thumbnail as { id?: string })?.id
                : (blk.thumbnail as string)
              : undefined;

          await req.payload.jobs.queue({
            task: "generateVideoThumbnail",
            input: {
              docId: doc.id,
              itemIndex: i,
              videoUrl,
              isHLS,
              oldThumbnailId: oldThumbnailId ?? null,
              currentSource,
            },
          });

          req.payload.logger.info(
            `Queued thumbnail generation for item ${i} on partner-content ${doc.id}`
          );
        }

        return doc;
      },
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        // ── Tab 1: Content ───────────────────────────────────────────────────
        {
          label: "Content",
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              admin: {
                placeholder: "Enter a catchy title",
                description: "Main heading, 30 characters recommended",
              },
            },
            {
              name: "condition",
              type: "text",
              required: true,
              defaultValue: "",
              admin: {
                placeholder:
                  "Enter a condition eg Visit website, earn 30 points",
                description: "Max 90 characters recommended",
              },
            },
            {
              name: "description",
              type: "textarea",
              admin: {
                placeholder: "Brief summary or overview",
              },
            },
            {
              name: "type",
              type: "select",
              required: true,
              defaultValue: "",
              options: [
                { label: "Book", value: "book" },
                { label: "App", value: "app" },
                { label: "Game", value: "game" },
                { label: "Survey", value: "survey" },
                { label: "Video", value: "video" },
                { label: "Banner", value: "banner" },
                { label: "Promo Media", value: "promo-media" },
                { label: "Product", value: "product" },
                { label: "Custom", value: "custom" },
                { label: "Empty", value: "" },
              ],
              admin: {
                description:
                  "Content category. Banner Ad Size options in the Display Settings tab.",
              },
            },
            {
              name: "adSize",
              type: "select",
              options: AD_SIZE_OPTIONS,
              admin: {
                condition: (data) => isBannerType(data),
                description:
                  "Select the Google Ads standard size for this placement. " +
                  "Then upload your image at exactly those dimensions in the Content tab.",
              },
            },

            ...Object.entries(AD_SIZE_GUIDANCE).map(([sizeValue, hint]) => ({
              name: `adSizeGuide_${sizeValue}` as any,
              type: "ui" as const,
              admin: {
                condition: (data: any) =>
                  isBannerType(data) && data?.adSize === sizeValue,
                description: `Dimensions: ${hint}`,
              },
            })),

            {
              name: "media",
              type: "upload",
              relationTo: "media",
              required: true,
              filterOptions: IMAGE_ONLY,
              admin: {
                description:
                  "Main image or thumbnail. For Banner / Video / Custom types, " +
                  "dimensions should match the Ad Size selected in Display Settings.",
                condition: (data) => data?.type !== "promo-media",
              },
              validate: (val: any, { data }: any) => {
                if (!val) {
                  return true;
                }
                if (!(isBannerType(data) && data?.adSize)) {
                  return true;
                }
                return checkRatio(
                  typeof val === "object" ? val : null,
                  data.adSize as AdSizeKey
                );
              },
            },

            // ── Promo Media items ─────────────────────────────────────────────
            {
              name: "items",
              label: "Items",
              type: "array",
              minRows: 4,
              maxRows: 6,
              admin: {
                description:
                  "Promotion images and video, one video and at least three images",
                condition: (data) => data?.type === "promo-media",
              },
              validate: (val) => {
                const videoBlks = val?.filter(
                  // @ts-expect-error
                  (item) => item.layout?.[0]?.blockType === "promo-video-source"
                );
                if (videoBlks?.length === 0) {
                  return "Must have at least one video";
                }
                // @ts-expect-error
                if (videoBlks?.length > 1) {
                  return "Only one video is allowed";
                }
                return true;
              },
              fields: [
                {
                  name: "layout",
                  label: "Item",
                  type: "blocks",
                  minRows: 1,
                  maxRows: 1,
                  blocks: [PromoVideoSourceBlock, PromoImageBlock],
                },
              ],
            },

            // ── Video fields ──────────────────────────────────────────────────
            {
              name: "videoType",
              type: "select",
              options: [
                { label: "Uploaded File", value: "UPLOAD" },
                { label: "YouTube", value: "YOUTUBE" },
                { label: "External URL", value: "EXTERNAL" },
              ],
              admin: {
                description: "Video source type",
                condition: (data) => data?.type === "video",
              },
            },
            {
              name: "video",
              type: "upload",
              relationTo: "media",
              filterOptions: VIDEO_ONLY,
              admin: {
                description: "Upload MP4 (recommended 1280x720, max 50MB)",
                condition: (data) =>
                  data?.type === "video" && data?.videoType === "UPLOAD",
              },
            },
            {
              name: "videoUrl",
              type: "text",
              admin: {
                description:
                  "YouTube URL (https://youtube.com/watch?v=...) or direct .mp4 link",
                condition: (data) =>
                  data?.type === "video" &&
                  ["YOUTUBE", "EXTERNAL"].includes(data?.videoType),
              },
              // @ts-expect-error
              validate: (val: any, { data }) => {
                if (!val) {
                  return true;
                }
                if (data?.videoType === "YOUTUBE") {
                  return /youtube\.com\/watch\?v=|youtu\.be\//.test(val)
                    ? true
                    : "Must be a valid YouTube URL (e.g. https://youtube.com/watch?v=VIDEO_ID)";
                }
                if (data?.videoType === "EXTERNAL") {
                  return z.url().safeParse(val).success
                    ? true
                    : "Must be a valid URL";
                }
                return true;
              },
            },

            {
              name: "cta",
              label: "Call to Action",
              type: "text",
              maxLength: 25,
              admin: {
                description: "Button text (e.g., Buy now, Learn more)",
                condition: (data) => data?.type !== "promo-media",
              },
            },
          ],
        },

        // ── Tab 2: Links & Partner ───────────────────────────────────────────
        {
          label: "Links & Partner",
          fields: [
            {
              name: "partner",
              type: "relationship",
              relationTo: "partners",
              required: true,
              admin: {
                description: "Associate with an existing partner",
              },
            },
            {
              name: "links",
              type: "group",
              admin: {
                condition: (data) => data?.type !== "promo-media",
              },
              fields: [
                urlField({
                  name: "website",
                  admin: {
                    placeholder: "https://example.com",
                    description: "General landing page URL",
                  },
                }),
                urlField({
                  name: "iosAppStore",
                  admin: {
                    placeholder: "https://apps.apple.com/...",
                    description: "iOS App Store link",
                  },
                  validate: (
                    val: unknown,
                    { data }: { data: Record<string, unknown> }
                  ) => {
                    const links = data?.links as
                      | Record<string, unknown>
                      | undefined;
                    const hasAndroid = !!links?.androidPlayStore;
                    const hasWebsite = !!links?.website;
                    if (val && !hasAndroid && !hasWebsite) {
                      return "Either add the Android Play Store link or a website fallback, otherwise Android users will have no link.";
                    }
                    return true;
                  },
                }),
                urlField({
                  name: "androidPlayStore",
                  admin: {
                    placeholder: "https://play.google.com/...",
                    description: "Google Play Store link",
                  },
                  validate: (
                    val: unknown,
                    { data }: { data: Record<string, unknown> }
                  ) => {
                    const hasIos = !!(
                      data?.links as Record<string, unknown> | undefined
                    )?.iosAppStore;
                    const hasWebsite = !!(
                      data?.links as Record<string, unknown> | undefined
                    )?.website;
                    if (val && !hasIos && !hasWebsite) {
                      return "Either add the iOS App Store link or a website fallback, otherwise iOS users will have no link.";
                    }
                    return true;
                  },
                }),
              ],
            },
          ],
        },

        // ── Tab 3: Settings ──────────────────────────────────────────────────
        {
          label: "Settings",
          fields: [
            {
              name: "points",
              type: "number",
              required: true,
              min: 0,
              max: 10_000,
              admin: {
                description: "Points awarded for completing this action",
                placeholder: "e.g. 200",
              },
            },
            {
              name: "weight",
              type: "number",
              defaultValue: 1,
              min: 0,
              admin: {
                description:
                  "Share of voice within a placement, relative to the other active content there. Weight 3 against weight 1 is drawn roughly three times as often. 0 withholds it without unpublishing.",
                position: "sidebar",
              },
            },
            {
              name: "placements",
              type: "select",
              hasMany: true,
              required: true,
              options: [
                {
                  label: "Homepage - Trending Books",
                  value: "homepage-trending-books",
                },
                {
                  label: "Homepage - Ads Banner",
                  value: "homepage-ads-banner",
                },
                { label: "Discover Tab - Points Mall", value: "discover-tab" },
                { label: "Points Mall - Books", value: "points-mall-books" },
                { label: "Points Mall - Apps", value: "points-mall-apps" },
                { label: "Connect Brand Video", value: "connect-brand-video" },
                { label: "Connect Brands Tab", value: "connect-brands-tab" },
                { label: "Lucky App Wall", value: "lucky-app-wall" },
                { label: "Shop Tab", value: "shop-tab" },
                { label: "Ads Display - News Click", value: "news-click-ads" },
                { label: "Banner in News Post", value: "banner-news-post" },
                { label: "News Post", value: "news-post" },
                { label: "Product Display", value: "product-display" },
                { label: "Push Notification", value: "push-notification" },
                { label: "Email Campaign", value: "email-campaign" },
                { label: "Video Section (YouTube)", value: "video-section" },
              ],
              admin: {
                condition: (data) => data?.type !== "promo-media",
                description: "Where this content should appear in the app",
              },
            },
            {
              name: "status",
              type: "select",
              required: true,
              defaultValue: "draft",
              options: [
                { label: "Draft", value: "draft" },
                { label: "Active", value: "active" },
                { label: "Paused", value: "paused" },
                { label: "Archived", value: "archived" },
              ],
              admin: { position: "sidebar" },
            },
            {
              name: "schedule",
              type: "group",
              admin: { position: "sidebar" },
              fields: [
                {
                  name: "startDate",
                  type: "date",
                  admin: {
                    date: { pickerAppearance: "dayAndTime" },
                    description: "When to start displaying this content",
                  },
                },
                {
                  name: "endDate",
                  type: "date",
                  admin: {
                    date: { pickerAppearance: "dayAndTime" },
                    description: "When to stop displaying this content",
                  },
                },
              ],
            },
            {
              name: "notes",
              type: "textarea",
              admin: {
                position: "sidebar",
                description:
                  "Internal notes (e.g. send push notification for new release)",
              },
            },
          ],
        },

        // ── Tab 4: Display Settings ──────────────────────────────────────────
        {
          label: "Display Settings",
          admin: {
            description:
              "Configure Google Ads dimensions for banner, video, and custom placements.",
          },
          fields: [
            {
              name: "displayNotes",
              type: "textarea",
              admin: {
                condition: (data) => isBannerType(data),
                description:
                  "Notes for the design team (safe zones, background color, text placement, etc.)",
              },
            },
          ],
        },
      ],
    },
  ],
};

export default PartnerContent;
