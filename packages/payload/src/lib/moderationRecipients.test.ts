import { describe, expect, it } from "vitest";

import {
  type AdminRecord,
  applyRecipientFloor,
  parseExtraEmails,
  selectRecipients,
} from "./moderationRecipients";
import { applySettingsDefaults } from "./moderationSettings";

// Defaults stand in for an unconfigured Moderation Settings global.
const defaults = applySettingsDefaults(null);

const admin = (over: Partial<AdminRecord> = {}): AdminRecord => ({
  email: "a@example.com",
  role: "viewer",
  ...over,
});

describe("selectRecipients", () => {
  describe("role defaults (no explicit preference)", () => {
    it("includes super-admins and content-managers", () => {
      const admins = [
        admin({ email: "super@x.com", role: "super-admin" }),
        admin({ email: "cm@x.com", role: "content-manager" }),
      ];

      expect(selectRecipients(admins, "urgent", defaults)).toEqual([
        "super@x.com",
        "cm@x.com",
      ]);
      expect(selectRecipients(admins, "digest", defaults)).toHaveLength(2);
    });

    it("excludes editors and viewers", () => {
      const admins = [
        admin({ email: "ed@x.com", role: "editor" }),
        admin({ email: "vw@x.com", role: "viewer" }),
      ];

      expect(selectRecipients(admins, "urgent", defaults)).toEqual([]);
      expect(selectRecipients(admins, "digest", defaults)).toEqual([]);
    });
  });

  describe("explicit preferences", () => {
    it("honours an opt-in from a role that gets nothing by default", () => {
      const admins = [
        admin({ email: "ed@x.com", role: "editor", moderationAlerts: "all" }),
      ];

      expect(selectRecipients(admins, "urgent", defaults)).toEqual([
        "ed@x.com",
      ]);
      expect(selectRecipients(admins, "digest", defaults)).toEqual([
        "ed@x.com",
      ]);
    });

    it("honours an opt-out from a role that gets everything by default", () => {
      const admins = [
        admin({
          email: "super@x.com",
          role: "super-admin",
          moderationAlerts: "none",
        }),
      ];

      expect(selectRecipients(admins, "urgent", defaults)).toEqual([]);
      expect(selectRecipients(admins, "digest", defaults)).toEqual([]);
    });

    it("routes urgent-only and digest-only to the right tier", () => {
      const admins = [
        admin({ email: "u@x.com", role: "viewer", moderationAlerts: "urgent" }),
        admin({ email: "d@x.com", role: "viewer", moderationAlerts: "digest" }),
      ];

      expect(selectRecipients(admins, "urgent", defaults)).toEqual(["u@x.com"]);
      expect(selectRecipients(admins, "digest", defaults)).toEqual(["d@x.com"]);
    });
  });

  describe("partners", () => {
    it("never receives moderation email, even when opted in", () => {
      // Reports quote user content and identify reporters; partners are
      // external parties, so an explicit opt-in must not override this.
      const admins = [
        admin({ email: "p@x.com", role: "partner", moderationAlerts: "all" }),
      ];

      expect(selectRecipients(admins, "urgent", defaults)).toEqual([]);
      expect(selectRecipients(admins, "digest", defaults)).toEqual([]);
    });
  });

  describe("hygiene", () => {
    it("skips admins with no email", () => {
      const admins = [admin({ email: null, role: "super-admin" })];
      expect(selectRecipients(admins, "digest", defaults)).toEqual([]);
    });

    it("appends extra addresses from config", () => {
      const admins = [admin({ email: "super@x.com", role: "super-admin" })];

      expect(
        selectRecipients(admins, "urgent", defaults, ["oncall@x.com"])
      ).toEqual(["super@x.com", "oncall@x.com"]);
    });

    it("dedupes case-insensitively", () => {
      const admins = [
        admin({ email: "Super@X.com", role: "super-admin" }),
        admin({ email: "super@x.com", role: "content-manager" }),
      ];

      expect(
        selectRecipients(admins, "digest", defaults, ["SUPER@X.COM"])
      ).toEqual(["Super@X.com"]);
    });

    it("returns an empty list when nobody is configured", () => {
      expect(selectRecipients([], "urgent", defaults)).toEqual([]);
    });
  });

  describe("driven by the Moderation Settings global", () => {
    it("uses the roles configured there instead of the built-in default", () => {
      const settings = applySettingsDefaults({ alertRoles: ["editor"] });
      const admins = [
        admin({ email: "ed@x.com", role: "editor" }),
        admin({ email: "super@x.com", role: "super-admin" }),
      ];

      // super-admin is only a default; once roles are configured it no longer
      // applies unless explicitly listed.
      expect(selectRecipients(admins, "digest", settings)).toEqual([
        "ed@x.com",
      ]);
    });

    it("still lets an individual admin override the configured roles", () => {
      const settings = applySettingsDefaults({ alertRoles: ["editor"] });
      const admins = [
        admin({ email: "ed@x.com", role: "editor", moderationAlerts: "none" }),
        admin({ email: "vw@x.com", role: "viewer", moderationAlerts: "all" }),
      ];

      expect(selectRecipients(admins, "digest", settings)).toEqual([
        "vw@x.com",
      ]);
    });

    it("includes additional recipients, respecting their tier", () => {
      const settings = applySettingsDefaults({
        additionalRecipients: [
          { email: "all@x.com", tier: "all" },
          { email: "urgent@x.com", tier: "urgent" },
          { email: "digest@x.com", tier: "digest" },
        ],
      });

      expect(selectRecipients([], "urgent", settings)).toEqual([
        "all@x.com",
        "urgent@x.com",
      ]);
      expect(selectRecipients([], "digest", settings)).toEqual([
        "all@x.com",
        "digest@x.com",
      ]);
    });

    it("never routes to a partner even via configured roles", () => {
      const settings = applySettingsDefaults({ alertRoles: ["partner"] });
      const admins = [admin({ email: "p@x.com", role: "partner" })];

      expect(selectRecipients(admins, "digest", settings)).toEqual([]);
    });
  });
});

describe("applyRecipientFloor", () => {
  it("leaves a non-empty selection untouched", () => {
    const admins = [admin({ email: "super@x.com", role: "super-admin" })];

    expect(applyRecipientFloor(admins, ["someone@x.com"])).toEqual({
      recipients: ["someone@x.com"],
      floorEngaged: false,
    });
  });

  it("notifies super-admins when everyone has opted out", () => {
    // The case that motivated this: a single super-admin sets themselves to
    // None and silently disables the entire moderation notification path.
    const admins = [
      admin({
        email: "super@x.com",
        role: "super-admin",
        moderationAlerts: "none",
      }),
    ];
    const settings = applySettingsDefaults(null);

    const selected = selectRecipients(admins, "urgent", settings);
    expect(selected).toEqual([]);

    expect(applyRecipientFloor(admins, selected)).toEqual({
      recipients: ["super@x.com"],
      floorEngaged: true,
    });
  });

  it("does not engage while any other recipient remains", () => {
    const admins = [
      admin({
        email: "super@x.com",
        role: "super-admin",
        moderationAlerts: "none",
      }),
      admin({ email: "cm@x.com", role: "content-manager" }),
    ];
    const settings = applySettingsDefaults(null);

    const selected = selectRecipients(admins, "digest", settings);
    const result = applyRecipientFloor(admins, selected);

    // The opt-out is still honoured; the floor is about total silence only.
    expect(result).toEqual({ recipients: ["cm@x.com"], floorEngaged: false });
  });

  it("does not engage when a shared inbox still covers the tier", () => {
    const admins = [
      admin({
        email: "super@x.com",
        role: "super-admin",
        moderationAlerts: "none",
      }),
    ];
    const settings = applySettingsDefaults({
      additionalRecipients: [{ email: "ops@x.com", tier: "all" }],
    });

    const selected = selectRecipients(admins, "urgent", settings);
    const result = applyRecipientFloor(admins, selected);

    expect(result).toEqual({ recipients: ["ops@x.com"], floorEngaged: false });
  });

  it("never falls back to a partner", () => {
    const admins = [
      admin({ email: "p@x.com", role: "partner", moderationAlerts: "all" }),
    ];

    expect(applyRecipientFloor(admins, [])).toEqual({
      recipients: [],
      floorEngaged: false,
    });
  });

  it("does not fall back to non-super-admin roles", () => {
    const admins = [
      admin({
        email: "cm@x.com",
        role: "content-manager",
        moderationAlerts: "none",
      }),
      admin({ email: "ed@x.com", role: "editor" }),
    ];

    expect(applyRecipientFloor(admins, [])).toEqual({
      recipients: [],
      floorEngaged: false,
    });
  });

  it("reports no floor when there is genuinely nobody to fall back to", () => {
    expect(applyRecipientFloor([], [])).toEqual({
      recipients: [],
      floorEngaged: false,
    });
  });
});

describe("parseExtraEmails", () => {
  it("splits, trims and drops blanks", () => {
    expect(parseExtraEmails(" a@x.com , b@x.com ,, ")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });

  it("returns nothing when unset", () => {
    expect(parseExtraEmails(undefined)).toEqual([]);
    expect(parseExtraEmails("")).toEqual([]);
  });
});
