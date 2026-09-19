import logger from "@news-spend-media/logger";
import { AccountDeletedEmail } from "@news-spend-media/transactional/emails/account-deleted";
import NewsSpendVerificationEmail from "@news-spend-media/transactional/emails/accountOtpVerification";
import { ForgotPasswordEmail } from "@news-spend-media/transactional/emails/forgot-password";
import { WelcomeEmail } from "@news-spend-media/transactional/emails/welcome";
import { render } from "@react-email/render";

import { DEFAULT_FROM_EMAIL, resend } from "./client";

export async function sendOTPVerificationEmail(to: string, otp: string) {
  try {
    const html = await render(<NewsSpendVerificationEmail otp={otp} />);

    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject: "Verify your News Spend Media account",
      html,
    });
    logger.info({ to }, "OTP verification email sent successfully");
  } catch (error) {
    logger.error({ error, to }, "Failed to send OTP verification email");
    throw error;
  }
}

export async function sendWelcomeEmail(to: string, username: string) {
  try {
    const html = await render(<WelcomeEmail username={username} />);
    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject: "Welcome to News-Spend Media – Where Dreams Come to Life!",
      html,
      scheduledAt: "in 1 min",
    });
    logger.info({ to }, "Welcome email sent successfully");
  } catch (error) {
    logger.error({ error, to }, "Failed to send welcome email");
  }
}

export async function sendPasswordResetEmail(token: string, email: string) {
  try {
    const resetLink = `${process.env.APP_URL}/change-password/${token}`;
    const html = await render(<ForgotPasswordEmail resetLink={resetLink} />);

    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to: email,
      subject: "Reset Your Password",
      html,
    });
    logger.info({ email }, "Password reset email sent successfully");
  } catch (error) {
    console.error({ error, email });
    logger.error({ error, email }, "Failed to send password reset email");
  }
}

export async function sendAccountDeletedEmail(to: string, username: string) {
  try {
    const html = await render(<AccountDeletedEmail username={username} />);
    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject: "Your News-Spend Media Account Has Been Deleted",
      html,
    });
    logger.info(
      { to },
      "Account deletion confirmation email sent successfully"
    );
  } catch (error) {
    logger.error({ error, to }, "Failed to send account deletion email");
  }
}

type WitnessReportEmailParams = {
  name: string;
  title: string;
  description?: string | null;
  reportType?: string | null;
};

export async function sendWitnessReportEmail(
  to: string | string[],
  params: WitnessReportEmailParams
) {
  try {
    const { name, title, description, reportType } = params;

    const typeLabel =
      reportType === "shortMessage"
        ? "Short Message"
        : reportType === "video"
          ? "Video"
          : reportType === "picture"
            ? "Picture"
            : "N/A";

    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject: `New iWitness Report: ${title}`,
      html: `<div style="font-family: system-ui, sans-serif; max-width: 480px;">
  <h2 style="color: #1a1a2e;">New iWitness Report</h2>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px 0; color: #666;">Reporter</td><td><strong>${name}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Title</td><td><strong>${title}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Type</td><td>${typeLabel}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Time</td><td>${new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" })}</td></tr>
  </table>
  ${description ? `<p style="color: #444; margin: 8px 0;"><strong>Description:</strong><br/>${description}</p>` : ""}
  <p style="color: #666;">Review this in the <strong>Witness Reports</strong> section of the admin panel.</p>
  <p style="color: #999; font-size: 12px; margin-top: 16px;">News Spend Media: iWitness</p>
</div>`,
    });
    logger.info({ to, title, name }, "Witness report email sent successfully");
  } catch (error) {
    logger.error(
      { error, to, title: params.title },
      "Failed to send witness report email"
    );
  }
}

type ContentReportEmailParams = {
  blockedById: string;
  blockedByUsername: string;
  blockedUserId: string;
  blockedUsername: string;
};

export async function sendContentReportEmail(
  to: string,
  params: ContentReportEmailParams
) {
  try {
    const { blockedById, blockedByUsername, blockedUserId, blockedUsername } =
      params;

    await resend.emails.send({
      from: DEFAULT_FROM_EMAIL,
      to,
      subject: "User blocked: moderation required",
      html: `<div style="font-family: system-ui, sans-serif; max-width: 480px;">
  <h2 style="color: #1a1a2e;">A user has been blocked on News Spend Media</h2>
  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 8px 0; color: #666;">Blocked by</td><td><strong>@${blockedByUsername}</strong> (${blockedById})</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Blocked user</td><td><strong>@${blockedUsername}</strong> (${blockedUserId})</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Time</td><td>${new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" })}</td></tr>
  </table>
  <p style="color: #666;">Review this in the <strong>Content Reports</strong> section of the admin panel.</p>
</div>`,
    });
    logger.info(
      { to, blockedById, blockedUserId },
      "Content report email sent successfully"
    );
  } catch (error) {
    logger.error(
      { error, to, blockedById: params.blockedById },
      "Failed to send content report email"
    );
  }
}

type WinnerReportEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  attachment: { filename: string; content: string };
};

/**
 * Email a giveaway Winner Report with its CSV attached (spec 21).
 *
 * Unlike the other senders here, this one rethrows. The caller keeps a
 * delivery log and retries, so it has to be able to tell a send that worked
 * from one that did not. Swallowing the error would record a success that
 * never happened.
 */
export async function sendGiveawayWinnerReport(
  params: WinnerReportEmailParams
): Promise<{ id: string | null }> {
  const { to, subject, html, attachment } = params;

  const { data, error } = await resend.emails.send({
    from: DEFAULT_FROM_EMAIL,
    to,
    subject,
    html,
    attachments: [
      {
        filename: attachment.filename,
        content: Buffer.from(attachment.content, "utf-8").toString("base64"),
      },
    ],
  });

  if (error) {
    logger.error({ error, to, subject }, "Failed to send winner report email");
    throw new Error(error.message ?? "Winner report email failed to send");
  }

  logger.info({ to, subject, id: data?.id }, "Winner report email sent");
  return { id: data?.id ?? null };
}
