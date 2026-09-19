import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import crypto from "node:crypto";
import { call } from "@orpc/server";

// Mock sendNotification: hoisted before all imports by bun:test
const notificationMock = mock(async () => ({}));
mock.module("@news-spend-media/payload/lib/send-notification", () => ({
  sendNotification: notificationMock,
}));

import {
  createFakePayload,
  type Doc,
  expectError,
  mockContext,
} from "../test-utils";
import { surveyRouter } from "./survey";

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };

const CPX_SECRET = "test-cpx-secret";

function cpxHash(transId: string): string {
  return crypto
    .createHash("md5")
    .update(`${transId}-${CPX_SECRET}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// survey.awardGoogleFormPoints
// ---------------------------------------------------------------------------
describe("survey.awardGoogleFormPoints", () => {
  beforeEach(() => {
    notificationMock.mockClear();
  });

  it("throws UNAUTHORIZED when no auth", async () => {
    const error = await expectError(
      call(
        surveyRouter.awardGoogleFormPoints,
        { gFormId: "form-1", userId: "user-1" },
        { context: mockContext() }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("throws NOT_FOUND when survey not found", async () => {
    const payload = createFakePayload({ collections: { survey: [] } });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        surveyRouter.awardGoogleFormPoints,
        { gFormId: "nonexistent", userId: "user-1" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "Survey not found",
    });
  });

  it("returns early when userId already in survey.users (dedupe)", async () => {
    const payload = createFakePayload({
      collections: {
        survey: [
          {
            id: "s1",
            googleFormId: "form-1",
            users: ["user-1"],
            points: 50,
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      surveyRouter.awardGoogleFormPoints,
      { gFormId: "form-1", userId: "user-1" },
      { context: ctx }
    );

    expect(result).toMatchObject({ id: "s1", users: ["user-1"] });
    // No activity created, no notification sent
    expect(payload.docs("activities")).toHaveLength(0);
    expect(notificationMock).not.toHaveBeenCalled();
  });

  it("awards points and sends notification on success", async () => {
    const payload = createFakePayload({
      collections: {
        survey: [{ id: "s1", googleFormId: "form-1", users: [], points: 50 }],
        "push-tokens": [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      surveyRouter.awardGoogleFormPoints,
      { gFormId: "form-1", userId: "user-1" },
      { context: ctx }
    );

    expect(result).toMatchObject({ id: "s1" });
    // Survey users array updated
    expect(payload.docs("survey")[0]?.users).toContain("user-1");
    // Activity created
    expect(payload.docs("activities")).toHaveLength(1);
    expect(payload.docs("activities")[0]).toMatchObject({
      type: "point",
      point: 50,
      action: "surveyTask",
      user: "user-1",
    });
    // Notification sent
    expect(notificationMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to 10 points when survey.points is undefined", async () => {
    const payload = createFakePayload({
      collections: {
        survey: [{ id: "s1", googleFormId: "form-1", users: [] }],
        "push-tokens": [],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    await call(
      surveyRouter.awardGoogleFormPoints,
      { gFormId: "form-1", userId: "user-1" },
      { context: ctx }
    );

    expect(payload.docs("activities")[0]).toMatchObject({ point: 10 });
  });
});

// ---------------------------------------------------------------------------
// survey.getAll
// ---------------------------------------------------------------------------
describe("survey.getAll", () => {
  it("throws UNAUTHORIZED when no auth", async () => {
    const error = await expectError(
      call(surveyRouter.getAll, undefined, {
        context: mockContext(),
      })
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("excludes surveys the user has already completed", async () => {
    const payload = createFakePayload({
      collections: {
        survey: [
          { id: "s1", users: ["user-1"], title: "Completed" },
          { id: "s2", users: ["user-2"], title: "Available" },
          { id: "s3", users: [], title: "New" },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(surveyRouter.getAll, undefined, {
      context: ctx,
    });

    expect(result.docs).toHaveLength(2);
    expect(result.docs.map((s: Doc) => s.id)).toEqual(["s2", "s3"]);
  });

  it("returns empty when user has completed all surveys", async () => {
    const payload = createFakePayload({
      collections: {
        survey: [
          { id: "s1", users: ["user-1"] },
          { id: "s2", users: ["user-1"] },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(surveyRouter.getAll, undefined, {
      context: ctx,
    });

    expect(result.docs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// survey.cpx.postback
// ---------------------------------------------------------------------------
describe("survey.cpx.postback", () => {
  let originalCpxSecret: string | undefined;

  beforeEach(() => {
    originalCpxSecret = process.env.CPX_SECURE_HASH;
    process.env.CPX_SECURE_HASH = CPX_SECRET;
    notificationMock.mockClear();
  });

  afterEach(() => {
    if (originalCpxSecret === undefined) {
      delete process.env.CPX_SECURE_HASH;
    } else {
      process.env.CPX_SECURE_HASH = originalCpxSecret;
    }
  });

  it("throws BAD_REQUEST for invalid hash", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        surveyRouter.cpx.postback,
        {
          status: "1",
          trans_id: "t1",
          user_id: "user-1",
          type: "complete",
          secure_hash: "invalid-hash",
        },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid secure hash",
    });
  });

  it("throws NOT_FOUND when user does not exist", async () => {
    const payload = createFakePayload({ collections: { users: [] } });
    const ctx = mockContext({ payload });
    const hash = cpxHash("t1");

    const error = await expectError(
      call(
        surveyRouter.cpx.postback,
        {
          status: "1",
          trans_id: "t1",
          user_id: "nonexistent",
          type: "complete",
          secure_hash: hash,
        },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });

  it("returns no-points-to-reverse for reversal with zero amount", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }] },
    });
    const ctx = mockContext({ payload });
    const hash = cpxHash("t2");

    const result = await call(
      surveyRouter.cpx.postback,
      {
        status: "1",
        trans_id: "t2",
        user_id: "user-1",
        type: "reversal",
        amount_local: 0,
        secure_hash: hash,
      },
      { context: ctx }
    );

    expect(result).toMatchObject({
      success: true,
      message: "No points to reverse",
    });
    expect(payload.docs("activities")).toHaveLength(0);
  });

  it("awards points on status 1 + complete", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }], "push-tokens": [] },
    });
    const ctx = mockContext({ payload });
    const hash = cpxHash("t3");

    const result = await call(
      surveyRouter.cpx.postback,
      {
        status: "1",
        trans_id: "t3",
        user_id: "user-1",
        type: "complete",
        amount_local: 100,
        secure_hash: hash,
      },
      { context: ctx }
    );

    expect(result).toMatchObject({
      success: true,
      message: "Survey processed successfully",
    });
    expect(payload.docs("activities")).toHaveLength(1);
    expect(payload.docs("activities")[0]).toMatchObject({
      type: "point",
      point: 100,
      action: "surveyTask",
      user: "user-1",
    });
  });

  it("awards bonus points on status 1 + out with positive amount", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }], "push-tokens": [] },
    });
    const ctx = mockContext({ payload });
    const hash = cpxHash("t4");

    const result = await call(
      surveyRouter.cpx.postback,
      {
        status: "1",
        trans_id: "t4",
        user_id: "user-1",
        type: "out",
        amount_local: 50,
        secure_hash: hash,
      },
      { context: ctx }
    );

    expect(result).toMatchObject({
      success: true,
      message: "Survey processed successfully",
    });
    expect(payload.docs("activities")).toHaveLength(1);
    expect(payload.docs("activities")[0]).toMatchObject({
      point: 50,
      action: "surveyTask",
    });
  });

  it("does not award bonus on status 1 + out with zero amount", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }] },
    });
    const ctx = mockContext({ payload });
    const hash = cpxHash("t5");

    const result = await call(
      surveyRouter.cpx.postback,
      {
        status: "1",
        trans_id: "t5",
        user_id: "user-1",
        type: "out",
        amount_local: 0,
        secure_hash: hash,
      },
      { context: ctx }
    );

    expect(result).toMatchObject({
      success: true,
      message: "Survey processed successfully",
    });
    expect(payload.docs("activities")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// survey.offers.getOffers
// ---------------------------------------------------------------------------
describe("survey.offers.getOffers", () => {
  it("returns mock offers for guest users", async () => {
    const ctx = mockContext();

    const result = await call(
      surveyRouter.offers.getOffers,
      {},
      { context: ctx }
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      provider: "cpx",
      type: "survey",
    });
  });

  it("returns mock offers for anonymous users", async () => {
    const guestUser = {
      id: "guest-1",
      isAnonymous: true,
      username: "guest",
    };
    const ctx = mockContext({ user: guestUser as never });

    const result = await call(
      surveyRouter.offers.getOffers,
      {},
      { context: ctx }
    );

    expect(result).toHaveLength(2);
  });

  it("respects the limit parameter", async () => {
    const ctx = mockContext();

    const result = await call(
      surveyRouter.offers.getOffers,
      { limit: 1 },
      { context: ctx }
    );

    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// survey.rapidoPostback
// ---------------------------------------------------------------------------
describe("survey.rapidoPostback", () => {
  it("throws BAD_REQUEST when RAPIDO_API_KEY is not configured", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        surveyRouter.rapidoPostback,
        { endUserId: "user-1", status: "COMPLETE" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Rapido not configured",
    });
  });
});

// ---------------------------------------------------------------------------
// survey.theoremPostback
// ---------------------------------------------------------------------------
describe("survey.theoremPostback", () => {
  it("throws BAD_REQUEST when THEOREM_API_KEY is not configured", async () => {
    const payload = createFakePayload();
    const ctx = mockContext({ payload });

    const error = await expectError(
      call(
        surveyRouter.theoremPostback,
        { reward: 100, user_id: "user-1", tx_id: "tx-1" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Theorem not configured",
    });
  });
});
