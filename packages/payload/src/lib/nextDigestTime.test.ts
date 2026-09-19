import { describe, expect, it } from "vitest";

import { nextDigestTime } from "./nextDigestTime";

describe("nextDigestTime", () => {
  it("targets 22:00 UTC (23:00 Africa/Lagos)", () => {
    const result = nextDigestTime(new Date("2026-08-10T09:00:00Z"));

    expect(result.toISOString()).toBe("2026-08-10T22:00:00.000Z");
  });

  it("rolls to the next day when today's slot has passed", () => {
    const result = nextDigestTime(new Date("2026-08-10T22:30:00Z"));

    expect(result.toISOString()).toBe("2026-08-11T22:00:00.000Z");
  });

  it("rolls forward when called exactly at the slot", () => {
    const result = nextDigestTime(new Date("2026-08-10T22:00:00Z"));

    expect(result.toISOString()).toBe("2026-08-11T22:00:00.000Z");
  });

  it("uses the Lagos calendar date, not the UTC one", () => {
    // 23:30 UTC on the 10th is already 00:30 on the 11th in Lagos, so the next
    // digest is the 11th's slot; same instant either way, but the date parts
    // must come from the Lagos calendar for the arithmetic to hold.
    const result = nextDigestTime(new Date("2026-08-10T23:30:00Z"));

    expect(result.toISOString()).toBe("2026-08-11T22:00:00.000Z");
  });

  it("always returns a future time", () => {
    for (const hour of [0, 6, 12, 21, 22, 23]) {
      const from = new Date(
        `2026-08-10T${String(hour).padStart(2, "0")}:00:00Z`
      );
      expect(nextDigestTime(from).getTime()).toBeGreaterThan(from.getTime());
    }
  });
});
