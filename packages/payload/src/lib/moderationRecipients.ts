import type { Payload, PayloadRequest } from "payload";

import {
  getModerationSettings,
  type ResolvedModerationSettings,
} from "./moderationSettings";

/**
 * Which moderation emails an admin receives.
 *
 * Stored per-admin on the `admins` collection. When unset, the admin's role
 * decides (see DEFAULT_ALERT_ROLES), so a fresh install still notifies someone
 * without anyone having to configure it.
 */
export type AlertPreference = "all" | "urgent" | "digest" | "none";

export type AlertTier = "urgent" | "digest";

/**
 * Roles never mailed moderation content, even if explicitly opted in.
 * Partners are external parties; reports quote user content and identify
 * reporters, which is not theirs to see.
 */
const EXCLUDED_ROLES = new Set(["partner"]);

export type AdminRecord = {
  email?: string | null;
  role?: string | null;
  moderationAlerts?: AlertPreference | null;
};

/**
 * Resolves which of the given admins should receive a given tier of alert.
 *
 * Precedence, most specific first:
 *   1. The admin's own `moderationAlerts` preference, if set.
 *   2. The roles configured in the Moderation Settings global.
 *   3. That global's own defaults, applied upstream by applySettingsDefaults.
 *
 * Partners are excluded at every level. Pure so the precedence rules can be
 * tested without a database.
 */
export function selectRecipients(
  admins: AdminRecord[],
  tier: AlertTier,
  settings: ResolvedModerationSettings,
  extraEmails: string[] = []
): string[] {
  const selected: string[] = [];

  for (const admin of admins) {
    if (!admin.email) {
      continue;
    }

    const role = admin.role ?? "";
    if (EXCLUDED_ROLES.has(role)) {
      continue;
    }

    const preference: AlertPreference =
      admin.moderationAlerts ??
      (settings.alertRoles.has(role) ? "all" : "none");

    if (preference === "all" || preference === tier) {
      selected.push(admin.email);
    }
  }

  for (const recipient of settings.additionalRecipients) {
    if (recipient.tier === "all" || recipient.tier === tier) {
      selected.push(recipient.email);
    }
  }

  selected.push(...extraEmails);

  return dedupe(selected);
}

/** Case-insensitive dedupe, preserving the first spelling seen. */
function dedupe(emails: string[]): string[] {
  const seen = new Set<string>();
  return emails.filter((email) => {
    const key = email.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Roles that are notified when every configured recipient has opted out.
 * The last line of defence, not a routing rule.
 */
const FLOOR_ROLES = new Set(["super-admin"]);

/**
 * Guarantees moderation email always has somewhere to go.
 *
 * Individual opt-out is deliberately allowed: a Content Manager muting
 * themselves while colleagues stay on rotation is legitimate. Everyone opting
 * out at once is not: it would silently disable the notification path this app
 * tells App Review guarantees reports get acted on, with nothing on screen to
 * say so.
 *
 * So when selection yields nobody, super-admins are notified regardless of
 * their own preference. The distinction that matters is not "can someone opt
 * out" but "can everyone opt out at the same time".
 */
export function applyRecipientFloor(
  admins: AdminRecord[],
  selected: string[]
): { recipients: string[]; floorEngaged: boolean } {
  if (selected.length > 0) {
    return { recipients: selected, floorEngaged: false };
  }

  const fallback = dedupe(
    admins
      .filter((admin) => {
        const role = admin.role ?? "";
        return (
          Boolean(admin.email) &&
          !EXCLUDED_ROLES.has(role) &&
          FLOOR_ROLES.has(role)
        );
      })
      .map((admin) => admin.email as string)
  );

  return { recipients: fallback, floorEngaged: fallback.length > 0 };
}

/** Parses the MODERATION_ALERT_EMAILS env var (comma-separated). */
export function parseExtraEmails(raw = process.env.MODERATION_ALERT_EMAILS) {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

/**
 * Loads admins, resolves the recipient list for a tier, and applies the
 * safety floor.
 *
 * Logs loudly at both failure levels: previously both mail paths returned
 * "not sent" silently, which is indistinguishable from "nothing to report"
 * and would hide a total moderation-notification outage.
 */
export async function resolveModerationRecipients(
  payload: Payload,
  tier: AlertTier,
  req?: PayloadRequest,
  settings?: ResolvedModerationSettings
): Promise<string[]> {
  const [admins, resolvedSettings] = await Promise.all([
    payload.find({
      collection: "admins",
      depth: 0,
      pagination: false,
      req,
    }),
    settings ? Promise.resolve(settings) : getModerationSettings(payload, req),
  ]);

  const adminDocs = admins.docs as AdminRecord[];

  const selected = selectRecipients(
    adminDocs,
    tier,
    resolvedSettings,
    parseExtraEmails()
  );

  const { recipients, floorEngaged } = applyRecipientFloor(adminDocs, selected);

  if (floorEngaged) {
    payload.logger.warn(
      { tier, recipientCount: recipients.length },
      "Moderation alert safety floor engaged: every configured recipient has opted out, so super-admins were notified regardless of their preference. Review Alert Recipients in Moderation Settings."
    );
  }

  if (recipients.length === 0) {
    payload.logger.error(
      { tier, adminCount: adminDocs.length },
      "No moderation alert recipients resolved; moderation email will not be delivered. Configure Alert Recipients in Moderation Settings, set an admin's Moderation Alerts preference, or set MODERATION_ALERT_EMAILS."
    );
  }

  return recipients;
}
