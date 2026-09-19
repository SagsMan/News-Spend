import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { createFakePayload, expectError, mockContext } from "../test-utils";
import { feedbackRouter } from "./feedback";

const validInput = {
  name: "Ada",
  email: "ada@example.com",
  type: "bug" as const,
  message: "The feed stops loading after page 3",
  rating: 4,
};

describe("feedback.create", () => {
  it("stores the feedback for an anonymous caller", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const result = await call(feedbackRouter.create, validInput, {
      context: ctx,
    });

    expect(result).toMatchObject(validInput);
    expect(payload.docs("feedback")).toHaveLength(1);
  });

  it("defaults the rating to 1 when omitted", async () => {
    const payload = createFakePayload();
    const { rating, ...withoutRating } = validInput;

    await call(feedbackRouter.create, withoutRating, {
      context: mockContext({ payload }),
    });

    expect(payload.docs("feedback")[0]).toMatchObject({ rating: 1 });
  });

  it("rejects a malformed email without writing anything", async () => {
    const payload = createFakePayload();

    const error = await expectError(
      call(
        feedbackRouter.create,
        { ...validInput, email: "not-an-email" },
        { context: mockContext({ payload }) }
      )
    );

    // oRPC surfaces a schema failure as BAD_REQUEST / "Input validation failed",
    // not the INPUT_VALIDATION_FAILED entry in commonErrors.
    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
    expect(payload.calls).toHaveLength(0);
  });

  it("rate limits a caller past the window allowance", async () => {
    const payload = createFakePayload();
    // The shared limiter keys on the user id, so a unique id keeps this test
    // independent of the other cases in this file.
    const user = { id: `rl-${Date.now()}`, isAnonymous: false, username: "rl" };
    const ctx = mockContext({ user: user as never, payload });

    const attempts = await Promise.all(
      Array.from({ length: 12 }, () =>
        call(feedbackRouter.create, validInput, { context: ctx }).then(
          () => "ok",
          (error: { code: string }) => error.code
        )
      )
    );

    expect(attempts.filter((a) => a === "ok")).toHaveLength(10);
    expect(attempts.filter((a) => a === "TOO_MANY_REQUESTS")).toHaveLength(2);
  });
});
