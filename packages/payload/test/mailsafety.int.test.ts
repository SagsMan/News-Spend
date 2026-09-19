import { expect, test } from "bun:test";

/**
 * Proves the last line of defence: if a test ever bypasses the injected
 * reportSender, the send must fail loudly rather than reach a real inbox.
 */
test("a winner-report send with the stubbed key throws", async () => {
  process.env.RESEND_API_KEY = "re_test_not_a_real_key";
  process.env.SMTP_USER_FROM = "test@example.invalid";

  const { sendGiveawayWinnerReport } = await import("@news-spend-media/mail");

  await expect(
    sendGiveawayWinnerReport({
      to: "nobody@example.invalid",
      subject: "should never arrive",
      html: "<p>x</p>",
      attachment: { filename: "x.csv", content: "a,b\n1,2\n" },
    })
  ).rejects.toThrow();
}, 60_000);
