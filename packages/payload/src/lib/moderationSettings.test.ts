import { describe, expect, it } from "vitest";

import { DEFAULT_AUTO_HIDE_THRESHOLD } from "./moderationLabels";
import { applySettingsDefaults } from "./moderationSettings";

describe("applySettingsDefaults", () => {
  describe("when the global is unset", () => {
    it("falls back to code defaults", () => {
      const s = applySettingsDefaults(null);

      expect([...s.alertRoles].sort()).toEqual([
        "content-manager",
        "super-admin",
      ]);
      expect(s.autoHideThreshold).toBe(DEFAULT_AUTO_HIDE_THRESHOLD);
      expect(s.hideOnFirstReportReasons.has("hate-speech")).toBe(true);
      expect(s.urgentReasons.has("harassment")).toBe(true);
      expect(s.additionalRecipients).toEqual([]);
    });
  });

  describe("empty vs configured", () => {
    it("treats empty arrays as unset", () => {
      // Payload writes [] for an untouched hasMany select the moment the form
      // is saved. Saving the global without touching a field must not silently
      // disable that behaviour.
      const s = applySettingsDefaults({
        alertRoles: [],
        urgentReasons: [],
        hideOnFirstReportReasons: [],
      });

      expect(s.alertRoles.size).toBe(2);
      expect(s.urgentReasons.size).toBeGreaterThan(0);
      expect(s.hideOnFirstReportReasons.size).toBeGreaterThan(0);
    });

    it("uses configured values when present", () => {
      const s = applySettingsDefaults({
        alertRoles: ["editor"],
        urgentReasons: ["spam"],
        hideOnFirstReportReasons: ["illegal"],
      });

      expect([...s.alertRoles]).toEqual(["editor"]);
      expect([...s.urgentReasons]).toEqual(["spam"]);
      expect([...s.hideOnFirstReportReasons]).toEqual(["illegal"]);
    });
  });

  describe("autoHideThreshold", () => {
    it("accepts a configured value", () => {
      expect(
        applySettingsDefaults({ autoHideThreshold: 7 }).autoHideThreshold
      ).toBe(7);
    });

    it("rejects values below 1, which would hide on every report", () => {
      for (const bad of [0, -5]) {
        expect(
          applySettingsDefaults({ autoHideThreshold: bad }).autoHideThreshold
        ).toBe(DEFAULT_AUTO_HIDE_THRESHOLD);
      }
    });

    it("falls back when null", () => {
      expect(
        applySettingsDefaults({ autoHideThreshold: null }).autoHideThreshold
      ).toBe(DEFAULT_AUTO_HIDE_THRESHOLD);
    });
  });

  describe("additionalRecipients", () => {
    it("normalizes entries and defaults the tier to all", () => {
      const s = applySettingsDefaults({
        additionalRecipients: [{ email: "  ops@x.com  " }],
      });

      expect(s.additionalRecipients).toEqual([
        { email: "ops@x.com", tier: "all" },
      ]);
    });

    it("drops entries with no email", () => {
      const s = applySettingsDefaults({
        additionalRecipients: [{ email: "" }, { email: null, tier: "urgent" }],
      });

      expect(s.additionalRecipients).toEqual([]);
    });
  });
});
