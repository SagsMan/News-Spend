import type { Payload, PayloadRequest } from "payload";

import {
  DEFAULT_AUTO_HIDE_THRESHOLD,
  HIDE_ON_FIRST_REPORT_REASONS,
  URGENT_REASONS,
} from "./moderationLabels";

export type AdditionalRecipient = {
  email: string;
  tier: "all" | "urgent" | "digest";
};

/** Digest cadence; weekly unless the global explicitly chooses daily. */
export type DigestFrequency = "daily" | "weekly";

/** Weekday names as stored by the global; index 0 is Sunday. */
export const DIGEST_WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Moderation configuration with every default already applied, so callers
 * never have to reason about which fields the global left empty.
 */
export type ResolvedModerationSettings = {
  alertRoles: Set<string>;
  additionalRecipients: AdditionalRecipient[];
  autoHideThreshold: number;
  digestEnabled: boolean;
  digestFrequency: DigestFrequency;
  digestWeekday: number;
  hideOnFirstReportReasons: Set<string>;
  urgentReasons: Set<string>;
};

/** Shape stored by the ModerationSettings global; every field is optional. */
export type ModerationSettingsDoc = {
  alertRoles?: string[] | null;
  additionalRecipients?: Array<{
    email?: string | null;
    tier?: string | null;
  }> | null;
  autoHideThreshold?: number | null;
  digestEnabled?: boolean | null;
  digestFrequency?: string | null;
  digestWeekday?: string | null;
  hideOnFirstReportReasons?: string[] | null;
  urgentReasons?: string[] | null;
};

/** Roles that receive moderation email when the global sets none. */
export const DEFAULT_ALERT_ROLES = ["super-admin", "content-manager"];

/**
 * Applies defaults to a raw global document.
 *
 * Empty and unset are treated identically: both mean "use the default",
 * because Payload writes an empty array for a `hasMany` select the moment the
 * global is saved, and an admin saving the form without touching a field must
 * not silently disable that behaviour.
 *
 * Pure, so the precedence rules are testable without a database.
 */
export function applySettingsDefaults(
  doc: ModerationSettingsDoc | null | undefined
): ResolvedModerationSettings {
  const nonEmpty = (values: string[] | null | undefined) =>
    values && values.length > 0 ? values : undefined;

  const additional = (doc?.additionalRecipients ?? [])
    .map((entry) => ({
      email: (entry?.email ?? "").trim(),
      tier: (entry?.tier ?? "all") as AdditionalRecipient["tier"],
    }))
    .filter((entry): entry is AdditionalRecipient => Boolean(entry.email));

  const threshold = doc?.autoHideThreshold;

  const weekdayIndex = DIGEST_WEEKDAYS.indexOf(
    (doc?.digestWeekday ?? "monday") as (typeof DIGEST_WEEKDAYS)[number]
  );

  return {
    alertRoles: new Set(nonEmpty(doc?.alertRoles) ?? DEFAULT_ALERT_ROLES),
    additionalRecipients: additional,
    // Guard against 0 or negatives, which would hide content on every report.
    autoHideThreshold:
      typeof threshold === "number" && threshold >= 1
        ? threshold
        : DEFAULT_AUTO_HIDE_THRESHOLD,
    digestEnabled: doc?.digestEnabled ?? true,
    digestFrequency: doc?.digestFrequency === "daily" ? "daily" : "weekly",
    digestWeekday: weekdayIndex >= 0 ? weekdayIndex : 1,
    hideOnFirstReportReasons: new Set(
      nonEmpty(doc?.hideOnFirstReportReasons) ?? HIDE_ON_FIRST_REPORT_REASONS
    ),
    urgentReasons: new Set(nonEmpty(doc?.urgentReasons) ?? URGENT_REASONS),
  };
}

/**
 * Loads the global and applies defaults.
 *
 * Never throws: if the global cannot be read (not yet created, database
 * hiccup), moderation falls back to code defaults rather than failing the
 * report that triggered it.
 */
export async function getModerationSettings(
  payload: Payload,
  req?: PayloadRequest
): Promise<ResolvedModerationSettings> {
  try {
    const doc = await payload.findGlobal({
      slug: "moderation-settings",
      depth: 0,
      req,
    });

    return applySettingsDefaults(doc as ModerationSettingsDoc);
  } catch (error) {
    payload.logger.error(
      { error },
      "Failed to read moderation settings global; falling back to defaults"
    );
    return applySettingsDefaults(null);
  }
}
