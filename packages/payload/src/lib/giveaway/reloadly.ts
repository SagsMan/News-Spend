/**
 * Reloadly top-ups client (spec 15).
 *
 * Only the airtime/data product is covered. Reloadly scopes an access token to
 * one product (a token minted for gift cards is rejected by the top-ups API
 * and vice versa), so adding gift cards later means a second audience and a
 * second cached token, not another call on this client.
 */

const AUTH_URL = "https://auth.reloadly.com/oauth/token";

/**
 * The audience decides which environment the call lands in, and therefore
 * whether a top-up is simulated or actually sends airtime to a real phone.
 * It is derived from one env var so the two can never disagree.
 */
const HOSTS = {
  sandbox: "https://topups-sandbox.reloadly.com",
  live: "https://topups.reloadly.com",
} as const;

export type ReloadlyEnv = keyof typeof HOSTS;

/** Reloadly versions its API through Accept, not the URL. */
const ACCEPT = "application/com.reloadly.topups-v1+json";

/** Refresh a little before expiry so a call never races the clock. */
const TOKEN_SKEW_MS = 60_000;

export type ReloadlyConfig = {
  clientId: string;
  clientSecret: string;
  env: ReloadlyEnv;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

export type Operator = {
  operatorId: number;
  name: string;
  denominationType: "RANGE" | "FIXED";
  supportsLocalAmounts: boolean;
  localMinAmount: number | null;
  localMaxAmount: number | null;
  localFixedAmounts: number[] | null;
};

/**
 * An operator's purchasable denominations.
 *
 * `localFixedAmountsDescriptions` is keyed by the amount as a string and holds
 * the operator's own wording for what that denomination buys ("2.5GB 2-day").
 * For data bundles the amount alone is meaningless to whoever is picking one,
 * since ₦600 buys a different bundle on every network.
 */
export type OperatorProducts = {
  operatorId: number;
  operatorName: string;
  denominationType: "RANGE" | "FIXED";
  supportsLocalAmounts: boolean;
  localMinAmount: number | null;
  localMaxAmount: number | null;
  localFixedAmounts: number[] | null;
  localFixedAmountsDescriptions?: Record<string, string> | null;
};

export type TopupResult = {
  transactionId: number;
  status: string;
  operatorName: string;
  deliveredAmount: number | null;
  deliveredCurrency: string | null;
};

/**
 * Reloadly's wording when a `customIdentifier` has been seen before.
 *
 * It answers with 400, which is otherwise a permanent failure, but here it
 * means the opposite of failure: the top-up already went out. Matched on the
 * message because Reloadly does not give it a distinct code.
 */
const DUPLICATE_IDENTIFIER =
  /custom identifier provided has already been used/i;

export class ReloadlyError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
    /**
     * Whether trying again could plausibly succeed. A 5xx or a network fault
     * is worth another attempt; a rejected phone number never will be, and
     * retrying it just burns the schedule.
     */
    public retryable: boolean
  ) {
    super(message);
    this.name = "ReloadlyError";
  }

  /**
   * Whether this error means "already sent" rather than "did not send".
   *
   * The case that matters: a run that succeeds at Reloadly and then dies
   * before recording it. The retry sends the same identifier, Reloadly
   * refuses it, and treating that as a failure would either strand the prize
   * or (if the identifier were regenerated) pay the winner twice.
   */
  get isAlreadySent(): boolean {
    return this.status === 400 && DUPLICATE_IDENTIFIER.test(this.message);
  }
}

export function reloadlyConfigFromEnv(): ReloadlyConfig | null {
  const clientId = process.env.RELOADLY_CLIENT_ID;
  const clientSecret = process.env.RELOADLY_CLIENT_SECRET;

  if (!(clientId && clientSecret)) {
    return null;
  }

  // Defaulting to sandbox is the safe direction: a missing or misspelt value
  // simulates a payout rather than spending real money.
  const env: ReloadlyEnv =
    process.env.RELOADLY_ENV === "live" ? "live" : "sandbox";

  return { clientId, clientSecret, env };
}

export class ReloadlyClient {
  private readonly config: ReloadlyConfig;
  private readonly fetchImpl: typeof fetch;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: ReloadlyConfig) {
    this.config = config;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get host() {
    return HOSTS[this.config.env];
  }

  get isSandbox() {
    return this.config.env === "sandbox";
  }

  /**
   * A bearer token for the top-ups product, cached until shortly before it
   * expires. Minting one per payout would triple the request count of a batch
   * and rate-limit the run for no benefit.
   */
  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.value;
    }

    const response = await this.fetchImpl(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: "client_credentials",
        audience: this.host,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;

    if (!(response.ok && body?.access_token)) {
      throw new ReloadlyError(
        "Could not authenticate with Reloadly",
        response.status,
        body,
        response.status >= 500
      );
    }

    this.token = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - TOKEN_SKEW_MS,
    };

    return this.token.value;
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const token = await this.accessToken();

    const response = await this.fetchImpl(`${this.host}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: ACCEPT,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        (body as { message?: string } | null)?.message ??
        `Reloadly request failed (${response.status})`;

      // 4xx means the request itself is wrong (a bad number, an amount the
      // operator will not accept) and will fail identically forever.
      throw new ReloadlyError(
        message,
        response.status,
        body,
        response.status >= 500 || response.status === 429
      );
    }

    return body as T;
  }

  /**
   * Which network a phone number belongs to.
   *
   * Used rather than asking the winner, because a number's network is a fact
   * about the number and people port between networks without noticing.
   */
  detectOperator(phone: string, countryCode: string): Promise<Operator> {
    const digits = phone.replace(/\D/g, "");
    return this.request<Operator>(
      `/operators/auto-detect/phone/${digits}/countries/${countryCode}`
    );
  }

  getOperator(operatorId: number): Promise<Operator> {
    return this.request<Operator>(`/operators/${operatorId}`);
  }

  /**
   * Get available denominations/products for an operator.
   * Returns the operator details including available fixed amounts.
   */
  getOperatorProducts(operatorId: number): Promise<OperatorProducts> {
    return this.request<OperatorProducts>(`/operators/${operatorId}`);
  }

  /**
   * Send a top-up.
   *
   * `customIdentifier` carries the winner id, which is what makes this safe to
   * retry: Reloadly treats a repeated identifier as the same transaction, so a
   * run that fails after sending but before recording cannot pay twice.
   *
   * Amounts are sent as local currency. The account is denominated elsewhere
   * (CAD, on this one), and converting a ₦500 prize into the account currency
   * would leave the winner receiving whatever the exchange rate produced
   * rather than the ₦500 they were promised.
   */
  topup(args: {
    operatorId: number;
    localAmount: number;
    phone: string;
    countryCode: string;
    customIdentifier: string;
  }): Promise<TopupResult> {
    return this.request<TopupResult>("/topups", {
      method: "POST",
      body: {
        operatorId: args.operatorId,
        amount: args.localAmount,
        useLocalAmount: true,
        customIdentifier: args.customIdentifier,
        recipientPhone: {
          countryCode: args.countryCode,
          number: args.phone.replace(/\D/g, ""),
        },
      },
    });
  }
}
