import z from "zod";

import { protectedNoGuestProcedure } from "../index";
import { createRateLimitMiddleware } from "../lib/ratelimit";

// Schema for post report input
const postReportSchema = z.object({
  relationTo: z.enum(["comments", "news"]),
  reason: z.enum([
    "spam",
    "other",
    "harassment",
    "hate-speech",
    "misinformation",
    "personal-info",
    "inappropriate",
    "off-topic",
    "trolling",
    "illegal",
  ]),
  additionalDetails: z.string(),
  reportedItem: z.string(),
});

export type PostReportInput = z.infer<typeof postReportSchema>;

export const createPostReport = protectedNoGuestProcedure
  // Reports feed the auto-hide threshold and the admin queue, so a single
  // account must not be able to flood either. Genuine reporting is bursty at
  // worst: a handful a minute is well clear of real use.
  .use(createRateLimitMiddleware({ maxRequests: 5, window: 60_000 }))
  .input(postReportSchema)
  .handler(async ({ input, context }) => {
    const { user, payload } = context;
    const { reportedItem, relationTo } = input;

    const response = await payload.create({
      collection: "contentReports",
      data: {
        reportedBy: user.id,
        reportedItem: {
          relationTo,
          value: reportedItem,
        },
        reason: input.reason,
        additionalDetails: input.additionalDetails,
      },
    });

    // No denormalized copy is kept on the user. "Comments I reported" is
    // derived from contentReports at read time (see comment/moderation-filters),
    // so there is nothing to drift when a report is dismissed or a comment
    // is deleted.
    return response;
  });

export const postReportRouter = {
  create: createPostReport,
};
