import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { sql } from "@payloadcms/db-postgres";
import {
  BoldFeature,
  FixedToolbarFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  lexicalEditor,
  ParagraphFeature,
  UnderlineFeature,
} from "@payloadcms/richtext-lexical";
import type { CollectionConfig } from "payload";
import slugify from "slugify";

const execAsync = promisify(child_process.exec);

const REGEX_FILENAME = /^(?<name>.+?)(?<ext>\.[^.]*?)?$/;

const TMP_DIR = "/tmp/payload-video-thumbs";

async function generateVideoThumbnail(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await execAsync(
    `ffmpeg -ss 00:00:02 -i "${inputPath}" -vframes 1 -c:v mjpeg -q:v 2 "${outputPath}" -y`
  );
}

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data.filename) {
          return data;
        }
        const match = data.filename.match(REGEX_FILENAME);
        const { name = data.filename, ext = "" } = match?.groups || {};
        data.filename = `${slugify(name, { lower: true, strict: true })}${ext}`;
        return data;
      },
    ],
    afterChange: [
      // Step 1: Extract frame from video, stash on req for afterOperation
      async ({ doc, req, operation }) => {
        if (
          operation !== "create" ||
          !req.file ||
          !doc.mimeType?.startsWith("video/")
        ) {
          return doc;
        }

        fs.mkdirSync(TMP_DIR, { recursive: true });

        const inputExt = req.file.name.split(".").pop() || "mp4";
        const inputPath = path.join(
          TMP_DIR,
          `${crypto.randomUUID()}.${inputExt}`
        );
        const outputPath = path.join(TMP_DIR, `${crypto.randomUUID()}.jpg`);

        try {
          if (
            "tempFilePath" in req.file &&
            typeof req.file.tempFilePath === "string" &&
            req.file.tempFilePath.length > 0
          ) {
            fs.copyFileSync(req.file.tempFilePath, inputPath);
          } else {
            fs.writeFileSync(inputPath, req.file.data as Buffer);
          }

          await generateVideoThumbnail(inputPath, outputPath);

          const fileData = fs.readFileSync(outputPath);
          const filesize = fs.statSync(outputPath).size;
          const thumbName = `${crypto.randomUUID()}.jpg`;

          console.log(
            "🎬 [video-thumbnail] Extracted:",
            filesize,
            "bytes, stashing for afterOperation"
          );

          (req as any).__videoThumb = {
            fileData,
            filesize,
            thumbName,
            videoDocId: doc.id,
          };
        } catch (err) {
          console.error("🎬 [video-thumbnail] Extraction failed:", err);
        } finally {
          try {
            fs.unlinkSync(inputPath);
          } catch {
            /* ignore */
          }
          try {
            fs.unlinkSync(outputPath);
          } catch {
            /* ignore */
          }
        }

        return doc;
      },

      // Step 2: Re-apply thumbnail sizes after cloud storage plugin's update wipes them
      async ({ doc, req, operation }) => {
        // Cloud storage calls payload.update with skipCloudStorage=true after uploading
        // That update wipes our drizzle-written sizes. Re-apply them here.
        const pending = (req as any).__videoThumbSizes as
          | {
              videoDocId: string;
              s: {
                url: string;
                width: number | null;
                height: number | null;
                mimeType: string | null;
                filesize: number | null;
                filename: string | null;
              };
              thumbDocId: string;
            }
          | undefined;

        if (
          operation !== "update" ||
          !req.context?.skipCloudStorage ||
          !pending ||
          doc.id !== pending.videoDocId
        ) {
          return doc;
        }

        (req as any).__videoThumbSizes = undefined;

        console.log(
          "🎬 [video-thumbnail] Re-applying sizes after cloud storage update:",
          pending.videoDocId
        );

        try {
          const { s, videoDocId, thumbDocId } = pending;
          await (req.payload.db as any).drizzle.execute(sql`
            UPDATE media SET
              sizes_video_thumbnail_url       = ${s.url},
              sizes_video_thumbnail_width     = ${s.width ?? null},
              sizes_video_thumbnail_height    = ${s.height ?? null},
              sizes_video_thumbnail_mime_type = ${s.mimeType ?? null},
              sizes_video_thumbnail_filesize  = ${s.filesize ?? null},
              sizes_video_thumbnail_filename  = ${s.filename ?? null}
            WHERE id = ${videoDocId}
          `);
          console.log("🎬 [video-thumbnail] Sizes persisted for:", videoDocId);

          await req.payload.jobs.queue({
            task: "deleteVideoThumbTemp",
            input: { mediaId: thumbDocId },
          });

          console.log("🎬 [video-thumbnail] Done");
        } catch (err) {
          console.error("🎬 [video-thumbnail] Failed re-applying sizes:", err);
        }

        return doc;
      },
    ],
    afterOperation: [
      // Step 1.5: Create temp thumb doc (gets sharp-processed + SFTP-uploaded),
      // stash sizes data on req so afterChange step 2 can persist it after cloud storage update
      async ({ operation, result, req }) => {
        const stash = (req as any).__videoThumb;
        if (operation !== "create" || !stash) {
          return result;
        }

        (req as any).__videoThumb = undefined;

        const { fileData, filesize, thumbName, videoDocId } = stash as {
          fileData: Buffer;
          filesize: number;
          thumbName: string;
          videoDocId: string;
        };

        console.log(
          "🎬 [video-thumbnail] afterOperation: creating thumb doc for video:",
          videoDocId
        );

        try {
          const thumbDoc = await req.payload.create({
            collection: "media",
            data: {
              filename: thumbName,
              mimeType: "image/jpeg",
              filesize,
              alt: "__video-thumb-temp__",
            },
            file: {
              data: fileData,
              name: thumbName,
              mimetype: "image/jpeg",
              size: filesize,
            },
          });

          const s = thumbDoc.sizes?.videoThumbnail;
          console.log("🎬 [video-thumbnail] size entry:", JSON.stringify(s));

          if (s?.url) {
            // Stash for step 2 afterChange. Cloud storage will fire payload.update on
            // the video doc next (skipCloudStorage=true), which wipes our sizes.
            // Step 2 afterChange catches that update and re-applies.
            (req as any).__videoThumbSizes = {
              videoDocId,
              thumbDocId: String(thumbDoc.id),
              s: {
                url: s.url,
                width: s.width ?? null,
                height: s.height ?? null,
                mimeType: s.mimeType ?? null,
                filesize: s.filesize ?? null,
                filename: s.filename ?? null,
              },
            };
            console.log(
              "🎬 [video-thumbnail] Stashed sizes for post-cloud-storage write"
            );
          }
        } catch (err) {
          console.error("🎬 [video-thumbnail] Failed in afterOperation:", err);
        }

        return result;
      },
    ],
  },
  upload: {
    displayPreview: true,
    adminThumbnail: ({ doc }) => {
      const sizes = doc?.sizes as Record<string, { url?: string } | undefined>;
      return (
        sizes?.videoThumbnail?.url ??
        sizes?.thumbnail?.url ??
        `https://media.newsspend.com/assets${process.env.NODE_ENV === "production" ? "" : "/dev"}/media/${doc.filename}`
      );
    },
    mimeTypes: ["image/*", "video/*"],

    imageSizes: [
      {
        name: "thumbnail",
        width: 400,
        height: 400,
        position: "centre",
        formatOptions: {
          format: "webp",
          options: { quality: 75 },
        },
      },
      {
        name: "card",
        width: 768,
        height: 1024,
        position: "centre",
        formatOptions: {
          format: "webp",
          options: { quality: 80 },
        },
      },
      {
        name: "mobile",
        width: 800,
        position: "centre",
        formatOptions: {
          format: "webp",
          options: { quality: 85 },
        },
      },
      {
        name: "videoThumbnail",
        width: 400,
        height: 225,
        position: "centre",
        formatOptions: {
          format: "webp",
          options: { quality: 75 },
        },
      },
    ],

    formatOptions: {
      format: "webp",
      options: { quality: 85 },
    },
  },
  fields: [
    {
      name: "alt",
      type: "text",
    },
    {
      name: "caption",
      type: "richText",
      editor: lexicalEditor({
        features: () => [
          ParagraphFeature(),
          UnderlineFeature(),
          BoldFeature(),
          ItalicFeature(),
          LinkFeature(),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
        ],
      }),
    },
  ],
};
