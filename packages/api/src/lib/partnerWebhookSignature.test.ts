import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";

import {
  canonicalString,
  SIGNATURE_TOLERANCE_SECONDS,
  verifyPartnerSignature,
} from "./partnerWebhookSignature";

const SECRET = "partner-secret";
const NOW = 1_800_000_000;

function sign(
  parts: { timestamp: string; clickId: string; status: string },
  secret = SECRET
) {
  return createHmac("sha256", secret)
    .update(canonicalString(parts), "utf-8")
    .digest("hex");
}

function verify(overrides: Record<string, any> = {}) {
  const timestamp = String(NOW);
  const clickId = "clk_abc";
  const status = "success";
  return verifyPartnerSignature({
    headers: {
      signature: sign({ timestamp, clickId, status }),
      timestamp,
      ...(overrides.headers ?? {}),
    },
    secret: overrides.secret ?? SECRET,
    clickId: overrides.clickId ?? clickId,
    status: overrides.status ?? status,
    now: overrides.now ?? NOW,
  });
}

describe("verifyPartnerSignature", () => {
  it("accepts a correctly signed postback", () => {
    expect(verify().valid).toBe(true);
  });

  it("rejects one with no signature at all", () => {
    // The state this endpoint shipped in: anyone holding a clickId could
    // award themselves points and Tier 1 eligibility.
    expect(verify({ headers: { signature: null } }).valid).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    const timestamp = String(NOW);
    const forged = sign(
      { timestamp, clickId: "clk_abc", status: "success" },
      "not-the-secret"
    );
    expect(verify({ headers: { signature: forged } }).valid).toBe(false);
  });

  it("rejects a signature lifted onto a different click", () => {
    // Replaying someone else's valid postback against your own click.
    expect(verify({ clickId: "clk_someone_else" }).valid).toBe(false);
  });

  it("rejects a signature reused to flip a failure into a success", () => {
    // status is inside the signed string precisely so it cannot be swapped.
    expect(verify({ status: "failed" }).valid).toBe(false);
  });

  it("rejects a stale signature", () => {
    // Without a window, one captured signature is valid forever.
    expect(verify({ now: NOW + SIGNATURE_TOLERANCE_SECONDS + 1 }).valid).toBe(
      false
    );
  });

  it("rejects a future-dated signature just as firmly", () => {
    expect(verify({ now: NOW - SIGNATURE_TOLERANCE_SECONDS - 1 }).valid).toBe(
      false
    );
  });

  it("rejects a rewritten timestamp", () => {
    // The timestamp is signed, not merely sent alongside, so moving it
    // forward to dodge the window invalidates the signature.
    expect(verify({ headers: { timestamp: String(NOW + 10) } }).valid).toBe(
      false
    );
  });

  it("refuses a partner with no secret configured rather than waving it through", () => {
    expect(verify({ secret: "" }).valid).toBe(false);
  });
});
