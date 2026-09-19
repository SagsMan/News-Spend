import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { mockContext } from "../test-utils";
import { publisherRouter } from "./publisher";

describe("publisher.sendMessage", () => {
  it("returns success", async () => {
    const ctx = mockContext();
    const result = await call(
      publisherRouter.sendMessage,
      { channel: "test-channel", message: "hello" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true });
  });

  it("publishes a message to the channel", async () => {
    const ctx = mockContext();

    await call(
      publisherRouter.sendMessage,
      { channel: "my-channel", message: "test message" },
      { context: ctx }
    );

    // sendMessage returned successfully, the publish happened
    // (roundtrip verified in the onMessage test below)
  });
});

describe("publisher.onMessage", () => {
  it("yields messages published to the channel via sendMessage", async () => {
    const ctx = mockContext();
    const channel = `test-roundtrip-${Date.now()}`;

    // Start the subscription generator
    const stream = await call(
      publisherRouter.onMessage,
      { channel },
      { context: ctx }
    );

    const messages: Array<{ id: string; message: string }> = [];

    // Collect messages in the background with a bounded loop
    const collect = (async () => {
      for await (const msg of stream) {
        messages.push(msg as { id: string; message: string });
        if (messages.length >= 2) {
          break;
        }
      }
    })();

    // Give the subscription a moment to set up
    await new Promise((r) => setTimeout(r, 50));

    // Publish two messages via sendMessage
    await call(
      publisherRouter.sendMessage,
      { channel, message: "first" },
      { context: ctx }
    );
    await call(
      publisherRouter.sendMessage,
      { channel, message: "second" },
      { context: ctx }
    );

    // Wait for collection with a timeout to avoid hanging
    await Promise.race([
      collect,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("timeout waiting for messages")),
          3000
        )
      ),
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ message: "first" });
    expect(messages[1]).toMatchObject({ message: "second" });
    // Each message should have a UUID id
    expect(typeof messages[0]?.id).toBe("string");
    expect(typeof messages[1]?.id).toBe("string");
  });
});
