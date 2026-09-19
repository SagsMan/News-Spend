import { beforeEach, describe, expect, it, mock } from "bun:test";
import { call } from "@orpc/server";

import { createFakePayload, expectError, mockContext } from "../test-utils";
import { accountRouter } from "./account";

// Module mock for @news-spend-media/auth: updateProfile calls auth.api.updateUser
const updateUserMock = mock(
  (args: Record<string, Record<string, unknown>>) => ({
    id: "user-1",
    username: args.body?.username as string,
  })
);

mock.module("@news-spend-media/auth", () => ({
  auth: { api: { updateUser: updateUserMock } },
}));

const authedUser = { id: "user-1", isAnonymous: false, username: "tester" };
const guestUser = { id: "guest-1", isAnonymous: true, username: "guest" };

beforeEach(() => {
  updateUserMock.mockClear();
});

// ---------------------------------------------------------------------------
// changePassword
// ---------------------------------------------------------------------------
describe("accountRouter.changePassword", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(
        accountRouter.changePassword,
        { oldPassword: "oldpass", newPassword: "newpass" },
        { context: mockContext() }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a guest caller", async () => {
    const error = await expectError(
      call(
        accountRouter.changePassword,
        { oldPassword: "oldpass", newPassword: "newpass" },
        { context: mockContext({ user: guestUser as never }) }
      )
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Guest users cannot perform this action",
    });
  });

  it("throws NOT_FOUND when the user does not exist", async () => {
    const payload = createFakePayload({ collections: { users: [] } });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        accountRouter.changePassword,
        { oldPassword: "oldpass", newPassword: "newpass" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });

  it("returns success when the user exists", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      accountRouter.changePassword,
      { oldPassword: "oldpass", newPassword: "newpass" },
      { context: ctx }
    );

    expect(result).toEqual({
      success: true,
      message: "Password changed successfully",
    });
  });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------
describe("accountRouter.updateProfile", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(
        accountRouter.updateProfile,
        { username: "newname" },
        { context: mockContext() }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a guest caller", async () => {
    const error = await expectError(
      call(
        accountRouter.updateProfile,
        { username: "newname" },
        { context: mockContext({ user: guestUser as never }) }
      )
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Guest users cannot perform this action",
    });
  });

  it("throws NOT_FOUND when the user does not exist", async () => {
    const payload = createFakePayload({ collections: { users: [] } });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        accountRouter.updateProfile,
        { username: "newname" },
        { context: ctx }
      )
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });

  it("rejects a duplicate username with INPUT_VALIDATION_FAILED", async () => {
    const payload = createFakePayload({
      collections: {
        users: [
          { id: "user-1", username: "tester" },
          { id: "user-2", username: "taken" },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(accountRouter.updateProfile, { username: "taken" }, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "INPUT_VALIDATION_FAILED",
      message: "Invalid input",
    });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("excludes username from the update body when unchanged (case-insensitive)", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1", username: "Tester" }] },
    });
    const ctx = mockContext({
      user: authedUser as never,
      payload,
      headers: new Headers(),
    });

    await call(
      accountRouter.updateProfile,
      { username: "  tester  ", name: "New Name" },
      { context: ctx }
    );

    expect(updateUserMock).toHaveBeenCalledTimes(1);
    const callArgs = updateUserMock.mock.calls[0] as unknown as [
      Record<string, Record<string, unknown>>,
    ];
    // username is NOT included because "Tester".toLowerCase().trim() === "tester"
    expect(callArgs[0].body).not.toHaveProperty("username");
    expect(callArgs[0].body).toMatchObject({ name: "New Name" });
  });

  it("includes username in the update body when changed", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1", username: "oldname" }] },
    });
    const ctx = mockContext({
      user: authedUser as never,
      payload,
      headers: new Headers(),
    });

    await call(
      accountRouter.updateProfile,
      { username: "brandnew" },
      { context: ctx }
    );

    const callArgs = updateUserMock.mock.calls[0] as unknown as [
      Record<string, Record<string, unknown>>,
    ];
    expect(callArgs[0].body).toMatchObject({ username: "brandnew" });
  });
});

// ---------------------------------------------------------------------------
// createPushToken
// ---------------------------------------------------------------------------
describe("accountRouter.createPushToken", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(
        accountRouter.createPushToken,
        { token: "tok-1", deviceType: "ios" },
        { context: mockContext() }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("allows a guest caller", async () => {
    const payload = createFakePayload({ collections: { "push-tokens": [] } });
    const ctx = mockContext({ user: guestUser as never, payload });

    const result = await call(
      accountRouter.createPushToken,
      { token: "tok-1", deviceType: "android" },
      { context: ctx }
    );

    expect(payload.docs("push-tokens")).toHaveLength(1);
    expect(result).toMatchObject({
      token: "tok-1",
      deviceType: "android",
      status: "active",
    });
  });

  it("creates a new push token when none exists", async () => {
    const payload = createFakePayload({ collections: { "push-tokens": [] } });
    const ctx = mockContext({ user: authedUser as never, payload });

    await call(
      accountRouter.createPushToken,
      {
        token: "tok-new",
        deviceType: "ios",
        deviceModel: "iPhone 15",
        deviceName: "My Phone",
      },
      { context: ctx }
    );

    expect(payload.docs("push-tokens")).toHaveLength(1);
    expect(payload.docs("push-tokens")[0]).toMatchObject({
      token: "tok-new",
      user: "user-1",
      deviceType: "ios",
      status: "active",
      deviceModel: "iPhone 15",
      deviceName: "My Phone",
    });
    // create was called, not update
    expect(
      payload.calls.some(
        (c) => c.op === "create" && c.collection === "push-tokens"
      )
    ).toBe(true);
    expect(
      payload.calls.some(
        (c) => c.op === "update" && c.collection === "push-tokens"
      )
    ).toBe(false);
  });

  it("updates an existing push token when one matches", async () => {
    const payload = createFakePayload({
      collections: {
        "push-tokens": [
          {
            id: "pt-1",
            token: "tok-existing",
            user: "user-1",
            deviceType: "android",
            status: "active",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    await call(
      accountRouter.createPushToken,
      { token: "tok-existing", deviceType: "web" },
      { context: ctx }
    );

    expect(payload.docs("push-tokens")).toHaveLength(1);
    expect(payload.docs("push-tokens")[0]).toMatchObject({
      deviceType: "web",
      status: "active",
    });
    // update was called, not create
    expect(
      payload.calls.some(
        (c) => c.op === "update" && c.collection === "push-tokens"
      )
    ).toBe(true);
    expect(
      payload.calls.filter(
        (c) => c.op === "create" && c.collection === "push-tokens"
      )
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deletePushToken
// ---------------------------------------------------------------------------
describe("accountRouter.deletePushToken", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(
        accountRouter.deletePushToken,
        { token: "tok-1" },
        { context: mockContext() }
      )
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("deletes the push token and returns success", async () => {
    const payload = createFakePayload({
      collections: {
        "push-tokens": [
          { id: "pt-1", token: "tok-del", user: "user-1", deviceType: "ios" },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(
      accountRouter.deletePushToken,
      { token: "tok-del" },
      { context: ctx }
    );

    expect(result).toEqual({ success: true, message: "Push token deleted" });
    expect(
      payload.calls.some(
        (c) => c.op === "delete" && c.collection === "push-tokens"
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// me
// ---------------------------------------------------------------------------
describe("accountRouter.me", () => {
  it("rejects an unauthenticated caller", async () => {
    const error = await expectError(
      call(accountRouter.me, undefined, { context: mockContext() })
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("throws NOT_FOUND when the user does not exist", async () => {
    const payload = createFakePayload({ collections: { users: [] } });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(accountRouter.me, undefined, { context: ctx })
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
    });
  });

  it("returns the user document", async () => {
    const userDoc = { id: "user-1", username: "tester", email: "t@e.com" };
    const payload = createFakePayload({ collections: { users: [userDoc] } });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(accountRouter.me, undefined, { context: ctx });

    expect(result).toMatchObject({ id: "user-1", username: "tester" });
  });
});

// ---------------------------------------------------------------------------
// setDateOfBirth
// ---------------------------------------------------------------------------
describe("accountRouter.setDateOfBirth", () => {
  const validDob = { dateOfBirth: "1995-06-15" };

  it("rejects a guest", async () => {
    const error = await expectError(
      call(accountRouter.setDateOfBirth, validDob, {
        context: mockContext({ user: guestUser as never }),
      })
    );

    expect(error.code).toBe("FORBIDDEN");
  });

  it("stores a date of birth when none is set", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1", username: "tester" }] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const result = await call(accountRouter.setDateOfBirth, validDob, {
      context: ctx,
    });

    expect(result.dateOfBirth).toBe("1995-06-15T00:00:00.000Z");
  });

  it("refuses to overwrite one already on record", async () => {
    const payload = createFakePayload({
      collections: {
        users: [
          {
            id: "user-1",
            username: "tester",
            dateOfBirth: "2010-01-01T00:00:00.000Z",
          },
        ],
      },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(accountRouter.setDateOfBirth, validDob, { context: ctx })
    );

    // Write-once is the whole point: a birth date its holder can rewrite is
    // not an age check, it is a prompt they answer again after being refused.
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toMatch(/already on record/);
  });

  it("stores an under-age date rather than refusing it", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1", username: "tester" }] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const recent = new Date();
    recent.setFullYear(recent.getFullYear() - 12);
    const dateOfBirth = recent.toISOString().slice(0, 10);

    // Refusing here would let someone retry until a date was accepted, which
    // teaches them the threshold and leaves nothing on record. The purchase
    // gate is what refuses them, consistently, until the date itself changes.
    const result = await call(
      accountRouter.setDateOfBirth,
      { dateOfBirth },
      { context: ctx }
    );

    expect(result.dateOfBirth).toStartWith(dateOfBirth);
  });

  it("rejects a future date", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        accountRouter.setDateOfBirth,
        { dateOfBirth: "2099-01-01" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toMatch(/cannot be in the future/);
  });

  it("rejects an implausibly old date", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1" }] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    const error = await expectError(
      call(
        accountRouter.setDateOfBirth,
        { dateOfBirth: "1850-01-01" },
        { context: ctx }
      )
    );

    expect(error.code).toBe("BAD_REQUEST");
  });

  it("rejects a malformed date", async () => {
    const ctx = mockContext({ user: authedUser as never });

    await expect(
      call(
        accountRouter.setDateOfBirth,
        { dateOfBirth: "15/06/1995" },
        { context: ctx }
      )
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateProfile: protected fields
// ---------------------------------------------------------------------------
describe("accountRouter.updateProfile protected fields", () => {
  it("silently drops dateOfBirth and verifiedCountry", async () => {
    const payload = createFakePayload({
      collections: { users: [{ id: "user-1", username: "tester" }] },
    });
    const ctx = mockContext({ user: authedUser as never, payload });

    await call(
      accountRouter.updateProfile,
      {
        username: "tester",
        name: "Tester",
        dateOfBirth: "2010-01-01",
        verifiedCountry: "GB",
      } as never,
      { context: ctx }
    );

    // The input is a catchall, so without the guard these would flow straight
    // through to the user record and defeat both the age gate and the
    // verified-country check.
    const body = updateUserMock.mock.calls[0]?.[0]?.body as Record<
      string,
      unknown
    >;
    expect(body).toBeDefined();
    expect(body.dateOfBirth).toBeUndefined();
    expect(body.verifiedCountry).toBeUndefined();
    expect(body.name).toBe("Tester");
  });
});
