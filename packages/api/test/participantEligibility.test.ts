import { describe, expect, it } from "bun:test";
import {
  ageOn,
  evaluateParticipant,
  resolveCountry,
} from "@news-spend-media/payload/lib/giveaway/participantEligibility";

describe("ageOn", () => {
  it("counts a birthday that has already passed this year", () => {
    expect(ageOn("2000-03-10", new Date("2026-08-14"))).toBe(26);
  });

  it("does not count a birthday still to come this year", () => {
    expect(ageOn("2000-12-10", new Date("2026-08-14"))).toBe(25);
  });

  it("turns over exactly on the birthday, not the day before", () => {
    expect(ageOn("2008-08-13", new Date("2008-08-13"))).toBe(0);
    expect(ageOn("2008-08-14", new Date("2026-08-13"))).toBe(17);
    expect(ageOn("2008-08-14", new Date("2026-08-14"))).toBe(18);
  });

  it("handles a 29 February birthday in a non-leap year", () => {
    // No 29 Feb in 2026, so the turnover lands on 1 March rather than
    // silently counting them a year older on 28 February.
    expect(ageOn("2008-02-29", new Date("2026-02-28"))).toBe(17);
    expect(ageOn("2008-02-29", new Date("2026-03-01"))).toBe(18);
  });
});

describe("evaluateParticipant", () => {
  const adult = new Date(Date.now() - 30 * 365 * 24 * 3_600_000).toISOString();

  it("admits an adult", () => {
    expect(evaluateParticipant({ dateOfBirth: adult })).toEqual({
      eligible: true,
    });
  });

  it("refuses an account with no date of birth", () => {
    const verdict = evaluateParticipant({ dateOfBirth: null });

    expect(verdict.eligible).toBe(false);
    if (!verdict.eligible) {
      expect(verdict.reason).toBe("no_date_of_birth");
    }
  });

  it("refuses someone under 18", () => {
    const verdict = evaluateParticipant({
      dateOfBirth: new Date("2012-01-01").toISOString(),
    });

    expect(verdict.eligible).toBe(false);
    if (!verdict.eligible) {
      expect(verdict.reason).toBe("under_age");
    }
  });

  it("admits the same person once their birthday passes", () => {
    const dob = "2008-06-01";

    // The verdict changes with the date and nothing else: no stored flag to
    // go stale, and nobody has to intervene on the birthday.
    expect(
      evaluateParticipant({ dateOfBirth: dob }, { now: new Date("2026-05-31") })
        .eligible
    ).toBe(false);
    expect(
      evaluateParticipant({ dateOfBirth: dob }, { now: new Date("2026-06-01") })
        .eligible
    ).toBe(true);
  });
});

describe("resolveCountry", () => {
  it("prefers the verified country over the self-reported one", () => {
    // Self-report is typed into a form; the document was actually checked.
    expect(resolveCountry({ country: "GB", verifiedCountry: "NG" })).toEqual({
      country: "NG",
      verified: true,
    });
  });

  it("falls back to the self-reported country when nothing is verified", () => {
    expect(resolveCountry({ country: "GH" })).toEqual({
      country: "GH",
      verified: false,
    });
  });

  it("assumes the platform's only market when neither is set", () => {
    expect(resolveCountry({})).toEqual({ country: "NG", verified: false });
  });
});
