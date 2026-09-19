/**
 * Shared error definitions for the API layer.
 *
 * Every procedure built on `basicProcedure` and every auth/rate-limit
 * middleware declares these codes via `.errors()`. Throwing with the
 * `errors.CODE()` factory (available in handler and middleware context)
 * marks the error as defined/inferable, so clients can narrow it with
 * `isDefinedError` / `isInferableError` and react to specific codes.
 */
export const commonErrors = {
  BAD_REQUEST: { message: "Bad request" },
  UNAUTHORIZED: { message: "Unauthorized" },
  FORBIDDEN: { message: "Forbidden" },
  NOT_FOUND: { message: "Resource not found" },
  CONFLICT: { message: "Conflict" },
  TOO_MANY_REQUESTS: { message: "Too many requests", status: 429 },
  INPUT_VALIDATION_FAILED: { message: "Invalid input", status: 422 },
  /**
   * This build is older than the server will serve.
   *
   * Its own code rather than FORBIDDEN so the app can tell "you may not do
   * this" apart from "you must update to do anything", and show a blocking
   * update screen for the second. 426 is the HTTP status for exactly this.
   */
  UPGRADE_REQUIRED: {
    message: "This version of the app is no longer supported.",
    status: 426,
  },
  INTERNAL_SERVER_ERROR: { message: "Internal server error" },
};
