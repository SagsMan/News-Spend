# @news-spend-media/mail

Email sending service for News Spend Media using Resend and React Email templates.

## Features

- 📧 **Type-safe email sending** with Resend
- 🎨 **React Email templates** from `@news-spend-media/transactional`
- 📝 **Logging** with `@news-spend-media/logger`
- 🔒 **Environment-based configuration**
- ⏰ **Scheduled sending** support (welcome emails)

## Installation

This package is already part of the monorepo. To use it in another package:

```json
{
  "dependencies": {
    "@news-spend-media/mail": "workspace:*"
  }
}
```

## Environment Variables

Add these to your `.env` file:

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx
SMTP_USER_FROM=noreply@newsspend.com
APP_URL=https://newsspend.com
```

## Usage

### Send Welcome Email

```ts
import { sendWelcomeEmail } from "@news-spend-media/mail";

// Sends welcome email with 1 minute delay
await sendWelcomeEmail("user@example.com", "johndoe");
```

### Send Password Reset Email

```ts
import { sendPasswordResetEmail } from "@news-spend-media/mail";

// token is the reset token, email is the recipient
await sendPasswordResetEmail("reset-token-here", "user@example.com");
```

### Send OTP Verification Email

```ts
import { sendOTPVerificationEmail } from "@news-spend-media/mail";

await sendOTPVerificationEmail("user@example.com", "1234");
```

## API Reference

### `sendWelcomeEmail(to: string, username: string)`

Sends a welcome email to new users. Email is scheduled to send in 1 minute.

- **to** - Recipient email address
- **username** - User's username for personalization
- **Returns** - Promise that resolves when email is scheduled

### `sendPasswordResetEmail(token: string, email: string)`

Sends a password reset email with a secure link.

- **token** - Unique reset token
- **email** - Recipient email address
- **Link format** - `APP_URL/change-password/{token}`
- **Returns** - Promise that resolves when email is sent

### `sendOTPVerificationEmail(to: string, otp: string)`

Sends an email with a one-time password for account verification.

- **to** - Recipient email address
- **otp** - One-time password code (usually 4-6 digits)
- **Returns** - Promise that resolves when email is sent

## Email Templates Used

This package uses email templates from `@news-spend-media/transactional`:

- **AccountVerificationEmail** (`accountOtpVerification.tsx`) - OTP verification
- **WelcomeEmail** (`welcome.tsx`) - Welcome new users
- **ForgotPasswordEmail** (`forgot-password.tsx`) - Password reset

## Error Handling

All email functions log errors using `@news-spend-media/logger` and throw on failure:

```ts
import { sendWelcomeEmail } from "@news-spend-media/mail";
import logger from "@news-spend-media/logger";

try {
  await sendWelcomeEmail("user@example.com", "john");
} catch (error) {
  logger.error({ error }, "Failed to send welcome email");
  // Handle error (e.g., retry, alert, etc.)
}
```

**Note:** `sendWelcomeEmail` catches errors internally and only logs them (doesn't throw).

## Integration Example: Auth Package

Here's how to use this package in your Better Auth configuration:

```ts
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOTPVerificationEmail,
} from "@news-spend-media/mail";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword(data) {
      return sendPasswordResetEmail(data.token, data.user.email);
    },
  },
  plugins: [
    emailOTP({
      otpLength: 4,
      expiresIn: 60 * 60 * 1000, // 1 hour
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "email-verification") {
          await sendOTPVerificationEmail(email, otp);
        }
      },
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/email-otp/verify-email")) {
        const newSession = ctx.context.newSession;
        if (newSession) {
          // Send welcome email (scheduled for 1 min later)
          sendWelcomeEmail(newSession.user.email, newSession.user.username);
        }
      }
    }),
  },
});
```

## Using Resend Client Directly

For advanced use cases, you can import the Resend client directly:

```ts
import { resend, DEFAULT_FROM_EMAIL } from "@news-spend-media/mail";
import { render } from "@react-email/components";
import CustomEmail from "@news-spend-media/transactional/emails/custom";

const html = await render(CustomEmail({ prop: "value" }));

await resend.emails.send({
  from: DEFAULT_FROM_EMAIL,
  to: "user@example.com",
  subject: "Custom Email",
  html,
});
```

## Architecture

```
packages/
├── transactional/        # Email templates (React components)
│   └── emails/
│       ├── welcome.tsx
│       ├── forgot-password.tsx
│       └── accountOtpVerification.tsx
│
└── mail/                 # Email sending service (this package)
    └── src/
        ├── client.ts     # Resend client setup
        ├── service.ts    # Email sending functions
        └── index.ts      # Exports
```

## Benefits of This Architecture

1. **Separation of Concerns**
   - Templates (`transactional`) - pure React components
   - Sending logic (`mail`) - integrates with Resend

2. **Reusability**
   - Any package can import and use email functions
   - No circular dependencies

3. **Type Safety**
   - Full TypeScript support
   - Props validated at compile time

4. **Observability**
   - All emails are logged with structured logging
   - Easy to track email delivery

## Development

```bash
# Run example (update with your email)
cd packages/mail
bun example.ts

# Preview templates (from transactional package)
cd packages/transactional
bun dev
```

## Troubleshooting

### Email not sending

1. Check that `RESEND_API_KEY` is set correctly
2. Verify `SMTP_USER_FROM` is a valid email address
3. Check logs for error messages
4. Ensure you have verified your domain in Resend

### Welcome email not received

Welcome emails are scheduled to send in 1 minute. Check:

1. Resend dashboard for scheduled emails
2. Logs for any errors
3. Recipient's spam folder

### Password reset link not working

Ensure `APP_URL` is set correctly in your environment variables. The reset link format is:

```
{APP_URL}/change-password/{token}
```

## Related Packages

- [`@news-spend-media/transactional`](../transactional) - Email templates
- [`@news-spend-media/logger`](../logger) - Logging utilities

## Documentation

- [Resend Documentation](https://resend.com/docs)
- [React Email Documentation](https://react.email)
- [Better Auth Documentation](https://better-auth.com)
