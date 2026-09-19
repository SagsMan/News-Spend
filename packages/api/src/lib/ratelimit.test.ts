import { describe, expect, it } from "bun:test";
import { isInferableError } from "@orpc/client";
import { call, os } from "@orpc/server";
import z from "zod";

import type { Context } from "../context";
import { commonErrors } from "../errors";
import { mockContext } from "../test-utils";
import { createRateLimitMiddleware } from "./ratelimit";

// Build a real procedure with the rate-limit middleware attached, mirroring
// how routers compose procedures (see router/block.ts and index.ts basicProcedure).
// Each test gets a fresh procedure so the in-memory limiter starts at zero.
function rateLimitedProcedure() {
  return os
    .$context<Context>()
    .errors(commonErrors)
    .use(createRateLimitMiddleware({ maxRequests: 2, window: 60_000 }))
    .input(z.object({}))
    .handler(async () => ({ pong: true }));
}

const authedUser = {
  id: "user-1",
  isAnonymous: false,
  username: "tester",
};

describe("createRateLimitMiddleware", () => {
  it("allows requests within the limit", async () => {
    const procedure = rateLimitedProcedure();
    const ctx = mockContext({ user: authedUser as never });

    const first = await call(procedure, {}, { context: ctx });
    const second = await call(procedure, {}, { context: ctx });

    expect(first).toEqual({ pong: true });
    expect(second).toEqual({ pong: true });
  });

  it("rejects requests beyond the limit with TOO_MANY_REQUESTS", async () => {
    const procedure = rateLimitedProcedure();
    const ctx = mockContext({ user: authedUser as never });

    await call(procedure, {}, { context: ctx });
    await call(procedure, {}, { context: ctx });

    try {
      await call(procedure, {}, { context: ctx });
      expect.unreachable("expected the third call to be rate limited");
    } catch (error) {
      expect(isInferableError(error)).toBe(true);
      expect(error).toMatchObject({ code: "TOO_MANY_REQUESTS" });
    }
  });
});
