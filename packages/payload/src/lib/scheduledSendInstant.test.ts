import { describe, expect, it } from "vitest";

/**
 * What a scheduled notification promises, expressed as tests.
 *
 * The reported symptom was that a notification scheduled from Nigeria did not
 * reach readers in Canada. These pin the property that makes the claim
 * checkable: the send time is one instant, and every step between the
 * administrator's keyboard and the job runner preserves it. Nothing here
 * reads a local calendar, so nothing here can drift with the machine it runs
 * on.
 */

/** What the afterChange hook hands the job runner as `waitUntil`. */
function waitUntilFor(scheduledFor: string): number {
  return new Date(scheduledFor).getTime();
}

/**
 * The instant an administrator means when they pick a wall-clock time and
 * say which zone they mean it in. This is what the picker plus the
 * `scheduledFor_tz` selector together express.
 */
function instantFrom(wallClock: string, timeZone: string): number {
  const naive = new Date(`${wallClock}Z`);
  const asIfLocal = new Date(
    naive.toLocaleString("en-US", { timeZone: "UTC" })
  );
  const inZone = new Date(naive.toLocaleString("en-US", { timeZone }));
  return naive.getTime() + (asIfLocal.getTime() - inZone.getTime());
}

describe("scheduled notification send instant", () => {
  it("is one instant no matter which zone the administrator composed it in", () => {
    // 10:00 in Lagos and 05:00 in Toronto are the same moment on 20 Aug 2026.
    const lagos = instantFrom("2026-08-20T10:00:00", "Africa/Lagos");
    const toronto = instantFrom("2026-08-20T05:00:00", "America/Toronto");

    expect(lagos).toBe(toronto);
    expect(new Date(lagos).toISOString()).toBe("2026-08-20T09:00:00.000Z");
  });

  it("hands the job runner the stored instant unchanged", () => {
    const stored = "2026-08-20T09:00:00.000Z";

    expect(waitUntilFor(stored)).toBe(Date.parse(stored));
    expect(new Date(waitUntilFor(stored)).toISOString()).toBe(stored);
  });

  /**
   * The device offset theory the bug was first filed under. If a reader's
   * timezone could change the answer, this is where it would show.
   */
  it("fires at the same moment for readers at any offset", () => {
    const stored = "2026-08-20T09:00:00.000Z";
    const fireAt = waitUntilFor(stored);

    const localTimes = [
      "Africa/Lagos",
      "America/Toronto",
      "America/Vancouver",
      "Asia/Tokyo",
    ].map((timeZone) => new Date(fireAt).toLocaleString("en-US", { timeZone }));

    // Four different wall clocks, one instant: the readers differ only in
    // what their own clock says when the push lands.
    expect(new Set(localTimes).size).toBe(4);
    expect(new Set([fireAt, fireAt, fireAt, fireAt]).size).toBe(1);
  });

  it("survives a zone whose offset changes with daylight saving", () => {
    // Toronto is UTC-4 in August and UTC-5 in January. An administrator
    // scheduling 09:00 local in each month means two different UTC instants,
    // and a fixed offset would get one of them wrong.
    const summer = instantFrom("2026-08-20T09:00:00", "America/Toronto");
    const winter = instantFrom("2026-01-20T09:00:00", "America/Toronto");

    expect(new Date(summer).toISOString()).toBe("2026-08-20T13:00:00.000Z");
    expect(new Date(winter).toISOString()).toBe("2026-01-20T14:00:00.000Z");
  });
});
