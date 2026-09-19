import { describe, expect, it } from "bun:test";
import {
  ReloadlyClient,
  ReloadlyError,
  reloadlyConfigFromEnv,
} from "@news-spend-media/payload/lib/giveaway/reloadly";

type Row = Record<string, any>;

/** A fake `fetch` that answers from a queue, recording every call made. */
function fakeFetch(responses: { status: number; body: Row }[]) {
  const calls: { url: string; init: Row }[] = [];
  const queue = [...responses];

  const impl = (async (url: string, init: Row) => {
    calls.push({ url, init });
    const next = queue.shift() ?? responses.at(-1);
    return {
      ok: (next?.status ?? 200) < 300,
      status: next?.status ?? 200,
      json: async () => next?.body,
    };
  }) as unknown as typeof fetch;

  return { impl, calls };
}

const TOKEN_RESPONSE = {
  status: 200,
  body: { access_token: "tok-1", expires_in: 3600 },
};

function client(responses: Row[]) {
  const { impl, calls } = fakeFetch(responses);
  return {
    client: new ReloadlyClient({
      clientId: "id",
      clientSecret: "secret",
      env: "sandbox",
      fetchImpl: impl,
    }),
    calls,
  };
}

describe("reloadlyConfigFromEnv", () => {
  it("is null without credentials", () => {
    const prev = { ...process.env };
    delete process.env.RELOADLY_CLIENT_ID;
    delete process.env.RELOADLY_CLIENT_SECRET;

    expect(reloadlyConfigFromEnv()).toBe(null);

    process.env = prev;
  });

  it("defaults to sandbox (the safe direction) on anything but 'live'", () => {
    const prev = { ...process.env };
    process.env.RELOADLY_CLIENT_ID = "id";
    process.env.RELOADLY_CLIENT_SECRET = "secret";
    process.env.RELOADLY_ENV = "production"; // a plausible typo for "live"

    expect(reloadlyConfigFromEnv()?.env).toBe("sandbox");

    process.env = prev;
  });

  it("only honours the exact value 'live'", () => {
    const prev = { ...process.env };
    process.env.RELOADLY_CLIENT_ID = "id";
    process.env.RELOADLY_CLIENT_SECRET = "secret";
    process.env.RELOADLY_ENV = "live";

    expect(reloadlyConfigFromEnv()?.env).toBe("live");

    process.env = prev;
  });
});

describe("ReloadlyClient auth", () => {
  it("caches the token across calls", async () => {
    const { client: c, calls } = client([
      TOKEN_RESPONSE,
      { status: 200, body: { operatorId: 341, name: "MTN Nigeria" } },
      { status: 200, body: { operatorId: 341, name: "MTN Nigeria" } },
    ]);

    await c.getOperator(341);
    await c.getOperator(341);

    // One auth call, however many API calls follow. Re-minting a token per
    // payout would triple the request count of a batch for nothing.
    const authCalls = calls.filter((call) => call.url.includes("oauth/token"));
    expect(authCalls).toHaveLength(1);
  });

  it("throws a retryable error when auth itself fails", async () => {
    const { client: c } = client([{ status: 503, body: { message: "down" } }]);

    const error = await c.getOperator(341).catch((e) => e);

    expect(error).toBeInstanceOf(ReloadlyError);
    expect(error.retryable).toBe(true);
  });
});

describe("ReloadlyClient.detectOperator", () => {
  it("strips non-digits before sending the phone number", async () => {
    const { client: c, calls } = client([
      TOKEN_RESPONSE,
      { status: 200, body: { operatorId: 341, name: "MTN Nigeria" } },
    ]);

    await c.detectOperator("0803-456 7890", "NG");

    const detectCall = calls.find((call) => call.url.includes("auto-detect"));
    expect(detectCall?.url).toContain("/08034567890/");
  });
});

describe("ReloadlyClient.topup", () => {
  it("sends the amount as local currency, not the account currency", async () => {
    const { client: c, calls } = client([
      TOKEN_RESPONSE,
      { status: 200, body: { transactionId: 1, operatorName: "MTN Nigeria" } },
    ]);

    await c.topup({
      operatorId: 341,
      localAmount: 500,
      phone: "08031234567",
      countryCode: "NG",
      customIdentifier: "winner-1",
    });

    const topupCall = calls.find((call) => call.url.includes("/topups"));
    const body = JSON.parse(topupCall?.init.body);

    // useLocalAmount is what stops a ₦500 prize being converted through the
    // account's own currency and arriving as whatever the exchange rate gave.
    expect(body.useLocalAmount).toBe(true);
    expect(body.amount).toBe(500);
    expect(body.customIdentifier).toBe("winner-1");
  });

  it("classifies a 5xx as retryable and a 4xx as not", async () => {
    const retryable = await client([
      TOKEN_RESPONSE,
      { status: 502, body: { message: "bad gateway" } },
    ])
      .client.topup({
        operatorId: 341,
        localAmount: 500,
        phone: "1",
        countryCode: "NG",
        customIdentifier: "a",
      })
      .catch((e) => e as ReloadlyError);

    const permanent = await client([
      TOKEN_RESPONSE,
      { status: 400, body: { message: "invalid recipient phone number" } },
    ])
      .client.topup({
        operatorId: 341,
        localAmount: 500,
        phone: "1",
        countryCode: "NG",
        customIdentifier: "a",
      })
      .catch((e) => e as ReloadlyError);

    expect(retryable.retryable).toBe(true);
    expect(permanent.retryable).toBe(false);
  });

  it("recognises Reloadly's duplicate-identifier response as already sent", async () => {
    const { client: c } = client([
      TOKEN_RESPONSE,
      {
        status: 400,
        body: {
          message:
            "The custom identifier provided has already been used. Please provide a new, unique custom identifier",
        },
      },
    ]);

    const error: ReloadlyError = await c
      .topup({
        operatorId: 341,
        localAmount: 500,
        phone: "1",
        countryCode: "NG",
        customIdentifier: "winner-1",
      })
      .catch((e) => e);

    // This is the case a retry after a mid-write crash actually hits: the
    // payout already happened, and reading this as a plain failure would
    // either strand the prize or, if retried with a fresh id, pay it twice.
    expect(error.isAlreadySent).toBe(true);
    expect(error.retryable).toBe(false);
  });

  it("does not treat an unrelated 400 as already sent", async () => {
    const { client: c } = client([
      TOKEN_RESPONSE,
      { status: 400, body: { message: "invalid recipient phone number" } },
    ]);

    const error: ReloadlyError = await c
      .topup({
        operatorId: 341,
        localAmount: 500,
        phone: "1",
        countryCode: "NG",
        customIdentifier: "winner-1",
      })
      .catch((e) => e);

    expect(error.isAlreadySent).toBe(false);
  });
});
