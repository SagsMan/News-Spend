import { describe, expect, it, mock } from "bun:test";
import { ORPCError } from "@orpc/client";
import { call } from "@orpc/server";

import { expectError, mockContext } from "../test-utils";
import { tweetRouter } from "./tweet";

// Module mock for react-tweet/api: tweetRouter calls getTweet
type MockTweet = { id: string; text: string };

const getTweetMock = mock(
  (_id: string): Promise<MockTweet | undefined> =>
    Promise.resolve({ id: "1", text: "Hello world" })
);

mock.module("react-tweet/api", () => ({
  getTweet: getTweetMock,
}));

describe("tweetRouter.getById", () => {
  it("returns tweet data on success", async () => {
    getTweetMock.mockImplementation(() =>
      Promise.resolve({ id: "123", text: "Great tweet" })
    );

    const result = await call(
      tweetRouter.getById,
      { id: "123" },
      { context: mockContext() }
    );

    // Handler wraps getTweet result as { data: tweet }
    expect(result.data).toMatchObject({
      id: "123",
      text: "Great tweet",
    });
  });

  it("wraps the tweet data even when getTweet returns undefined", async () => {
    getTweetMock.mockImplementation(() => Promise.resolve(undefined));

    const result = await call(
      tweetRouter.getById,
      { id: "2000000000000000000" },
      { context: mockContext() }
    );

    // The handler always wraps in { data: tweet }, so undefined tweet → { data: undefined }
    expect(result).toEqual({ data: undefined });
  });

  it("throws BAD_REQUEST when getTweet throws a regular Error", async () => {
    getTweetMock.mockImplementation(() =>
      Promise.reject(new Error("Tweet not found"))
    );

    const error = await expectError(
      call(
        tweetRouter.getById,
        { id: "3000000000000000000" },
        { context: mockContext() }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Tweet not found",
    });
  });

  it("re-throws an ORPCError as-is", async () => {
    const orpcErr = new ORPCError("CONFLICT", {
      message: "duplicate",
    });
    getTweetMock.mockImplementation(() => Promise.reject(orpcErr));

    const error = await expectError(
      call(
        tweetRouter.getById,
        { id: "4000000000000000000" },
        { context: mockContext() }
      )
    );

    expect(error).toMatchObject({
      code: "CONFLICT",
      message: "duplicate",
    });
  });

  it("rejects an id that is not a snowflake before calling Twitter", async () => {
    getTweetMock.mockClear();
    getTweetMock.mockImplementation(() =>
      Promise.resolve({ id: "1", text: "should never be reached" })
    );

    const error = await expectError(
      call(tweetRouter.getById, { id: "weird" }, { context: mockContext() })
    );

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
    // The point of the guard: no outbound request is made at all.
    expect(getTweetMock).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST with fallback message for non-Error throws", async () => {
    getTweetMock.mockImplementation(() => Promise.reject("string error"));

    const error = await expectError(
      call(
        tweetRouter.getById,
        { id: "5000000000000000000" },
        { context: mockContext() }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Failed to fetch tweet",
    });
  });
});
