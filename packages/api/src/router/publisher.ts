import { randomUUID } from "node:crypto";

import z from "zod";

import { publisher } from "../events";
import { publicProcedure } from "../index";

const onMessage = publicProcedure
  .input(z.object({ channel: z.string() }))
  .handler(async function* ({ input, signal }) {
    for await (const payload of publisher.subscribe(input.channel, {
      signal,
    })) {
      yield payload;
    }
  });

const sendMessage = publicProcedure
  .input(z.object({ channel: z.string(), message: z.string() }))
  .handler(({ input }) => {
    publisher.publish(input.channel, {
      id: randomUUID(),
      message: input.message,
    });
    return { success: true };
  });

export const publisherRouter = {
  onMessage,
  sendMessage,
};
