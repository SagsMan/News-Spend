const RETRYABLE_MESSAGES = [
  "fetch failed",
  "failed to fetch",
  "network request failed",
  "ssl",
  "sslhandshake",
  "handshake",
  "connection closed",
  "connection abort",
  "failed to connect",
  "connectexception",
  "econnreset",
  "econnrefused",
  "etimedout",
  "socket hang up",
  "timeout",
];

function collectMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (current.message) {
      messages.push(current.message.toLowerCase());
    }
    const cause = (current as { cause?: unknown }).cause;
    if (typeof cause === "string") {
      messages.push(cause.toLowerCase());
      break;
    }
    if (cause instanceof Error) {
      current = cause;
      continue;
    }
    break;
  }
  return messages;
}

/**
 * Check if an error is a network/SSL error that's worth retrying.
 * These are transient errors caused by unstable connections,
 * especially common on mobile networks in regions with high latency.
 *
 * Matches any Error (Hermes surfaces fetch failures as plain Error /
 * CodedError, not TypeError) and walks the `cause` chain, since oRPC
 * wraps the underlying fetch failure.
 */
export function isNetworkError(error: unknown): boolean {
  for (const message of collectMessages(error)) {
    if (RETRYABLE_MESSAGES.some((needle) => message.includes(needle))) {
      return true;
    }
  }

  // AbortSignal timeout
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  return false;
}
