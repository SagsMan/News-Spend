import {
  ReloadlyClient,
  reloadlyConfigFromEnv,
} from "@news-spend-media/payload/lib/giveaway/reloadly";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdmin } from "../../../../_lib/requireAdmin";

/**
 * GET /api/reloadly/operators/:operatorId/products
 *
 * Fetch available products/denominations for a Reloadly operator.
 * Used by the Prize Catalogue admin UI to dynamically show available amounts.
 *
 * Admin-only. This route lives outside the `(payload)` group, so Payload runs
 * no access control of its own here — without the guard below it was an
 * unauthenticated proxy onto our Reloadly account, and every call minted a
 * fresh OAuth token, so one request to us was two to the provider.
 */

/**
 * One client for the process, so its cached bearer token is actually reused.
 *
 * `ReloadlyClient` caches the token on the instance until shortly before it
 * expires, which a per-request `new ReloadlyClient()` threw away every time —
 * turning each products lookup into an `/oauth/token` round trip as well.
 * Rebuilt only if the credentials change under us.
 */
let cachedClient: { client: ReloadlyClient; key: string } | null = null;

function getClient(config: ReturnType<typeof reloadlyConfigFromEnv> & object) {
  const key = `${config.clientId}:${config.env}`;
  if (cachedClient?.key !== key) {
    cachedClient = { client: new ReloadlyClient(config), key };
  }
  return cachedClient.client;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ operatorId: string }> }
) {
  const denied = await requireAdmin(req.headers);
  if (denied) {
    return denied;
  }

  const { operatorId } = await params;

  if (!operatorId || Number.isNaN(Number(operatorId))) {
    return NextResponse.json({ error: "Invalid operator ID" }, { status: 400 });
  }

  const config = reloadlyConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      {
        error: "Reloadly is not configured",
      },
      { status: 503 }
    );
  }

  try {
    const client = getClient(config);
    const products = await client.getOperatorProducts(Number(operatorId));

    return NextResponse.json(products);
  } catch (err) {
    /**
     * Pass Reloadly's own error code through.
     *
     * `ReloadlyError` already carries the provider's response body, but only
     * `message` was returned, so every auth failure read as the same generic
     * "Could not authenticate with Reloadly". That cannot distinguish a wrong
     * secret from the right secret used against the wrong environment — the
     * production account had sandbox credentials with `RELOADLY_ENV=live`, and
     * the `INVALID_CREDENTIALS` that would have named it was discarded here.
     */
    const reloadlyErr = err as {
      message?: string;
      status?: number;
      body?: { errorCode?: string; message?: string } | null;
    };
    const body = reloadlyErr.body;

    return NextResponse.json(
      {
        error: reloadlyErr.message || "Failed to fetch operator products",
        ...(body?.errorCode ? { errorCode: body.errorCode } : {}),
        ...(body?.message ? { providerMessage: body.message } : {}),
      },
      { status: reloadlyErr.status ?? 500 }
    );
  }
}
