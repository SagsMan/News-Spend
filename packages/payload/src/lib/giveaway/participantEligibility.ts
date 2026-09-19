import {
  DEFAULT_GIVEAWAY_COUNTRY,
  MINIMUM_PARTICIPANT_AGE,
} from "../../collections/giveaway/constants";

/**
 * Whether someone is old enough on a given day.
 *
 * Computed from the date of birth every time rather than stored as an age or
 * a boolean, because both go stale: a stored age is wrong a year later, and a
 * stored "is adult" flag would lock out someone who signed up at seventeen
 * and has since turned eighteen. Recomputing costs nothing and is always
 * right.
 */
export function ageOn(
  dateOfBirth: string | Date,
  on: Date = new Date()
): number {
  const dob =
    typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;

  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dob.getUTCMonth();

  // Birthday not yet reached this year.
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && on.getUTCDate() < dob.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

export type ParticipantVerdict =
  | { eligible: true }
  | {
      eligible: false;
      reason: "no_date_of_birth" | "under_age";
      message: string;
    };

/**
 * Whether a user may take part in a giveaway at all (age gate).
 *
 * Separate from the tier eligibility in `eligibility.ts`, and deliberately so:
 * that decides *which prizes* someone can win, this decides whether they may
 * buy a ticket in the first place. A user failing this is not a low-tier
 * participant, they are not a participant.
 *
 * Enforced at purchase rather than only at signup. Someone who signed up
 * under age becomes eligible on their eighteenth birthday without needing to
 * do anything, and someone who lied at signup is caught again here.
 */
export function evaluateParticipant(
  user: { dateOfBirth?: string | null },
  { now = new Date() }: { now?: Date } = {}
): ParticipantVerdict {
  if (!user.dateOfBirth) {
    return {
      eligible: false,
      reason: "no_date_of_birth",
      message: "Add your date of birth to take part in giveaways.",
    };
  }

  if (ageOn(user.dateOfBirth, now) < MINIMUM_PARTICIPANT_AGE) {
    return {
      eligible: false,
      reason: "under_age",
      message: `You must be ${MINIMUM_PARTICIPANT_AGE} or older to take part in a giveaway.`,
    };
  }

  return { eligible: true };
}

/**
 * The country a giveaway decision should be made against.
 *
 * Self-reported country is a display signal, not a legal one: it is typed
 * into a form and can be changed at will. Where a verified document exists it
 * wins, because that is the only version of this fact anyone has actually
 * checked.
 *
 * Nothing gates on this yet; the platform runs in one country. It exists so
 * that when a second is added, the question "which country is this person
 * in?" already has one answer with a known provenance, rather than two fields
 * that disagree.
 */
export function resolveCountry(user: {
  country?: string | null;
  verifiedCountry?: string | null;
}): { country: string; verified: boolean } {
  if (user.verifiedCountry) {
    return { country: user.verifiedCountry, verified: true };
  }

  return { country: user.country || DEFAULT_GIVEAWAY_COUNTRY, verified: false };
}
