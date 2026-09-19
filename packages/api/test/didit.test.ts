import { afterEach, describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  DiditClient,
  DiditError,
  diditConfigFromEnv,
  isIdentityProviderConfigured,
  verifyWebhookSignature,
} from "@news-spend-media/payload/lib/giveaway/didit";

const SECRET = "whsec_test";

/** Build a webhook body plus the `simple` signature Didit would send. */
function signedWebhook({
  sessionId = "sess_1",
  status = "Approved",
  vendorData = "user-1",
  createdAt = Math.floor(Date.now() / 1000),
  webhookType = "status.updated",
  secret = SECRET,
}: Partial<{
  sessionId: string;
  status: string;
  vendorData: string;
  createdAt: number;
  webhookType: string;
  secret: string;
}> = {}) {
  const body = {
    session_id: sessionId,
    status,
    vendor_data: vendorData,
    created_at: createdAt,
    timestamp: createdAt,
    webhook_type: webhookType,
  };
  const canonical = [
    String(body.timestamp),
    body.session_id,
    body.status,
    body.webhook_type,
  ].join(":");
  const signature = createHmac("sha256", secret)
    .update(canonical, "utf-8")
    .digest("hex");

  return { body, headers: { "x-signature-simple": signature } };
}

const ENV_KEYS = [
  "DIDIT_API_KEY",
  "DIDIT_WORKFLOW_ID",
  "DIDIT_WEBHOOK_SECRET",
  "DIDIT_BASE_URL",
  "DIDIT_CALLBACK_URL",
];
const saved = new Map(ENV_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("diditConfigFromEnv", () => {
  it("is null when nothing is configured", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    expect(diditConfigFromEnv()).toBeNull();
    expect(isIdentityProviderConfigured()).toBe(false);
  });

  it("is null when only some of the credentials are present", () => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
    process.env.DIDIT_API_KEY = "key";
    process.env.DIDIT_WORKFLOW_ID = "wf";
    // Webhook secret missing: sessions could start but no decision could ever
    // be trusted back, which is worse than being switched off.
    expect(diditConfigFromEnv()).toBeNull();
  });

  it("is configured when all three credentials are present", () => {
    process.env.DIDIT_API_KEY = "key";
    process.env.DIDIT_WORKFLOW_ID = "wf";
    process.env.DIDIT_WEBHOOK_SECRET = SECRET;
    delete process.env.DIDIT_BASE_URL;

    const config = diditConfigFromEnv();

    expect(config?.apiKey).toBe("key");
    expect(config?.baseUrl).toBe("https://verification.didit.me");
    expect(isIdentityProviderConfigured()).toBe(true);
  });
});

describe("DiditClient.createSession", () => {
  const base = {
    apiKey: "key",
    workflowId: "wf",
    webhookSecret: SECRET,
    baseUrl: "https://verification.test",
  };

  it("sends the workflow and our user id, and returns the hosted url", async () => {
    const calls: any[] = [];
    const client = new DiditClient({
      ...base,
      callbackUrl: "https://app.test/done",
      fetchImpl: (async (url: string, init: any) => {
        calls.push({ url, init });
        return {
          status: 201,
          ok: true,
          json: async () => ({ session_id: "sess_9", url: "https://ver/9" }),
        };
      }) as any,
    });

    const session = await client.createSession("user-42");

    expect(session).toEqual({
      sessionId: "sess_9",
      url: "https://ver/9",
      token: null,
    });
    expect(calls[0].url).toBe("https://verification.test/v3/session/");
    expect(calls[0].init.headers["X-API-Key"]).toBe("key");

    const sent = JSON.parse(calls[0].init.body);
    // vendor_data is what lets the webhook attribute a decision without
    // trusting anything the user typed.
    expect(sent.vendor_data).toBe("user-42");
    expect(sent.workflow_id).toBe("wf");
    expect(sent.callback).toBe("https://app.test/done");
  });

  it("accepts session_url as well as url", async () => {
    const client = new DiditClient({
      ...base,
      fetchImpl: (async () => ({
        status: 201,
        ok: true,
        json: async () => ({ session_id: "s", session_url: "https://ver/s" }),
      })) as any,
    });

    expect((await client.createSession("u")).url).toBe("https://ver/s");
  });

  it("picks up the SDK session token when one is returned", async () => {
    const client = new DiditClient({
      ...base,
      fetchImpl: (async () => ({
        status: 201,
        ok: true,
        json: async () => ({
          session_id: "s",
          url: "https://ver/s",
          session_token: "tok_abc",
        }),
      })) as any,
    });

    // The token is what the app's SDK is handed, so the client never gets to
    // choose whose verification this is.
    expect((await client.createSession("u")).token).toBe("tok_abc");
  });

  it("treats a 200 as a failure, since Didit answers 201", async () => {
    const client = new DiditClient({
      ...base,
      fetchImpl: (async () => ({
        status: 200,
        ok: true,
        json: async () => ({ message: "unexpected" }),
      })) as any,
    });

    await expect(client.createSession("u")).rejects.toThrow(DiditError);
  });

  it("marks a 5xx retryable and a 4xx not", async () => {
    const make = (status: number) =>
      new DiditClient({
        ...base,
        fetchImpl: (async () => ({
          status,
          ok: false,
          json: async () => ({ message: "nope" }),
        })) as any,
      });

    await expect(make(503).createSession("u")).rejects.toMatchObject({
      retryable: true,
    });
    await expect(make(400).createSession("u")).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("refuses a session that has no url to send the user to", async () => {
    const client = new DiditClient({
      ...base,
      fetchImpl: (async () => ({
        status: 201,
        ok: true,
        json: async () => ({ session_id: "s" }),
      })) as any,
    });

    await expect(client.createSession("u")).rejects.toThrow(/without an id/);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a genuine webhook", () => {
    const { body, headers } = signedWebhook();
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(true);
  });

  it("rejects one signed with a different secret", () => {
    const { body, headers } = signedWebhook({ secret: "wrong" });
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(false);
  });

  it("rejects a tampered status", () => {
    const { body, headers } = signedWebhook({ status: "Declined" });
    // Someone flipping Declined to Approved in transit is exactly the attack
    // the signature exists to stop.
    const forged = { ...body, status: "Approved" };
    expect(verifyWebhookSignature(forged, headers, SECRET)).toBe(false);
  });

  it("rejects a tampered session id", () => {
    const { body, headers } = signedWebhook();
    const forged = { ...body, session_id: "someone-elses-session" };
    expect(verifyWebhookSignature(forged, headers, SECRET)).toBe(false);
  });

  it("rejects a replayed webhook", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const { body, headers } = signedWebhook({ createdAt: old });
    // Correctly signed, but an hour stale: without this a captured "Approved"
    // could be replayed to verify somebody else later.
    expect(verifyWebhookSignature(body, headers, SECRET)).toBe(false);
  });

  it("accepts one just inside the tolerance window", () => {
    const now = Math.floor(Date.now() / 1000);
    const { body, headers } = signedWebhook({ createdAt: now - 299 });
    expect(verifyWebhookSignature(body, headers, SECRET, now)).toBe(true);
  });

  it("rejects a webhook with no signature header at all", () => {
    const { body } = signedWebhook();
    expect(verifyWebhookSignature(body, {}, SECRET)).toBe(false);
  });

  it("rejects a webhook with no timestamp", () => {
    const { body, headers } = signedWebhook();
    const { created_at, ...withoutTimestamp } = body as any;
    expect(verifyWebhookSignature(withoutTimestamp, headers, SECRET)).toBe(
      false
    );
  });

  it("rejects a malformed signature without throwing", () => {
    const { body } = signedWebhook();
    expect(
      verifyWebhookSignature(body, { "x-signature-simple": "zzzz" }, SECRET)
    ).toBe(false);
  });
});
