import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { createFakePayload, expectError, mockContext } from "../test-utils";
import { reportRouter } from "./report";

const validInput = {
  name: "Jane Doe",
  title: "Breaking news report",
  reportType: "shortMessage" as const,
  description: "A detailed description of the event",
  files: [],
};

describe("report.create", () => {
  it("creates a witness-report for an anonymous caller with no files", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const result = await call(reportRouter.create, validInput, {
      context: ctx,
    });

    expect(result).toMatchObject({
      name: "Jane Doe",
      title: "Breaking news report",
      reportType: "shortMessage",
      description: "A detailed description of the event",
    });
    expect(payload.docs("witness-reports")).toHaveLength(1);
    expect(payload.transactions).toEqual(["begin:tx-1", "commit:tx-1"]);
  });

  it("creates media docs and witness-report when files are provided", async () => {
    const file = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const result = await call(
      reportRouter.create,
      { ...validInput, files: [file] },
      { context: ctx }
    );

    expect(result).toMatchObject({ name: "Jane Doe" });
    expect(payload.docs("media")).toHaveLength(1);
    expect(payload.docs("media")[0]).toMatchObject({
      alt: "photo.jpg",
      mimeType: "image/jpeg",
      filename: "photo.jpg",
      filesize: file.size,
    });
    expect(payload.docs("witness-reports")).toHaveLength(1);
    expect(payload.docs("witness-reports")[0]?.files).toEqual([
      payload.docs("media")[0]?.id,
    ]);
    expect(payload.transactions).toEqual(["begin:tx-1", "commit:tx-1"]);
  });

  it("creates multiple media docs for multiple files", async () => {
    const file1 = new File(["abc"], "photo1.jpg", { type: "image/jpeg" });
    const file2 = new File(["def"], "photo2.png", { type: "image/png" });
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const result = await call(
      reportRouter.create,
      { ...validInput, files: [file1, file2] },
      { context: ctx }
    );

    expect(payload.docs("media")).toHaveLength(2);
    expect(result).toMatchObject({ name: "Jane Doe" });
    expect(payload.docs("witness-reports")[0]?.files).toHaveLength(2);
    expect(payload.transactions).toEqual(["begin:tx-1", "commit:tx-1"]);
  });

  it("rolls back and throws INTERNAL_SERVER_ERROR when media creation fails", async () => {
    const file = new File(["abc"], "photo.jpg", { type: "image/jpeg" });
    const payload = createFakePayload();

    // Override create to throw only for the media collection
    const originalCreate = payload.create;
    payload.create = (args: Parameters<typeof originalCreate>[0]) => {
      if (args.collection === "media") {
        throw new Error("Media upload failed");
      }
      return originalCreate(args);
    };
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        reportRouter.create,
        { ...validInput, files: [file] },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to upload files",
    });
    expect(payload.transactions).toEqual(["begin:tx-1", "rollback:tx-1"]);
    expect(payload.docs("witness-reports")).toHaveLength(0);
  });

  it("rolls back and rethrows when witness-reports creation fails", async () => {
    const payload = createFakePayload();

    const originalCreate = payload.create;
    payload.create = (args: Parameters<typeof originalCreate>[0]) => {
      if (args.collection === "witness-reports") {
        throw new Error("DB constraint violation");
      }
      return originalCreate(args);
    };
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(reportRouter.create, validInput, { context: ctx })
    );

    expect(error).toMatchObject({
      message: "DB constraint violation",
    });
    expect(payload.transactions).toEqual(["begin:tx-1", "rollback:tx-1"]);
  });

  it("rejects an invalid reportType with BAD_REQUEST", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        reportRouter.create,
        { ...validInput, reportType: "invalidType" } as never,
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
    expect(payload.calls).toHaveLength(0);
  });

  it("rejects missing required fields with BAD_REQUEST", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(reportRouter.create, { name: "Jane" } as never, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
    expect(payload.calls).toHaveLength(0);
  });

  it("rate limits a caller past the window allowance", async () => {
    const payload = createFakePayload();
    const user = {
      id: `rl-report-${Date.now()}`,
      isAnonymous: false,
      username: "rl",
    };
    const ctx = mockContext({ user: user as never, payload });

    const attempts = await Promise.all(
      Array.from({ length: 12 }, () =>
        call(reportRouter.create, validInput, { context: ctx }).then(
          () => "ok",
          (error: { code: string }) => error.code
        )
      )
    );

    expect(attempts.filter((a) => a === "ok")).toHaveLength(10);
    expect(attempts.filter((a) => a === "TOO_MANY_REQUESTS")).toHaveLength(2);
  });
});
