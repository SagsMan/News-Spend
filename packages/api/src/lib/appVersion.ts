/**
 * The minimum app build the server will serve, and how it is compared.
 *
 * The mobile app is not deployed with the server. It ships on each user's own
 * schedule, or never, so a server change that stops being backwards compatible
 * does not break "the app" — it breaks whichever builds happen to be installed
 * that day, silently, until somebody reads the logs.
 *
 * That is what happened with the oRPC v2 upgrade: the protocol changed under
 * clients that had no way to know, and their requests simply started failing.
 * This exists so the next such change ends in "please update" rather than in
 * an unexplained 404.
 */

/** Header the app sends its native application version in. */
export const APP_VERSION_HEADER = "x-app-version";

/**
 * Off unless a floor is set.
 *
 * Deliberately opt-in: shipping the mechanism dark lets it reach users before
 * it is ever enforced, so the first release that needs a floor already has
 * clients that understand the answer. Turning it on before that would lock out
 * exactly the people it is meant to inform.
 */
export function minimumAppVersion(): string | null {
  const raw = process.env.MIN_APP_VERSION?.trim();
  return raw ? raw : null;
}

type Parsed = { major: number; minor: number; patch: number };

/**
 * Parse a marketing version. Missing parts count as zero, so "3" and "3.0.0"
 * compare equal — a store version is not always written out in full.
 */
export function parseVersion(value: string | null | undefined): Parsed | null {
  if (!value) {
    return null;
  }

  const match = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  };
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compareVersions(a: Parsed, b: Parsed): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Whether this client is too old to be served.
 *
 * An UNREADABLE OR ABSENT VERSION IS ALLOWED THROUGH. Every build shipped
 * before this header existed sends nothing, and so does every non-app caller —
 * the CMS, a webhook, a partner postback, curl. Refusing them would turn a
 * safety net into an outage, and the versions that need blocking are precisely
 * the ones that do send a version we can read.
 */
export function isBelowMinimum(
  clientVersion: string | null | undefined,
  minimum: string | null = minimumAppVersion()
): boolean {
  const floor = parseVersion(minimum);
  if (!floor) {
    return false;
  }

  const client = parseVersion(clientVersion);
  if (!client) {
    return false;
  }

  return compareVersions(client, floor) < 0;
}
