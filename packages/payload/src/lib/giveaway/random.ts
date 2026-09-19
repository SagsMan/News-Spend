import crypto from "node:crypto";

/**
 * Seeded random number generation for giveaway draws.
 *
 * The spec requires secure random selection (1) and a fully auditable draw
 * (17, 18). Those pull in opposite directions: `crypto.randomBytes` alone is
 * secure but leaves no way to prove after the fact that a draw was run
 * honestly. So a draw draws one seed from the CSPRNG, records it on the
 * giveaway, and derives every subsequent decision deterministically from it.
 * The seed is unpredictable before the draw and the whole draw is replayable
 * afterwards.
 */

/** Generate a fresh 256-bit seed as a hex string. */
export function generateSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
};

/**
 * sfc32, seeded by hashing the draw seed together with a domain label so that
 * independent parts of the draw (winner selection vs. prize allocation, and
 * each tier) consume separate, non-overlapping streams. Without the label a
 * change to how many numbers one stage consumes would silently shift every
 * later stage.
 */
export function createRng(seed: string, domain: string): Rng {
  const digest = crypto
    .createHash("sha256")
    .update(`${seed}:${domain}`)
    .digest();

  let a = digest.readUInt32LE(0);
  let b = digest.readUInt32LE(4);
  let c = digest.readUInt32LE(8);
  let d = digest.readUInt32LE(12);

  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4_294_967_296;
  };

  // Discard the first outputs so the state is well mixed before use.
  for (let i = 0; i < 12; i += 1) {
    next();
  }

  return {
    next,
    nextInt(maxExclusive: number) {
      if (maxExclusive <= 0) {
        throw new RangeError("maxExclusive must be greater than zero");
      }
      return Math.floor(next() * maxExclusive) % maxExclusive;
    },
  };
}

/**
 * Pick one item with probability proportional to its weight.
 *
 * Used both for ticket entries (weight = tickets in that purchase, so every
 * individual ticket is one equally likely entry) and for prize units (weight =
 * units remaining). Returns null when nothing has positive weight.
 */
export function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rng: Rng
): T | null {
  let total = 0;
  for (const item of items) {
    const weight = weightOf(item);
    if (weight > 0) {
      total += weight;
    }
  }

  if (total <= 0) {
    return null;
  }

  let threshold = rng.next() * total;
  for (const item of items) {
    const weight = weightOf(item);
    if (weight <= 0) {
      continue;
    }
    threshold -= weight;
    if (threshold < 0) {
      return item;
    }
  }

  // Floating point drift only; fall back to the last positively weighted item.
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item !== undefined && weightOf(item) > 0) {
      return item;
    }
  }
  return null;
}
