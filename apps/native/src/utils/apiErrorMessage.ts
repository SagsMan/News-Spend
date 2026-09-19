/**
 * Extracts a message safe to show the user from an oRPC error.
 *
 * Server messages are only surfaced for codes we raise deliberately with
 * user-facing copy: a content-filter rejection, a rate limit, a permission
 * problem. Everything else falls back to the caller's generic wording, so an
 * internal error can never leak a stack detail or a database message into a
 * toast.
 */
const USER_FACING_CODES = new Set([
  "BAD_REQUEST",
  "FORBIDDEN",
  "TOO_MANY_REQUESTS",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
]);

const USER_FACING_STATUSES = new Set([400, 403, 409, 413, 429]);

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const { code, status, message } = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };

  const isUserFacing =
    (typeof code === "string" && USER_FACING_CODES.has(code)) ||
    (typeof status === "number" && USER_FACING_STATUSES.has(status));

  if (!isUserFacing || typeof message !== "string") {
    return fallback;
  }

  const trimmed = message.trim();

  // oRPC falls back to the code itself when no message was supplied
  // ("BAD_REQUEST"), which is not something to show a reader.
  if (!trimmed || trimmed === code || /^[A-Z_]+$/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
