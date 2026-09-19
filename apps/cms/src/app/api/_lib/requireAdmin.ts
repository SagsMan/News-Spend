import { getPayload } from "@news-spend-media/payload";
import { NextResponse } from "next/server";

/**
 * Guards a plain Next route handler behind an authenticated admin session.
 *
 * Routes under `app/api/*` sit outside the `(payload)` group, so none of
 * Payload's own access control runs for them: a handler there is reachable by
 * anyone who knows the path. Anything that spends money, burns a third-party
 * quota, or uses the server as an egress needs this in front of it.
 *
 * Returns a `NextResponse` to return as-is when the caller is not an admin,
 * or `null` when the request may proceed.
 */
export async function requireAdmin(
  headers: Headers
): Promise<NextResponse | null> {
  try {
    const payload = await getPayload();
    const { user } = await payload.auth({ headers });

    // `user.collection` distinguishes an admin from an app user: both
    // authenticate against the same Payload instance, and only `admins`
    // belongs in the CMS panel.
    if (user?.collection !== "admins") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return null;
  } catch {
    // A failure to establish identity is not a licence to proceed.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
