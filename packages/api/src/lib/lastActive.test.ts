import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  LAST_ACTIVE_WINDOW_SECONDS,
  resetLastActiveWindows,
  shouldRecordActivity,
} from "./lastActive";

const WINDOW_MS = LAST_ACTIVE_WINDOW_SECONDS * 1000;

/**
 * Exercised without Redis, which is the fallback path and the one with the
 * dangerous failure mode: if the throttle ever answered "yes" every time, a
 * database write would ride along with every authenticated request.
 */
describe("shouldRecordActivity (no Redis)", () => {
  const originalUrl = process.env.REDIS_URL;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    resetLastActiveWindows();
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalUrl;
    }
    resetLastActiveWindows();
  });

  it("records the first time it sees a user", async () => {
    expect(await shouldRecordActivity("user-1")).toBe(true);
  });

  it("refuses again inside the window", async () => {
    const now = Date.now();

    expect(await shouldRecordActivity("user-1", now)).toBe(true);
    expect(await shouldRecordActivity("user-1", now + 1000)).toBe(false);
    expect(await shouldRecordActivity("user-1", now + WINDOW_MS - 1)).toBe(
      false
    );
  });

  it("records again once the window has passed", async () => {
    const now = Date.now();

    expect(await shouldRecordActivity("user-1", now)).toBe(true);
    expect(await shouldRecordActivity("user-1", now + WINDOW_MS + 1)).toBe(
      true
    );
  });

  it("tracks users independently", async () => {
    const now = Date.now();

    expect(await shouldRecordActivity("user-1", now)).toBe(true);
    expect(await shouldRecordActivity("user-2", now)).toBe(true);
    expect(await shouldRecordActivity("user-1", now)).toBe(false);
  });

  /**
   * The write rate this exists to bound. A hundred requests from one reader
   * inside an hour must cost exactly one update, not a hundred.
   */
  it("collapses a burst of requests into a single write", async () => {
    const now = Date.now();
    let writes = 0;

    for (let i = 0; i < 100; i++) {
      if (await shouldRecordActivity("user-1", now + i)) {
        writes++;
      }
    }

    expect(writes).toBe(1);
  });

  it("keeps the fallback map bounded under many users", async () => {
    const now = Date.now();

    for (let i = 0; i < 12_000; i++) {
      await shouldRecordActivity(`user-${i}`, now);
    }

    // Eviction must not resurrect a user still inside their window: the most
    // recent entries are the ones kept.
    expect(await shouldRecordActivity("user-11999", now)).toBe(false);
  });
});
