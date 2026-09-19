import { describe, expect, it } from "bun:test";
import { call } from "@orpc/server";

import { createFakePayload, expectError, mockContext } from "../test-utils";
import { notificationSettingsRouter } from "./notificationSettings";

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };
const guestUser = { id: "guest-1", isAnonymous: true, username: "guest" };

function contextFor(
  user: typeof authedUser | typeof guestUser,
  prefs?: unknown
) {
  const payload = createFakePayload({
    collections: {
      users: [{ id: user.id, notificationPreferences: prefs }],
    },
  });
  return { ctx: mockContext({ user: user as never, payload }), payload };
}

describe("notificationSettings.get", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(notificationSettingsRouter.get, undefined, {
        context: mockContext(),
      })
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a guest caller", async () => {
    const { ctx } = contextFor(guestUser);

    const error = await expectError(
      call(notificationSettingsRouter.get, undefined, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Guest users cannot perform this action",
    });
  });

  it("returns null when the user has no preferences yet", async () => {
    const { ctx } = contextFor(authedUser);

    expect(
      await call(notificationSettingsRouter.get, undefined, { context: ctx })
    ).toBe(null);
  });

  it("returns the stored preferences", async () => {
    const prefs = { types: { NEWS: true } };
    const { ctx } = contextFor(authedUser, prefs);

    expect(
      await call(notificationSettingsRouter.get, undefined, { context: ctx })
    ).toEqual(prefs);
  });
});

describe("notificationSettings.update", () => {
  it("merges the new type into the existing preferences", async () => {
    const { ctx, payload } = contextFor(authedUser, {
      pushEnabled: true,
      types: { NEWS: true, COMMENT: true },
    });

    await call(
      notificationSettingsRouter.update,
      { notification_type: "COMMENT", enabled: false },
      { context: ctx }
    );

    expect(payload.docs("users")[0]?.notificationPreferences).toEqual({
      pushEnabled: true,
      types: { NEWS: true, COMMENT: false },
    });
  });

  it("creates the types map when the user has no preferences", async () => {
    const { ctx, payload } = contextFor(authedUser);

    const result = await call(
      notificationSettingsRouter.update,
      { notification_type: "BREAKING_NEWS", enabled: true },
      { context: ctx }
    );

    expect(result).toMatchObject({
      notificationPreferences: { types: { BREAKING_NEWS: true } },
    });
    expect(payload.docs("users")[0]?.notificationPreferences).toEqual({
      types: { BREAKING_NEWS: true },
    });
  });

  it("rejects an unknown notification type before reaching the handler", async () => {
    const { ctx, payload } = contextFor(authedUser);

    const error = await expectError(
      call(
        notificationSettingsRouter.update,
        { notification_type: "SOMETHING_ELSE", enabled: true } as never,
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Input validation failed",
    });
    expect(payload.calls).toHaveLength(0);
  });
});
