import { describe, expect, it } from "bun:test";
import { MemoryPublisher } from "@orpc/publisher/memory";

type Events = { ping: { id: string; message: string } };

describe("MemoryPublisher", () => {
  it("delivers published events to subscribers", async () => {
    const publisher = new MemoryPublisher<Events>();
    const received: Events["ping"][] = [];

    const unsubscribe = await publisher.subscribe("ping", (payload) => {
      received.push(payload);
    });

    await publisher.publish("ping", { id: "1", message: "hello" });
    await publisher.publish("ping", { id: "2", message: "world" });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(received).toEqual([
      { id: "1", message: "hello" },
      { id: "2", message: "world" },
    ]);

    await unsubscribe();
  });

  it("stops delivering after unsubscribe", async () => {
    const publisher = new MemoryPublisher<Events>();
    const received: Events["ping"][] = [];

    const unsubscribe = await publisher.subscribe("ping", (payload) => {
      received.push(payload);
    });

    await publisher.publish("ping", { id: "1", message: "hello" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await unsubscribe();

    await publisher.publish("ping", { id: "2", message: "ignored" });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received).toEqual([{ id: "1", message: "hello" }]);
  });
});
