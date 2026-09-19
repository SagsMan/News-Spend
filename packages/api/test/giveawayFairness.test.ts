import { describe, expect, it } from "bun:test";
import {
  type DrawOutcome,
  evaluateFairness,
  hasLoyaltyWaiver,
} from "@news-spend-media/payload/lib/giveaway/fairness";

/**
 * Fairness and anti-abuse rules (spec section 22).
 *
 * `outcomes` is the user's history over previously completed giveaways, most
 * recent first. `null` means they did not take part in that one.
 */
const history = (...outcomes: DrawOutcome[]) => ({ outcomes });

describe("22.1: high-tier cooldown", () => {
  it("bars Tier 1 and Tier 2 after a Tier 2 win last draw", () => {
    const h = history("tier2");

    expect(evaluateFairness("tier1", h).eligible).toBe(false);
    expect(evaluateFairness("tier2", h).eligible).toBe(false);
  });

  it("leaves Tier 3 open during that cooldown", () => {
    // The spec is explicit: a high-tier winner may still win Tier 3.
    expect(evaluateFairness("tier3", history("tier2")).eligible).toBe(true);
    expect(evaluateFairness("tier3", history("tier1")).eligible).toBe(true);
  });

  it("restores Tier 2 one draw later", () => {
    // Won Tier 2 two draws ago; the one-draw cooldown has elapsed.
    expect(
      evaluateFairness("tier2", history("participated_no_win", "tier2"))
        .eligible
    ).toBe(true);
  });

  it("does not bar anyone with no history", () => {
    for (const tier of ["tier1", "tier2", "tier3"] as const) {
      expect(evaluateFairness(tier, history()).eligible).toBe(true);
    }
  });
});

describe("22.2: Tier 1 cooldown", () => {
  // "Draw 1 → Tier 1 Winner; Draws 2–5 → Cannot win Tier 1; Draw 6 → restored"
  it("bars Tier 1 for four draws, matching the spec's worked example", () => {
    const filler: DrawOutcome[] = [];

    for (let drawsAgo = 1; drawsAgo <= 4; drawsAgo += 1) {
      const h = history(...filler, "tier1");
      expect(evaluateFairness("tier1", h).eligible).toBe(false);
      filler.push("participated_no_win");
    }

    // Five draws on, Tier 1 is available again.
    expect(
      evaluateFairness("tier1", history(...filler, "tier1")).eligible
    ).toBe(true);
  });

  it("leaves Tier 2 and Tier 3 open once the high-tier cooldown has passed", () => {
    // Won Tier 1 three draws ago: 22.1 has elapsed, 22.2 has not.
    const h = history("participated_no_win", "participated_no_win", "tier1");

    expect(evaluateFairness("tier1", h).eligible).toBe(false);
    expect(evaluateFairness("tier2", h).eligible).toBe(true);
    expect(evaluateFairness("tier3", h).eligible).toBe(true);
  });
});

describe("22.3: consecutive Tier 1 wins", () => {
  it("suspends Tier 1 after two wins running", () => {
    expect(evaluateFairness("tier1", history("tier1", "tier1")).eligible).toBe(
      false
    );
  });

  it("is unreachable in practice, because earlier rules forbid the wins it reacts to", () => {
    // 22.3 reacts to two Tier 1 wins in consecutive draws, but a user can
    // never legitimately reach that: 22.1 bars Tier 1 the draw after any
    // high-tier win, and 22.2 keeps it barred for four. So after one Tier 1
    // win, Tier 1 is closed at every point a second win could occur.
    //
    // This asserts the spec conflict rather than the behaviour, so it fails
    // loudly if 22.2 is ever relaxed, at which point 22.3 becomes live and
    // needs real scrutiny.
    const filler: DrawOutcome[] = [];

    for (let drawsAgo = 1; drawsAgo <= 4; drawsAgo += 1) {
      const verdict = evaluateFairness("tier1", history(...filler, "tier1"));
      expect(verdict.eligible).toBe(false);
      filler.push("participated_no_win");
    }
  });

  it("lifts the suspension after two further draws", () => {
    const h = history(
      "participated_no_win",
      "participated_no_win",
      "participated_no_win",
      "participated_no_win",
      "tier1",
      "tier1"
    );
    expect(evaluateFairness("tier1", h).eligible).toBe(true);
  });
});

describe("22.4: loyalty waiver", () => {
  const fourBlanks: DrawOutcome[] = [
    "participated_no_win",
    "participated_no_win",
    "participated_no_win",
    "participated_no_win",
  ];

  it("is earned after four consecutive draws with no prize", () => {
    expect(hasLoyaltyWaiver(history(...fourBlanks))).toBe(true);
  });

  it("is not earned after only three", () => {
    expect(
      hasLoyaltyWaiver(
        history(
          "participated_no_win",
          "participated_no_win",
          "participated_no_win"
        )
      )
    ).toBe(false);
  });

  it("is broken by a draw the user sat out", () => {
    // Took part, took part, skipped, took part, took part, no run of four.
    expect(
      hasLoyaltyWaiver(
        history(
          "participated_no_win",
          "participated_no_win",
          null,
          "participated_no_win",
          "participated_no_win"
        )
      )
    ).toBe(false);
  });

  it("is broken by winning anything, including Tier 3", () => {
    expect(
      hasLoyaltyWaiver(
        history(
          "participated_no_win",
          "participated_no_win",
          "tier3",
          "participated_no_win"
        )
      )
    ).toBe(false);
  });

  it("is reported on the Tier 1 verdict only", () => {
    const h = history(...fourBlanks);
    const t1 = evaluateFairness("tier1", h);
    const t2 = evaluateFairness("tier2", h);

    expect(t1.eligible && t1.loyaltyWaiver).toBe(true);
    // The waiver applies to Tier 1 alone.
    expect(t2.eligible && t2.loyaltyWaiver).toBe(false);
  });
});
