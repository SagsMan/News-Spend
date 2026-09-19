import { describe, expect, it } from "bun:test";
import { isInferableError } from "@orpc/client";
import { call } from "@orpc/server";
import { mockContext } from "../test-utils";
import { blockRouter } from "./block";

const authedUser = {
  id: "user-1",
  isAnonymous: false,
  username: "tester",
};

describe("blockRouter.blockUser", () => {
  it("throws a defined BAD_REQUEST when blocking yourself", async () => {
    const ctx = mockContext({ user: authedUser as never });

    try {
      await call(blockRouter.blockUser, { userId: "user-1" }, { context: ctx });
      expect.unreachable("expected blockUser to throw");
    } catch (error) {
      expect(isInferableError(error)).toBe(true);
      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: "You cannot block yourself",
      });
    }
  });

  it("returns success when blocking another user", async () => {
    const ctx = mockContext({
      user: authedUser as never,
      payload: {
        create: async () => ({ id: "block-1" }),
      },
    });

    const result = await call(
      blockRouter.blockUser,
      { userId: "user-2" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true });
  });

  it("treats a duplicate block as an already-blocked success", async () => {
    const uniqueViolation = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    const ctx = mockContext({
      user: authedUser as never,
      payload: {
        create: async () => {
          throw uniqueViolation;
        },
      },
    });

    const result = await call(
      blockRouter.blockUser,
      { userId: "user-2" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true, alreadyBlocked: true });
  });
});
