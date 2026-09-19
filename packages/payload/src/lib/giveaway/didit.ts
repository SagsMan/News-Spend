/**
 * Didit identity verification client.
 *
 * Verification gates DELIVERY, never the claim. Claiming is what stops the
 * fourteen-day clock, so a winner who cannot finish verification in time must
 * not lose a prize they legitimately won.
 *
 * NOT YET EXERCISED AGAINST THE LIVE API. The shapes here come from Didit's
 * own reference implementation (didit-protocol/didit-full-demo) rather than
 * from a call we have made, so the first run against real credentials should
 * be watched rather than trusted.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_BASE_URL = "https://verification.didit.me";

/** How far a webhook's own timestamp may be from now before it is refused. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Didit's decision values. `Approved` is the only one that releases a prize:
 * everything else either needs more time or needs a person.
 */
export const DIDIT_APPROVED = "Approved";
export const DIDIT_DECLINED = "Declined";
export const DIDIT_IN_REVIEW = "In Review";
export const DIDIT_STATUSES = [
  "Not Started",
  "In Progress",
  DIDIT_IN_REVIEW,
  DIDIT_APPROVED,
  DIDIT_DECLINED,
  "Abandoned",
  "Expired",
] as const;

export type DiditStatus = (typeof DIDIT_STATUSES)[number];

export type DiditConfig = {
  apiKey: string;
  workflowId: string;
  webhookSecret: string;
  baseUrl: string;
  /** Where Didit sends the user once they finish. */
  callbackUrl?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

export type DiditSession = {
  sessionId: string;
  /** The hosted flow to send the user to, for the web fallback. */
  url: string;
  /**
   * The token the React Native SDK's `startVerification` takes.
   *
   * The app is deliberately given a token rather than a workflow id. The SDK
   * can create its own session from a workflow id plus a `vendorData` string,
   * but `vendorData` is what we attribute the approval to: letting the client
   * choose it would let somebody pass another person's user id and have the
   * verification land on that account. Created here, it comes from the
   * authenticated session and the app never sees a value it could change.
   */
  token: string | null;
};

export class DiditError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
    /** Whether trying again could plausibly succeed. */
    public retryable: boolean
  ) {
    super(message);
    this.name = "DiditError";
  }
}

export function diditConfigFromEnv(): DiditConfig | null {
  const apiKey = process.env.DIDIT_API_KEY;
  const workflowId = process.env.DIDIT_WORKFLOW_ID;
  const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET;

  // All three or nothing. A half-configured provider is worse than an absent
  // one: sessions would start and no decision could ever be trusted back.
  if (!(apiKey && workflowId && webhookSecret)) {
    return null;
  }

  return {
    apiKey,
    workflowId,
    webhookSecret,
    baseUrl: process.env.DIDIT_BASE_URL || DEFAULT_BASE_URL,
    callbackUrl: process.env.DIDIT_CALLBACK_URL,
  };
}

/**
 * Whether a real verification provider is wired up.
 *
 * The prize catalogue asks this before letting an administrator require
 * verification on a prize, so the checkbox cannot quietly route winners into a
 * flow that does not exist.
 */
export function isIdentityProviderConfigured(): boolean {
  return diditConfigFromEnv() !== null;
}

export class DiditClient {
  private readonly config: DiditConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: DiditConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Open a verification session for one user.
   *
   * `vendor_data` carries our own user id, which is what lets the webhook
   * attribute a decision without trusting anything the user typed. Didit
   * echoes it back untouched.
   */
  async createSession(userId: string): Promise<DiditSession> {
    const response = await this.fetchImpl(
      `${this.config.baseUrl}/v3/session/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
        },
        body: JSON.stringify({
          workflow_id: this.config.workflowId,
          vendor_data: userId,
          ...(this.config.callbackUrl
            ? { callback: this.config.callbackUrl }
            : {}),
        }),
      }
    );

    const body = (await response.json().catch(() => null)) as Record<
      string,
      any
    > | null;

    // Didit answers 201, not 200, on success.
    if (!(response.status === 201 && body)) {
      const message =
        body?.message ??
        body?.error ??
        body?.detail ??
        `Didit session request failed (${response.status})`;
      throw new DiditError(
        typeof message === "string" ? message : JSON.stringify(message),
        response.status,
        body,
        response.status >= 500 || response.status === 429
      );
    }

    const sessionId = body.session_id ?? body.sessionId;
    // The demo reads the hosted flow straight off the response; the field is
    // `url` there and `session_url` in the written docs, so accept either
    // rather than hand the caller an undefined to open.
    const url = body.url ?? body.session_url;

    if (!(sessionId && url)) {
      throw new DiditError(
        "Didit returned a session without an id or url",
        response.status,
        body,
        false
      );
    }

    // Which field carries the SDK token is not something we have seen a real
    // response confirm, so every plausible spelling is checked and a missing
    // one is reported as null rather than guessed at. The caller falls back to
    // the hosted url, which the reference implementation does confirm.
    const token =
      body.session_token ??
      body.token ??
      body.client_token ??
      body.sessionToken;

    return {
      sessionId: String(sessionId),
      url: String(url),
      token: token ? String(token) : null,
    };
  }

  /** The current decision for a session, for reconciling a missed webhook. */
  async retrieveSession(
    sessionId: string
  ): Promise<{ status: string; vendorData: string | null }> {
    const response = await this.fetchImpl(
      `${this.config.baseUrl}/v3/session/${sessionId}/decision/`,
      { headers: { "X-API-Key": this.config.apiKey } }
    );

    const body = (await response.json().catch(() => null)) as Record<
      string,
      any
    > | null;

    if (!(response.ok && body)) {
      throw new DiditError(
        `Could not retrieve Didit session ${sessionId}`,
        response.status,
        body,
        response.status >= 500 || response.status === 429
      );
    }

    return {
      status: String(body.status ?? ""),
      vendorData: body.vendor_data ? String(body.vendor_data) : null,
    };
  }
}

/** Constant-time compare of two hex digests of possibly differing length. */
function hexEquals(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf-8").digest("hex");
}

export type DiditWebhookHeaders = {
  "x-signature"?: string | null;
  "x-signature-v2"?: string | null;
  "x-signature-simple"?: string | null;
};

/**
 * Whether a webhook genuinely came from Didit.
 *
 * Didit sends three signatures. We check the `simple` one, which is computed
 * over four named fields rather than over the JSON body. The other two hash
 * a re-encoded body, and any difference in float formatting or key order
 * between their serialiser and ours makes a valid webhook look forged. Since
 * the fields it covers (`session_id`, `status`, `created_at`) are exactly the
 * ones we act on, nothing we trust is left unsigned by checking only this one.
 *
 * The timestamp is checked too: a signature stays valid forever otherwise, so
 * a captured "Approved" webhook could be replayed to verify someone later.
 */
export function verifyWebhookSignature(
  body: Record<string, any>,
  headers: DiditWebhookHeaders,
  secret: string,
  now: number = Math.floor(Date.now() / 1000)
): boolean {
  const timestamp = Number(body?.created_at);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const simple = headers["x-signature-simple"];

  if (!simple) {
    return false;
  }

  const canonical = [
    String(body.timestamp ?? ""),
    String(body.session_id ?? ""),
    String(body.status ?? ""),
    String(body.webhook_type ?? ""),
  ].join(":");

  try {
    return hexEquals(hmac(secret, canonical), simple);
  } catch {
    // A malformed hex signature throws rather than mismatching.
    return false;
  }
}
