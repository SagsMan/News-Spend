import { apiErrorMessage } from "../apiErrorMessage";

const FALLBACK = "Something went wrong.";

describe("apiErrorMessage", () => {
  it("surfaces the content-filter rejection", () => {
    const message =
      "Your comment couldn't be posted because it appears to violate our community guidelines. Please revise it and try again.";

    expect(apiErrorMessage({ code: "BAD_REQUEST", message }, FALLBACK)).toBe(
      message
    );
  });

  it("surfaces rate-limit and permission messages", () => {
    expect(
      apiErrorMessage(
        { code: "TOO_MANY_REQUESTS", message: "Slow down a moment." },
        FALLBACK
      )
    ).toBe("Slow down a moment.");
    expect(
      apiErrorMessage({ status: 403, message: "Not allowed here." }, FALLBACK)
    ).toBe("Not allowed here.");
  });

  it("hides messages from codes that are not user-facing", () => {
    // The whole point: an internal failure must never put a database or stack
    // detail into a toast.
    for (const error of [
      {
        code: "INTERNAL_SERVER_ERROR",
        message: 'relation "comments" does not exist',
      },
      { status: 500, message: "ECONNREFUSED 127.0.0.1:5432" },
      { code: "NOT_FOUND", message: "Comment not found" },
    ]) {
      expect(apiErrorMessage(error, FALLBACK)).toBe(FALLBACK);
    }
  });

  it("ignores placeholder messages that are just the code", () => {
    expect(
      apiErrorMessage({ code: "BAD_REQUEST", message: "BAD_REQUEST" }, FALLBACK)
    ).toBe(FALLBACK);
    expect(
      apiErrorMessage(
        { code: "BAD_REQUEST", message: "TOO_MANY_REQUESTS" },
        FALLBACK
      )
    ).toBe(FALLBACK);
  });

  it("falls back on malformed or empty input", () => {
    for (const error of [
      null,
      undefined,
      "a string",
      {},
      { code: "BAD_REQUEST" },
      { code: "BAD_REQUEST", message: "   " },
      { code: "BAD_REQUEST", message: 42 },
    ]) {
      expect(apiErrorMessage(error, FALLBACK)).toBe(FALLBACK);
    }
  });
});
