import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { diditWebhookHandler } from "../src/router/verification/webhook";

const SECRET = "whsec_test";

function request({
  sessionId = "sess_1",
  status = "Approved",
  vendorData = "user-1",
  createdAt = Math.floor(Date.now() / 1000),
  webhookType = "status.updated",
  secret = SECRET,
  signature,
  method = "POST",
}: Partial<{
  sessionId: string;
  status: string;
  vendorData: string;
  createdAt: number;
  webhookType: string;
  secret: string;
  signature: string;
  method: string;
}> = {}) {
  const body = {
    session_id: sessionId,
    status,
    vendor_data: vendorData,
    created_at: createdAt,
    timestamp: createdAt,
    webhook_type: webhookType,
  };
  const canonical = [createdAt, sessionId, status, webhookType].join(":");
  const sig =
    signature ??
    createHmac("sha256", secret).update(canonical, "utf-8").digest("hex");

  return new Request("http://x/api/verification/didit", {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-signature-simple": sig,
    },
    body: JSON.stringify(body),
  });
}

const saved = {
  key: process.env.DIDIT_API_KEY,
  wf: process.env.DIDIT_WORKFLOW_ID,
  secret: process.env.DIDIT_WEBHOOK_SECRET,
};

beforeEach(() => {
  process.env.DIDIT_API_KEY = "key";
  process.env.DIDIT_WORKFLOW_ID = "wf";
  process.env.DIDIT_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  for (const [k, v] of [
    ["DIDIT_API_KEY", saved.key],
    ["DIDIT_WORKFLOW_ID", saved.wf],
    ["DIDIT_WEBHOOK_SECRET", saved.secret],
  ] as const) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
});

describe("diditWebhookHandler", () => {
  it("rejects a forged signature with 401", async () => {
    const res = await diditWebhookHandler(
      request({ signature: "a".repeat(64) })
    );
    // The signature is the only thing between a forged request and a released
    // prize, so this must never fall through to processing.
    expect(res.status).toBe(401);
  });

  it("rejects a webhook signed with the wrong secret", async () => {
    const res = await diditWebhookHandler(request({ secret: "not-ours" }));
    expect(res.status).toBe(401);
  });

  it("rejects a replayed webhook even though it is correctly signed", async () => {
    const res = await diditWebhookHandler(
      request({ createdAt: Math.floor(Date.now() / 1000) - 3600 })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a status flipped in transit", async () => {
    // Sign "Declined", then send "Approved" with that signature.
    const createdAt = Math.floor(Date.now() / 1000);
    const canonical = ["sess_1", "Declined", "status.updated"];
    const sig = createHmac("sha256", SECRET)
      .update([createdAt, ...canonical].join(":"), "utf-8")
      .digest("hex");

    const res = await diditWebhookHandler(
      request({ status: "Approved", createdAt, signature: sig })
    );

    expect(res.status).toBe(401);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await diditWebhookHandler(
      new Request("http://x/api/verification/didit", {
        method: "POST",
        headers: { "x-signature-simple": "ab" },
        body: "{not json",
      })
    );
    expect(res.status).toBe(400);
  });

  it("refuses anything but POST", async () => {
    const res = await diditWebhookHandler(request({ method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("answers 503 when no provider is configured", async () => {
    delete process.env.DIDIT_WEBHOOK_SECRET;
    const res = await diditWebhookHandler(request());
    // Not 200: accepting it would be pretending we had processed a decision.
    expect(res.status).toBe(503);
  });
});
