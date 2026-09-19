import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { TaskConfig } from "payload";

const execAsync = promisify(child_process.exec);

export const generateVideoThumbnailTask = {
  slug: "generateVideoThumbnail",
  retries: 2,
  handler: async ({ input, req }) => {
    const { docId, itemIndex, videoUrl, isHLS, oldThumbnailId, currentSource } =
      input;

    const TMP = "/tmp/payload-video-thumbs";
    fs.mkdirSync(TMP, { recursive: true });
    const outPath = path.join(TMP, `${crypto.randomUUID()}.jpg`);

    try {
      const ffmpegCmd = isHLS
        ? `ffmpeg -i "${videoUrl}" -vframes 1 -vf "select=gte(n\\,1)" -q:v 2 -f image2 "${outPath}" -y`
        : `ffmpeg -ss 00:00:02 -i "${videoUrl}" -vframes 1 -q:v 2 -f image2 "${outPath}" -y`;

      await execAsync(ffmpegCmd);

      const fileData = fs.readFileSync(outPath);
      const filesize = fs.statSync(outPath).size;

      if (oldThumbnailId) {
        try {
          await req.payload.delete({
            collection: "media",
            id: oldThumbnailId,
          });
        } catch {
          // non-fatal
        }
      }

      const thumbDoc = await req.payload.create({
        collection: "media",
        data: { alt: "Auto-generated thumbnail" },
        file: {
          data: fileData,
          name: `promo-thumb-${crypto.randomUUID()}.jpg`,
          mimetype: "image/jpeg",
          size: filesize,
        },
      });

      fs.unlinkSync(outPath);

      const latestDoc = await req.payload.findByID({
        collection: "partner-content",
        id: docId,
        depth: 2,
      });

      const items: any = latestDoc.items ?? [];
      const item = items[itemIndex] as
        | { layout?: Array<{ blockType?: string }> }
        | undefined;
      const blk = item?.layout?.[0];

      if (blk?.blockType !== "promo-video-source") {
        return { output: { success: false, reason: "Block no longer exists" } };
      }

      items[itemIndex] = {
        ...item,
        layout: [
          {
            ...blk,
            thumbnail: thumbDoc.id,
            thumbnailSource: currentSource,
          },
        ],
      };

      await req.payload.update({
        collection: "partner-content",
        id: docId,
        data: { items },
      });

      return { output: { success: true, thumbnailId: thumbDoc.id } };
    } catch (err) {
      try {
        fs.unlinkSync(outPath);
      } catch {
        // ignore
      }
      throw err;
    }
  },
  inputSchema: [
    { name: "docId", type: "text", required: true },
    { name: "itemIndex", type: "number", required: true },
    { name: "videoUrl", type: "text", required: true },
    { name: "isHLS", type: "checkbox", required: true },
    { name: "oldThumbnailId", type: "text" },
    { name: "currentSource", type: "text", required: true },
  ],
  outputSchema: [
    { name: "success", type: "checkbox" },
    { name: "thumbnailId", type: "text" },
    { name: "reason", type: "text" },
  ],
} as TaskConfig<"generateVideoThumbnail">;
