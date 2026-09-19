/**
 * Display labels for ContentReport reasons, shared by the urgent alert and the
 * nightly digest so the two emails never drift apart. Keys must stay in sync
 * with the `reason` options in the ContentReport collection.
 */
export const REASON_LABELS: Record<string, string> = {
  spam: "Spam or Advertising",
  harassment: "Harassment or Bullying",
  "hate-speech": "Hate Speech or Discrimination",
  misinformation: "Misinformation",
  "personal-info": "Personal Information",
  inappropriate: "Explicit or Inappropriate Content",
  "off-topic": "Off-Topic",
  trolling: "Trolling or Deliberate Provocation",
  illegal: "Illegal Activity",
  other: "Other",
};

/**
 * Select options for reason fields, derived from REASON_LABELS so the admin UI
 * can never drift from the labels used in email.
 */
export const REASON_OPTIONS = Object.entries(REASON_LABELS).map(
  ([value, label]) => ({ label, value })
);

/**
 * Reasons that bypass the nightly digest and trigger an immediate admin email.
 * These are the categories where a day of latency is not defensible.
 *
 * Used when the Moderation Settings global leaves the field unset.
 */
export const URGENT_REASONS = new Set([
  "illegal",
  "hate-speech",
  "harassment",
  "inappropriate",
]);

/**
 * Reasons severe enough to hide content on a single report, rather than
 * waiting for the distinct-reporter threshold.
 *
 * Used when the Moderation Settings global leaves the field unset.
 */
export const HIDE_ON_FIRST_REPORT_REASONS = new Set([
  "illegal",
  "hate-speech",
  "inappropriate",
]);

/** Distinct reporters required before content is auto-hidden. */
export const DEFAULT_AUTO_HIDE_THRESHOLD = 3;
