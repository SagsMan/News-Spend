import { auth } from "@news-spend-media/auth";
import { openapi } from "@orpc/openapi";
import z from "zod";

import { protectedNoGuestProcedure, protectedProcedure } from "..";

const changePassword = protectedNoGuestProcedure
  .input(
    z.object({
      oldPassword: z.string().min(6).max(100),
      newPassword: z.string().min(6).max(100),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { user, payload } = context;
    const { oldPassword, newPassword } = input;

    const userCheck = await payload.findByID({
      collection: "users",
      id: user.id,
    });

    if (!userCheck) {
      throw errors.NOT_FOUND({
        message: "User not found",
      });
    }

    return {
      success: true,
      message: "Password changed successfully",
    };
  });

/**
 * Fields this endpoint must never write, whatever the client sends.
 *
 * The input is a `catchall`, so anything extra flows straight through to the
 * user record. That is fine for ordinary profile fields and wrong for these:
 * a date of birth the holder can edit is not an age check, it is a formality
 * someone re-types after being refused, and a self-asserted verified country
 * would defeat the point of verifying it.
 */
const PROTECTED_PROFILE_FIELDS = ["dateOfBirth", "verifiedCountry"] as const;

const updateProfile = protectedNoGuestProcedure
  .input(
    z
      .object({
        username: z.string().min(3).max(30),
        name: z.string().optional(),
      })
      .catchall(z.any())
  )
  .handler(async ({ input, context, errors }) => {
    const {
      payload,
      user: { id: userId },
    } = context;
    const customErr: z.core.$ZodIssue[] = [];

    const { username, ...passthrough } = input;
    const rest = { ...passthrough };
    for (const field of PROTECTED_PROFILE_FIELDS) {
      delete rest[field];
    }

    const user = await payload.findByID({
      collection: "users",
      id: userId,
    });

    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found",
      });
    }

    const usernameExist = await payload.count({
      collection: "users",
      where: {
        username: {
          equals: username,
        },
        id: {
          not_in: [userId],
        },
      },
    });

    if (usernameExist.totalDocs > 0) {
      customErr.push({
        code: "custom",
        path: ["username"],
        message: "Username already exists",
      });
    }

    const zodError = new z.ZodError(customErr);

    if (customErr.length > 0) {
      throw errors.INPUT_VALIDATION_FAILED({
        message: "Invalid input",
        cause: zodError,
        data: z.flattenError(zodError),
      });
    }

    // const nameFormatted = input.name
    //   ?.split(" ")
    //   .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    //   .join(" ");

    console.log(input.name);

    const userUpdate = await auth.api.updateUser({
      headers: context.headers,
      body: {
        ...rest,
        name: input.name,
        ...(user?.username?.toLowerCase().trim() ===
        username?.toLowerCase().trim()
          ? {}
          : { username }),
      },
    });

    return userUpdate;
  });

/**
 * The oldest birth date worth accepting. Anything earlier is a typo, not a
 * user.
 */
const MAX_PLAUSIBLE_AGE_YEARS = 120;

export const SetDateOfBirthInput = z.object({
  /** `YYYY-MM-DD`. A calendar day, deliberately not a timestamp. */
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker to choose a date."),
});

/**
 * Record a date of birth, once.
 *
 * Write-once by design. Age gates giveaway participation, so a birth date the
 * holder can rewrite is not a check; it is a prompt someone answers again
 * after being refused. A genuine mistype is a support correction, made by an
 * administrator in the CMS, the same way a bank does not let you edit your
 * own date of birth after it has been used for anything.
 *
 * This deliberately does not reject an under-age date. Refusing to store it
 * would let someone retry until they found a date that was accepted, which
 * teaches them the threshold and leaves nothing on record. Storing it means
 * the age gate at purchase can refuse them consistently, and keep refusing
 * them, until the date itself makes them eligible.
 */
const setDateOfBirth = protectedNoGuestProcedure
  .input(SetDateOfBirthInput)
  .handler(async ({ input, context, errors }) => {
    const {
      payload,
      user: { id: userId },
    } = context;

    const parsed = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw errors.BAD_REQUEST({ message: "That is not a real date." });
    }

    const now = new Date();
    const oldest = new Date(now);
    oldest.setUTCFullYear(oldest.getUTCFullYear() - MAX_PLAUSIBLE_AGE_YEARS);

    if (parsed > now) {
      throw errors.BAD_REQUEST({
        message: "A date of birth cannot be in the future.",
      });
    }

    if (parsed < oldest) {
      throw errors.BAD_REQUEST({
        message: "Please check the year. That date is not plausible.",
      });
    }

    const user = await payload.findByID({ collection: "users", id: userId });

    if (!user) {
      throw errors.NOT_FOUND({ message: "User not found" });
    }

    if (user.dateOfBirth) {
      throw errors.CONFLICT({
        message:
          "Your date of birth is already on record and cannot be changed here. Contact support if it is wrong.",
      });
    }

    await payload.update({
      collection: "users",
      id: userId,
      data: { dateOfBirth: parsed.toISOString() },
    });

    return { dateOfBirth: parsed.toISOString() };
  });

const createPushToken = protectedProcedure
  .input(
    z.object({
      token: z.string(),
      deviceType: z.enum(["ios", "android", "web"]),
      deviceModel: z.string().optional(),
      deviceName: z.string().optional(),
      /**
       * Which build this device is running.
       *
       * Was accepted nowhere and written as `""`, so every token on record
       * had a blank version. That is fine until a server change stops being
       * backwards compatible, at which point "how many users are on a build
       * older than X" is the only question that matters and there is no way
       * to answer it. Optional so an older client that does not send it still
       * registers.
       */
      appVersion: z.string().max(32).optional(),
      osVersion: z.string().max(32).optional(),
    })
  )
  .handler(async ({ input, context }) => {
    const { payload, user } = context;
    const {
      token,
      deviceType,
      deviceModel,
      deviceName,
      appVersion,
      osVersion,
    } = input;

    const pushToken = await payload.find({
      collection: "push-tokens",
      where: {
        token: {
          equals: token,
        },
      },
      limit: 1,
    });

    if (pushToken.totalDocs > 0) {
      return await payload.update({
        collection: "push-tokens",
        where: {
          token: {
            equals: token,
          },
        },
        data: {
          user: user.id,
          deviceType,
          status: "active",
          appVersion: appVersion ?? "",
          osVersion: osVersion ?? undefined,
          deviceModel,
          deviceName,
        },
      });
    }
    return await payload.create({
      collection: "push-tokens",
      data: {
        token,
        user: user.id,
        deviceType,
        status: "active",
        appVersion: appVersion ?? "",
        osVersion: osVersion ?? undefined,
        deviceModel,
        deviceName,
      },
    });
  });

const deletePushToken = protectedProcedure
  .meta(
    openapi({
      method: "POST",
      path: "/account/delete-push-token",
      summary: "Delete push token",
      tags: ["account"],
    })
  )
  .input(
    z.object({
      token: z.string().optional(),
    })
  )
  .handler(async ({ input, context }) => {
    const { payload } = context;
    await payload.delete({
      collection: "push-tokens",
      where: {
        token: {
          equals: input.token,
        },
      },
    });

    return {
      success: true,
      message: "Push token deleted",
    };
  });

const me = protectedProcedure.handler(async ({ context, errors }) => {
  const {
    payload,
    user: { id: userId },
  } = context;
  const user = await payload.findByID({
    collection: "users",
    id: userId,
  });

  if (!user) {
    throw errors.NOT_FOUND({
      message: "User not found",
    });
  }

  return user;
});

export const accountRouter = {
  updateProfile,
  setDateOfBirth,
  changePassword,
  createPushToken,
  deletePushToken,
  me,
};
