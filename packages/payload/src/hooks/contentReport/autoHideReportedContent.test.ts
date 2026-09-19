import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTO_HIDE_REPORT_THRESHOLD,
  autoHideReportedContent,
} from "./autoHideReportedContent";

type Report = { reportedBy: string | { id: string } };

function makeReq(options: {
  moderationStatus?: string | null;
  reports?: Report[];
  findByIDRejects?: boolean;
  /** Stands in for the Moderation Settings global; null means unconfigured. */
  settings?: Record<string, unknown> | null;
}) {
  const update = vi.fn().mockResolvedValue({});
  const find = vi.fn().mockResolvedValue({ docs: options.reports ?? [] });
  const findGlobal = vi.fn().mockResolvedValue(options.settings ?? null);
  const findByID = options.findByIDRejects
    ? vi.fn().mockRejectedValue(new Error("boom"))
    : vi.fn().mockResolvedValue({
        id: "comment-1",
        moderationStatus:
          options.moderationStatus === undefined
            ? "visible"
            : options.moderationStatus,
      });

  return {
    payload: {
      findByID,
      find,
      findGlobal,
      update,
      logger: { warn: vi.fn(), error: vi.fn() },
    },
  };
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    reason: "spam",
    reportedItem: { relationTo: "comments", value: "comment-1" },
    ...overrides,
  };
}

// The hook is typed as a Payload CollectionAfterChangeHook; tests drive it with
// just the fields it reads.
const runHook = (args: {
  doc: unknown;
  operation?: string;
  req: ReturnType<typeof makeReq>;
}) =>
  (
    autoHideReportedContent as unknown as (a: {
      doc: unknown;
      operation: string;
      req: unknown;
    }) => Promise<void>
  )({
    doc: args.doc,
    operation: args.operation ?? "create",
    req: args.req,
  });

const reporters = (count: number): Report[] =>
  Array.from({ length: count }, (_, i) => ({ reportedBy: `user-${i}` }));

describe("autoHideReportedContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores updates, acting only on newly created reports", async () => {
    const req = makeReq({ reports: reporters(10) });
    await runHook({ doc: makeDoc(), operation: "update", req });

    expect(req.payload.update).not.toHaveBeenCalled();
    expect(req.payload.findByID).not.toHaveBeenCalled();
  });

  it("ignores reports against news rather than comments", async () => {
    const req = makeReq({ reports: reporters(10) });
    await runHook({
      doc: makeDoc({ reportedItem: { relationTo: "news", value: "news-1" } }),
      req,
    });

    expect(req.payload.update).not.toHaveBeenCalled();
  });

  it("ignores user-level reports with no reportedItem (e.g. blocks)", async () => {
    const req = makeReq({ reports: reporters(10) });
    await runHook({ doc: makeDoc({ reportedItem: null }), req });

    expect(req.payload.update).not.toHaveBeenCalled();
  });

  it("does not hide below the threshold", async () => {
    const req = makeReq({
      reports: reporters(AUTO_HIDE_REPORT_THRESHOLD - 1),
    });
    await runHook({ doc: makeDoc(), req });

    expect(req.payload.update).not.toHaveBeenCalled();
  });

  it("hides once the threshold of distinct reporters is reached", async () => {
    const req = makeReq({ reports: reporters(AUTO_HIDE_REPORT_THRESHOLD) });
    await runHook({ doc: makeDoc(), req });

    expect(req.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "comments",
        id: "comment-1",
        data: { moderationStatus: "hidden" },
      })
    );
  });

  it("counts distinct reporters, not raw report count", async () => {
    // One determined user reporting repeatedly must not bury a comment.
    const req = makeReq({
      reports: Array.from({ length: AUTO_HIDE_REPORT_THRESHOLD + 5 }, () => ({
        reportedBy: "same-user",
      })),
    });
    await runHook({ doc: makeDoc(), req });

    expect(req.payload.update).not.toHaveBeenCalled();
  });

  it("handles populated relationship objects as reporter ids", async () => {
    const req = makeReq({
      reports: Array.from({ length: AUTO_HIDE_REPORT_THRESHOLD }, (_, i) => ({
        reportedBy: { id: `user-${i}` },
      })),
    });
    await runHook({ doc: makeDoc(), req });

    expect(req.payload.update).toHaveBeenCalled();
  });

  it("excludes dismissed reports from the count", async () => {
    const req = makeReq({ reports: reporters(AUTO_HIDE_REPORT_THRESHOLD) });
    await runHook({ doc: makeDoc(), req });

    expect(req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not_equals: "dismissed" },
        }),
      })
    );
  });

  for (const reason of ["illegal", "hate-speech", "inappropriate"]) {
    it(`hides on a single report for "${reason}"`, async () => {
      const req = makeReq({ reports: [] });
      await runHook({ doc: makeDoc({ reason }), req });

      expect(req.payload.update).toHaveBeenCalled();
      // Severe reasons short-circuit: no need to count reporters at all.
      expect(req.payload.find).not.toHaveBeenCalled();
    });
  }

  it("does not hide on a single report for a non-severe reason", async () => {
    // "harassment" triggers an *urgent admin alert* but is deliberately not in
    // the hide-on-first-report set; the two lists are not the same.
    const req = makeReq({ reports: reporters(1) });
    await runHook({ doc: makeDoc({ reason: "harassment" }), req });

    expect(req.payload.update).not.toHaveBeenCalled();
  });

  it("treats legacy comments with a null status as hideable", async () => {
    // Comments created before moderationStatus existed have NULL, and must not
    // become permanently immune to moderation.
    const req = makeReq({
      moderationStatus: null,
      reports: reporters(AUTO_HIDE_REPORT_THRESHOLD),
    });
    await runHook({ doc: makeDoc(), req });

    expect(req.payload.update).toHaveBeenCalled();
  });

  for (const status of ["hidden", "removed"]) {
    it(`leaves an already-${status} comment untouched`, async () => {
      const req = makeReq({
        moderationStatus: status,
        reports: reporters(AUTO_HIDE_REPORT_THRESHOLD),
      });
      await runHook({ doc: makeDoc(), req });

      expect(req.payload.update).not.toHaveBeenCalled();
    });
  }

  describe("Moderation Settings global", () => {
    it("honours a raised threshold", async () => {
      const req = makeReq({
        settings: { autoHideThreshold: 5 },
        reports: reporters(4),
      });
      await runHook({ doc: makeDoc(), req });

      expect(req.payload.update).not.toHaveBeenCalled();
    });

    it("honours a lowered threshold", async () => {
      const req = makeReq({
        settings: { autoHideThreshold: 2 },
        reports: reporters(2),
      });
      await runHook({ doc: makeDoc(), req });

      expect(req.payload.update).toHaveBeenCalled();
    });

    it("honours configured hide-on-first-report reasons", async () => {
      // "spam" is not severe by default; configuring it makes one report enough.
      const req = makeReq({
        settings: { hideOnFirstReportReasons: ["spam"] },
        reports: [],
      });
      await runHook({ doc: makeDoc({ reason: "spam" }), req });

      expect(req.payload.update).toHaveBeenCalled();
      expect(req.payload.find).not.toHaveBeenCalled();
    });

    it("stops hiding on first report for a reason removed from the list", async () => {
      const req = makeReq({
        settings: { hideOnFirstReportReasons: ["spam"] },
        reports: reporters(1),
      });
      await runHook({ doc: makeDoc({ reason: "hate-speech" }), req });

      expect(req.payload.update).not.toHaveBeenCalled();
    });

    it("falls back to defaults when the global cannot be read", async () => {
      const req = makeReq({ reports: reporters(AUTO_HIDE_REPORT_THRESHOLD) });
      req.payload.findGlobal.mockRejectedValue(new Error("no global"));

      await runHook({ doc: makeDoc(), req });

      expect(req.payload.update).toHaveBeenCalled();
    });
  });

  it("swallows errors so a failed hide never fails the user's report", async () => {
    const req = makeReq({ findByIDRejects: true });

    await expect(runHook({ doc: makeDoc(), req })).resolves.toBeUndefined();
    expect(req.payload.logger.error).toHaveBeenCalled();
  });
});
