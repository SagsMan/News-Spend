import type { TaskConfig } from "payload";

export const deleteVideoThumbTempTask: TaskConfig<"deleteVideoThumbTemp"> = {
  slug: "deleteVideoThumbTemp",
  retries: 3,
  inputSchema: [{ name: "mediaId", type: "text", required: true }],
  outputSchema: [{ name: "deleted", type: "checkbox" }],
  handler: async ({ input, req }) => {
    await req.payload.delete({
      collection: "media",
      id: input.mediaId,
    });

    return { output: { deleted: true } };
  },
};
