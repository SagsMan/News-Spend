import { describe, expect, it } from "bun:test";

import { compareVersions, isBelowMinimum, parseVersion } from "./appVersion";

describe("parseVersion", () => {
  it("reads a full marketing version", () => {
    expect(parseVersion("2.4.3")).toEqual({ major: 2, minor: 4, patch: 3 });
  });

  it("treats missing parts as zero", () => {
    // A store version is not always written out in full.
    expect(parseVersion("3")).toEqual({ major: 3, minor: 0, patch: 0 });
    expect(parseVersion("3.1")).toEqual({ major: 3, minor: 1, patch: 0 });
  });

  it("tolerates a leading v and surrounding space", () => {
    expect(parseVersion(" v2.4.3 ")).toEqual({ major: 2, minor: 4, patch: 3 });
  });

  it("ignores a build suffix rather than choking on it", () => {
    expect(parseVersion("2.4.3-beta.1")).toEqual({
      major: 2,
      minor: 4,
      patch: 3,
    });
  });

  it("returns null for anything it cannot read", () => {
    for (const value of ["", "   ", "unknown", "v", null, undefined]) {
      expect(parseVersion(value)).toBeNull();
    }
  });
});

describe("compareVersions", () => {
  it("orders by major, then minor, then patch", () => {
    const p = (v: string) => parseVersion(v)!;
    expect(compareVersions(p("2.0.0"), p("10.0.0"))).toBeLessThan(0);
    expect(compareVersions(p("2.10.0"), p("2.9.0"))).toBeGreaterThan(0);
    expect(compareVersions(p("2.4.3"), p("2.4.3"))).toBe(0);
  });

  it("does not compare version parts as strings", () => {
    // "10" < "9" lexically, which is the classic way this goes wrong.
    const p = (v: string) => parseVersion(v)!;
    expect(compareVersions(p("2.4.10"), p("2.4.9"))).toBeGreaterThan(0);
  });
});

describe("isBelowMinimum", () => {
  it("blocks a build below the floor", () => {
    expect(isBelowMinimum("2.4.2", "2.4.3")).toBe(true);
  });

  it("allows the floor itself and anything above", () => {
    expect(isBelowMinimum("2.4.3", "2.4.3")).toBe(false);
    expect(isBelowMinimum("2.5.0", "2.4.3")).toBe(false);
  });

  it("enforces nothing when no floor is configured", () => {
    // Ships dark on purpose: the mechanism must reach users before it is ever
    // enforced, or it locks out exactly the people it exists to inform.
    expect(isBelowMinimum("1.0.0", null)).toBe(false);
    expect(isBelowMinimum("1.0.0", "")).toBe(false);
  });

  it("lets a caller with no version through", () => {
    // Every build shipped before the header existed sends nothing, and so
    // does the CMS, a webhook, a partner postback and curl. Refusing them
    // would turn a safety net into an outage.
    expect(isBelowMinimum(null, "2.4.3")).toBe(false);
    expect(isBelowMinimum(undefined, "2.4.3")).toBe(false);
  });

  it("lets an unreadable version through rather than guessing", () => {
    expect(isBelowMinimum("unknown", "2.4.3")).toBe(false);
  });

  it("refuses to enforce a floor it cannot parse", () => {
    // A typo in the env var must not lock out every user.
    expect(isBelowMinimum("1.0.0", "not-a-version")).toBe(false);
  });
});
