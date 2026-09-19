import { describe, expect, it } from "bun:test";

import { screenText } from "./content-filter";

describe("screenText", () => {
  it("allows ordinary comments", () => {
    expect(screenText("Great reporting, thanks for the update.").ok).toBe(true);
    expect(screenText("").ok).toBe(true);
    expect(screenText("   ").ok).toBe(true);
  });

  it("rejects plain profanity", () => {
    const result = screenText("this is fucking terrible");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.severity).toBe("profanity");
  });

  it("flags slurs as severe", () => {
    const result = screenText("you absolute faggot");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.severity).toBe("severe");
  });

  it("catches leetspeak evasion", () => {
    expect(screenText("sh1t take").ok).toBe(false);
    expect(screenText("f@ck this").ok).toBe(false);
  });

  it("catches character padding", () => {
    expect(screenText("fuuuuuck").ok).toBe(false);
  });

  it("catches separator evasion", () => {
    expect(screenText("f.u.c.k you").ok).toBe(false);
    expect(screenText("f u c k").ok).toBe(false);
  });

  it("catches multi-word terms regardless of spacing", () => {
    expect(screenText("just kill yourself").ok).toBe(false);
    expect(screenText("killyourself").ok).toBe(false);
  });

  it("does not flag innocent words containing banned substrings", () => {
    const innocent = [
      "let us assess the class results",
      "the analysis was thorough",
      "she ordered a cocktail",
      "the pilot left the cockpit",
      "a cockroach ran past",
      "prickly pear season",
      "shiitake mushrooms are great",
      "Scunthorpe United won",
      "grape harvest",
      "my therapist said so",
    ];

    for (const text of innocent) {
      expect(screenText(text), text).toEqual({ ok: true });
    }
  });

  it("matches inflections but not unrelated prefixes", () => {
    expect(screenText("fucker").ok).toBe(false);
    expect(screenText("shitty").ok).toBe(false);
  });

  it("treats short ambiguous terms as standalone-only", () => {
    expect(screenText("hoedown tonight").ok).toBe(true);
    expect(screenText("what a hoe").ok).toBe(false);
    expect(screenText("cp").ok).toBe(false);
    expect(screenText("cpu benchmark").ok).toBe(true);
  });

  it("is case and diacritic insensitive", () => {
    expect(screenText("FUCK").ok).toBe(false);
    expect(screenText("fúck").ok).toBe(false);
  });
});
