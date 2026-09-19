import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

/**
 * Lazy-initialized Resend client. Deferred to first property access so
 * Next.js builds don't crash when RESEND_API_KEY is absent from the build
 * environment (the key is only required at runtime when emails are sent).
 */
export const resend = new Proxy({} as Resend, {
  get(_target, prop, _receiver) {
    return Reflect.get(getResend(), prop, getResend());
  },
});

export const DEFAULT_FROM_EMAIL = `News Spend Media <${process.env.SMTP_USER_FROM ?? "noreply@mail.newsspend.com"}>`;
