/**
 * How a Reloadly denomination is written for a human.
 *
 * Kept apart from `./reloadly` so the admin panel can import it without pulling
 * the API client (and its token handling) into the browser bundle.
 */

/**
 * The price, plus the operator's own description of what it buys when there is
 * one — "₦600 — 2.5GB 2-day".
 *
 * The price alone does not identify a bundle: ₦600 buys 2.5GB on one network
 * and 2GB on another. Every place that offers or rejects an amount says the
 * same thing about it, so the list an editor picks from and the list they are
 * shown after a rejection read alike.
 *
 * `descriptions` is Reloadly's `localFixedAmountsDescriptions`, keyed by the
 * amount as a string.
 */
export const describeDenomination = (
  amount: number,
  descriptions?: Record<string, string> | null
): string => {
  const price = `₦${amount.toLocaleString()}`;
  const buys = lookupDescription(amount, descriptions);
  return buys ? `${price} — ${buys}` : price;
};

/**
 * Reloadly keys the descriptions to two decimal places — `"100.00"`, never
 * `"100"` — so the obvious `String(amount)` lookup silently matches nothing and
 * every amount quietly falls back to its bare price. The plain form is kept as
 * a fallback in case an operator is keyed differently.
 *
 * Descriptions arrive with stray surrounding whitespace (`" 1500GB - 1 Year
 * Plan"`), which shows up as a visible gap after the dash.
 */
const lookupDescription = (
  amount: number,
  descriptions?: Record<string, string> | null
): string | undefined => {
  if (!descriptions) {
    return;
  }
  const buys = descriptions[amount.toFixed(2)] ?? descriptions[String(amount)];
  return buys?.trim() || undefined;
};

/** How many plans a rejection message offers before it stops being readable. */
const NEAREST_COUNT = 4;

/**
 * The handful of denominations closest to a rejected amount, as one readable
 * line, ordered by price.
 *
 * Deliberately not the full list: a network can sell thirty bundles, and each
 * carries a description as long as "600MB Weekly Plan + FREE 1GB for YouTube
 * and 100MB for YouTube Music + 3mins.", which runs to well over a thousand
 * characters on the single line Payload gives a field error. Somebody who
 * asked for ₦750 wants to know it is ₦600 or ₦800, not what a ₦450,000 yearly
 * plan buys.
 *
 * Entries are separated by semicolons rather than commas because the
 * descriptions themselves contain dashes, commas and spaces.
 */
export const describeNearestDenominations = (
  amounts: number[],
  rejected: number,
  descriptions?: Record<string, string> | null,
  count: number = NEAREST_COUNT
): string => {
  if (amounts.length === 0) {
    return "none";
  }

  const nearest = [...amounts]
    .sort((a, b) => Math.abs(a - rejected) - Math.abs(b - rejected))
    .slice(0, count)
    // Back into price order: nearest-first reads as an arbitrary jumble.
    .sort((a, b) => a - b);

  const list = nearest
    .map((amount) => describeDenomination(amount, descriptions))
    .join("; ");

  const omitted = amounts.length - nearest.length;
  if (omitted === 0) {
    return list;
  }

  return `${list} (and ${omitted} other${omitted === 1 ? "" : "s"}, from ₦${Math.min(...amounts).toLocaleString()} to ₦${Math.max(...amounts).toLocaleString()})`;
};
