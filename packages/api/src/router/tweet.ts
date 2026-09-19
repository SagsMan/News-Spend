import { ORPCError } from "@orpc/client";
import { openapi } from "@orpc/openapi";
import { getTweet } from "react-tweet/api";
import { z } from "zod";

import { publicProcedure } from "..";
import { tweetRateLimitMiddleware } from "../lib/ratelimit";

/** A tweet id is a snowflake: digits only, and never longer than 20 of them. */
const tweetId = z.string().regex(/^\d{1,20}$/, "Invalid tweet ID");

/**
 * Rate limited, and the id is validated rather than passed through.
 *
 * This calls Twitter's syndication API with our server as the egress, so an
 * unthrottled public procedure is an open proxy: the cost of abuse lands on
 * our IP's standing with Twitter, not the caller's. It gets its own bucket so
 * rendering tweets does not consume the allowance for reports and comments.
 */
const getTweetById = publicProcedure
  .use(tweetRateLimitMiddleware)
  .input(z.object({ id: tweetId }))
  .meta(
    openapi({
      method: "GET",
      path: "/tweet/{id}",
      tags: ["Tweet"],
      summary: "Get tweet by ID",
      description: "Fetch a tweet by its ID from Twitter",
    })
  )
  .handler(async ({ input, errors }) => {
    try {
      const tweet = await getTweet(input.id);

      return { data: tweet };
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }
      throw errors.BAD_REQUEST({
        message:
          error instanceof Error ? error.message : "Failed to fetch tweet",
      });
    }
  });

export const tweetRouter = {
  getById: getTweetById,
};
