import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How far out of step a partner's clock may be, in seconds.
 *
 * A signature with no timestamp is valid forever, so anyone who ever sees one
 * can replay it. Five minutes is the same tolerance the identity webhook uses.
 */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type PartnerWebhookHeaders = {
  signature?: string | null;
  timestamp?: string | null;
};

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf-8").digest("hex");
}

function hexEquals(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(received, "utf-8");
  // Length must be compared separately: timingSafeEqual throws on a mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The exact string a partner signs.
 *
 * Deliberately built from the fields that decide the outcome rather than from
 * the raw body: a signature over the whole body would break the moment we
 * added an optional field, and a partner integration that breaks on our
 * deploys is one that gets disabled rather than fixed.
 *
 * The timestamp is inside the signed string, not merely alongside it.
 * Otherwise it could be rewritten freely and the replay window would mean
 * nothing.
 */
export function canonicalString(input: {
  timestamp: string;
  clickId: string;
  status: string;
}): string {
  return `${input.timestamp}:${input.clickId}:${input.status}`;
}

/**
 * Whether a conversion postback really came from the partner it claims to.
 *
 * Until this existed the endpoint took anyone's word for it. `clickId` is
 * handed to the app so it can build the redirect, so a user could read their
 * own and post it back to award themselves points and, because a conversion
 * is what records a Featured Offer (8), Tier 1 and Tier 2 eligibility. No
 * partner needed to be involved at all.
 */
export function verifyPartnerSignature({
  headers,
  secret,
  clickId,
  status,
  now = Math.floor(Date.now() / 1000),
}: {
  headers: PartnerWebhookHeaders;
  secret: string;
  clickId: string;
  status: string;
  now?: number;
}): { valid: boolean; reason?: string } {
  if (!secret) {
    return { valid: false, reason: "partner has no webhook secret" };
  }

  const signature = headers.signature?.trim();
  if (!signature) {
    return { valid: false, reason: "missing signature" };
  }

  const timestamp = headers.timestamp?.trim();
  if (!timestamp) {
    return { valid: false, reason: "missing timestamp" };
  }

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) {
    return { valid: false, reason: "malformed timestamp" };
  }

  if (Math.abs(now - sent) > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, reason: "timestamp outside the accepted window" };
  }

  const expected = hmac(
    secret,
    canonicalString({ timestamp, clickId, status })
  );

  return hexEquals(expected, signature)
    ? { valid: true }
    : { valid: false, reason: "signature does not match" };
}
