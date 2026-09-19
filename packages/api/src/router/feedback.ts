import z from "zod";

import { rateLimitedPublicProcedure } from "../index";

// Feedback schema (copied from backend)
const feedbackSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  type: z.enum(["general", "bug", "feature", "advertisement", "other"]),
  message: z.string(),
  rating: z.number().min(1).max(5).default(1),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

const createFeedback = rateLimitedPublicProcedure
  .input(feedbackSchema)
  .handler(async ({ input, context }) => {
    const { payload } = context;
    const feedback = await payload.create({
      collection: "feedback",
      data: input,
    });
    return feedback;
  });

export const feedbackRouter = {
  create: createFeedback,
};
