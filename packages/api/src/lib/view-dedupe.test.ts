import { describe, expect, it } from "bun:test";

import { tryMarkView } from "./view-dedupe";

// Minimal fake redis client supporting set behavior
class FakeRedis {
  store: Record<string, number> = {};
  async set(
    key: string,
    _val: string,
    _ex: string | number,
    ttlSeconds: number,
    nx?: string
  ) {
    const exists = this.store[key] && this.store[key] > Date.now();
    if (nx === "NX") {
      if (exists) {
        return null;
      }
      this.store[key] = Date.now() + ttlSeconds * 1000;
      return "OK";
    }
    this.store[key] = Date.now() + ttlSeconds * 1000;
    return "OK";
  }
}

describe("tryMarkView", () => {
  it("returns true and sets key when not present", async () => {
    const r = new FakeRedis();
    const ok = await tryMarkView(r as any, "a", 10);
    expect(ok).toBe(true);
  });

  it("returns false when key exists", async () => {
    const r = new FakeRedis();
    // set once
    await tryMarkView(r as any, "b", 10);
    const ok2 = await tryMarkView(r as any, "b", 10);
    expect(ok2).toBe(false);
  });

  it("returns true if redis client is falsy", async () => {
    const ok = await tryMarkView(null as any, "x", 10);
    expect(ok).toBe(true);
  });
});
