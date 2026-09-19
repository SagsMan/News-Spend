import { randomUUID } from "node:crypto";

import { expo } from "@better-auth/expo";
import logger from "@news-spend-media/logger";
import {
  sendAccountDeletedEmail,
  sendOTPVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@news-spend-media/mail";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { anonymous, emailOTP, openAPI } from "better-auth/plugins";
import pg from "pg";
import z from "zod";
import type { $ZodIssue } from "zod/v4/core";

function generateUniqueDigits() {
  // Create an array of digits from 0 to 9
  const digits = Array.from({ length: 10 }, (_, i) => i);

  // Shuffle the array
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = digits[i];
    if (temp !== undefined && digits[j] !== undefined) {
      digits[i] = digits[j];
      digits[j] = temp;
    }
  }

  // Select the first 10 digits
  return digits.slice(0, 10).join("");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URI,
});

export const auth = betterAuth({
  user: {
    modelName: "users",
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        // Send account deletion confirmation email
        sendAccountDeletedEmail(user.email, user.name).catch((e) => {
          logger.error({ err: e }, "Failed to send account deletion email");
        });

        // Clean up push tokens
        await pool.query("DELETE FROM push_tokens WHERE user_id = $1", [
          user.id,
        ]);

        // Clean up activities
        await pool.query("DELETE FROM activities WHERE user_id = $1", [
          user.id,
        ]);
      },
    },
    fields: {
      email: "email",
      name: "name",
      updatedAt: "updated_at",
      createdAt: "created_at",
      emailVerified: "_verified",
      image: "image",
    },
    additionalFields: {
      /**
       * Read-only to the client. Age gates giveaway participation, so this is
       * written once by `account.setDateOfBirth` and corrected only by an
       * administrator. A birth date its holder can rewrite is not a check.
       */
      dateOfBirth: {
        fieldName: "date_of_birth",
        type: "date",
        required: false,
        input: false,
      },
      wish: {
        type: "string",
        required: true,
      },
      /**
       * No longer collected at sign-up (App Store guideline 5.1.1(v): a
       * required field the app does not need). The DB column is still
       * NOT NULL, so `databaseHooks.user.create.before` defaults it to "".
       * Kept here, read-only, so existing numbers stay visible to admins.
       */
      phone: {
        type: "string",
        required: false,
        input: false,
      },
      username: {
        type: "string",
        required: true,
        unique: true,
      },
      user_id: {
        type: "string",
        required: true,
        unique: true,
        defaultValue: generateUniqueDigits(),
      },
      notificationPreferences: {
        fieldName: "notification_preferences",
        type: "string",
        required: true,
        defaultValue: JSON.stringify({
          types: {
            BREAKING_NEWS: true,
            NEWS: true,
            COMMENT: true,
            EARNING_OPPORTUNITY: true,
            MISC: true,
          },
        }),
      },
      dailyRead: {
        fieldName: "daily_read",
        type: "string",
        required: true,
        defaultValue: JSON.stringify({
          count: 0,
          updatedAt: new Date(),
        }),
      },
    },
  },
  verification: {
    modelName: "verifications",
    fields: {
      expiresAt: "expires_at",
      updatedAt: "updated_at",
      createdAt: "created_at",
    },
  },
  account: {
    modelName: "accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      password: "password",
      refreshToken: "refresh_token",
      accessToken: "access_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      scope: "scope",
      updatedAt: "updated_at",
      createdAt: "created_at",
    },
  },
  session: {
    modelName: "sessions",
    fields: {
      expiresAt: "expires_at",
      userId: "user_id",
      userAgent: "user_agent",
      ipAddress: "ip_address",
      token: "token",
      updatedAt: "updated_at",
      createdAt: "created_at",
    },
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      maxAge: 30 * 60, // 30 minutes
      enabled: true,
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/email-otp/verify-email")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          // Guard against awarding welcome points more than once.
          // A user can call verify-email multiple times (e.g. OTP re-request)
          // so we must check before inserting.
          const existing = await pool.query(
            "SELECT id FROM activities WHERE user_id = $1 AND action = $2 LIMIT 1",
            [newSession.user.id, "signUp"]
          );

          if (!existing.rows.length) {
            await pool.query(
              "INSERT INTO activities (action, description, point, user_id, type, id) VALUES ($1, $2, $3, $4, $5, $6)",
              [
                "signUp",
                "Reward for signing up",
                "500",
                newSession.user.id,
                "point",
                randomUUID(),
              ]
            );
            sendWelcomeEmail(newSession.user.email, newSession.user.name);
          }
        }
      }

      if (ctx.path.startsWith("/sign-out")) {
        // delete user push token if exist
        const pushToken = ctx.body?.pushToken;
        if (pushToken) {
          pool
            .query("DELETE FROM push_tokens WHERE token = $1", [pushToken])
            .catch((e) => {
              logger.error({ err: e }, "Failed to delete push token");
            });
        }
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up/email")) {
        const user = ctx.body;

        const [usernameResult, emailResult] = await Promise.all([
          pool.query("SELECT * FROM users WHERE username = $1", [
            user.username,
          ]),
          pool.query("SELECT * FROM users WHERE email = $1", [user.email]),
        ]);

        const validationIssues: z.core.$ZodIssue[] = [];

        if (usernameResult.rows.length) {
          validationIssues.push({
            code: "custom",
            message: "Username already exists",
            path: ["username"],
            input: user.username,
          });
        }

        if (emailResult.rows.length) {
          validationIssues.push({
            code: "custom",
            message: "Email already exists",
            path: ["email"],
            input: user.email,
          });
        }

        if (validationIssues.length > 0) {
          throw new APIError("CONFLICT", {
            message: "Validation failed",
            cause: new z.ZodError(validationIssues),
            issues: new z.ZodError(validationIssues).issues,
            code: "VALIDATION_FAILED",
          });
        }
      }

      if (ctx.path.startsWith("/sign-in/anonymous")) {
      }
    }),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: true,
    sendResetPassword(data) {
      return sendPasswordResetEmail(data.token, data.user.email);
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          console.log(user);

          // Phone is no longer collected at sign-up, but the column is still
          // NOT NULL. Default it for every user, not just anonymous ones.
          if (!user.phone) {
            user.phone = "";
          }

          // Handle anonymous users - set default values for required fields
          if (user.isAnonymous) {
            const randomId = Math.random().toString(36).substring(2, 10);

            // Generate unique username for anonymous users
            if (!user.username) {
              user.username = `guest_${randomId}`;
            }

            // Set default values for required fields
            if (!user.phone) {
              user.phone = "";
            }

            if (!user.wish) {
              user.wish = "";
            }

            if (!user.name) {
              user.name = `Guest_${randomId}`;
            }
          }

          // check if username or email exist
          const customErr: $ZodIssue[] = [];

          const usernameExist = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [user.username]
          );

          if (usernameExist.rows.length) {
            customErr.push({
              code: "custom",
              message: "Username already exist",
              path: ["username"],
              input: user?.username ?? "",
            });
          }

          if (customErr.length) {
            throw customErr;
          }

          while (
            await pool
              .query("SELECT * FROM users WHERE user_id = $1", [user.user_id])
              .then((res) => res.rows.length)
          ) {
            user.user_id = generateUniqueDigits();
          }

          return {
            data: user,
          };
        },
      },
      update: {},
    },
  },
  database: pool,
  plugins: [
    expo(),
    anonymous({
      schema: {
        user: {
          fields: {
            isAnonymous: "is_anonymous",
          },
        },
      },
    }),
    emailOTP({
      otpLength: 4,
      expiresIn: 60 * 60 * 1000, // 1 hour
      sendVerificationOnSignUp: true,
      disableSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification") {
          await sendOTPVerificationEmail(email, otp);
        }
      },
    }),
    openAPI(),
  ],
  trustedOrigins: [process.env.CORS_ORIGIN ?? ""],
});

export type AuthType = typeof auth;

export type Session = typeof auth.$Infer.Session;
