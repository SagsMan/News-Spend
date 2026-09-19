import { getPayload } from "@news-spend-media/payload";
import {
  diditConfigFromEnv,
  verifyWebhookSignature,
} from "@news-spend-media/payload/lib/giveaway/didit";
import { recordDecision } from "@news-spend-media/payload/lib/giveaway/verification";

/**
 * Didit's verification webhook (spec 16).
 *
 * This endpoint is unauthenticated in the usual sense: Didit has no session
 * with us, so the HMAC signature is the ONLY thing standing between a forged
 * request and a released prize. Nothing is read out of the body before the
 * signature has been checked.
 *
 * Status codes matter more than usual here. A sender that gets a non-2xx will
 * retry, so 2xx is returned for anything we have finished dealing with, even
 * when the answer is "this means nothing to us". Only a failed signature gets
 * 401, and only a genuine server fault gets 5xx: those are the two cases
 * where a retry is the right behaviour.
 */
export async function diditWebhookHandler(req: Request): Promise<Response> {
  const config = diditConfigFromEnv();

  if (!config) {
    // Nothing is configured, so nothing can be verified. Accepting the request
    // would be pretending; 503 lets the provider retry once we are wired up.
    return json({ message: "Verification is not configured" }, 503);
  }

  if (req.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }

  const raw = await req.text();
  let body: Record<string, any>;

  try {
    body = JSON.parse(raw);
  } catch {
    return json({ message: "Invalid JSON" }, 400);
  }

  const valid = verifyWebhookSignature(
    body,
    {
      "x-signature": req.headers.get("x-signature"),
      "x-signature-v2": req.headers.get("x-signature-v2"),
      "x-signature-simple": req.headers.get("x-signature-simple"),
    },
    config.webhookSecret
  );

  if (!valid) {
    return json({ message: "Unauthorized" }, 401);
  }

  const sessionId = body.session_id ? String(body.session_id) : null;
  const status = body.status ? String(body.status) : null;
  // We put our own user id in `vendor_data` when the session was created, and
  // the signature covers the session id it arrived with, so this is the one
  // identity in the payload we are entitled to trust.
  const userId = body.vendor_data ? String(body.vendor_data) : null;

  if (!(sessionId && status && userId)) {
    // Signed, but not something we can act on. Acknowledged so it stops being
    // retried; logged so it is not simply lost.
    return json({ message: "Nothing to do", acknowledged: true }, 200);
  }

  try {
    const payload = await getPayload();
    const { released, unknownUser } = await recordDecision(payload, {
      sessionId,
      userId,
      status,
    });

    if (unknownUser) {
      // Genuine webhook, but for nobody we have. Retrying cannot fix that, so
      // it is acknowledged rather than left to redeliver indefinitely.
      return json({ message: "Unknown user", acknowledged: true }, 200);
    }

    payload.logger.info(
      { sessionId, status, userId, released },
      "[verification] decision recorded"
    );

    return json({ message: "Processed", released }, 200);
  } catch (error) {
    // A real fault on our side. 5xx so Didit retries rather than dropping a
    // decision somebody is waiting on.
    console.error("[verification] webhook failed", error);
    return json({ message: "Could not process the decision" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
