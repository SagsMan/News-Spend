import type { DigestFrequency } from "./moderationSettings";

/** Digest schedule: daily, or weekly on the given weekday (0 = Sunday). */
export type DigestSchedule = {
  frequency: DigestFrequency;
  weekday: number;
};

/**
 * Next 23:00 Africa/Lagos digest slot, as a Date.
 *
 * Africa/Lagos is UTC+1 year-round (no DST), so 23:00 local is 22:00 UTC.
 * Shared by the report hook (which schedules the first digest) and the digest
 * task itself (which re-schedules while a backlog remains).
 */
export function nextDigestTime(
  from: Date = new Date(),
  schedule: DigestSchedule = { frequency: "daily", weekday: 1 }
): Date {
  const base = digestSlotForDate(from);

  if (schedule.frequency === "daily") {
    return base <= from.getTime()
      ? new Date(base + 24 * 60 * 60 * 1000)
      : new Date(base);
  }

  // Weekly: the next slot whose Lagos weekday matches, strictly in the
  // future. Offsets 0..7 always contain exactly one valid slot (offset 7 is
  // the same weekday next week, which covers "today already passed").
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = base + offset * 24 * 60 * 60 * 1000;
    if (
      candidate > from.getTime() &&
      lagosWeekday(candidate) === schedule.weekday
    ) {
      return new Date(candidate);
    }
  }

  // Unreachable: offset 7 always matches. Kept so a future calendar change
  // cannot turn a missed digest into an infinite loop.
  return new Date(base + 7 * 24 * 60 * 60 * 1000);
}

/** 23:00 Lagos on the Lagos calendar date containing `from`, as epoch ms. */
function digestSlotForDate(from: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(from);

  const getPart = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
    22,
    0,
    0,
    0
  );
}

/**
 * Lagos weekday of an instant (0 = Sunday). Lagos is UTC+1 with no DST, so
 * shifting by one hour and reading the UTC weekday is exact.
 */
function lagosWeekday(epochMs: number): number {
  return new Date(epochMs + 60 * 60 * 1000).getUTCDay();
}
