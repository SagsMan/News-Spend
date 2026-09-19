import { describe, expect, it, mock } from "bun:test";

import {
  getBlockedUserIdsForNews,
  getReportedCommentIdsForNews,
  hasBlockedUser,
  hasReportedComment,
} from "./moderation-filters";

/**
 * `@payloadcms/db-postgres` runs on node-postgres, so drizzle's `execute`
 * resolves to a pg QueryResult; rows live under `.rows`. The array shape is
 * covered too, since other drivers return rows directly.
 */
function fakePayload(result: unknown) {
  const execute = mock(() => Promise.resolve(result));
  return {
    payload: { db: { drizzle: { execute } } } as never,
    execute,
  };
}

const pgResult = (rows: unknown[]) => ({ rows, rowCount: rows.length });

describe("getReportedCommentIdsForNews", () => {
  it("reads ids from a pg QueryResult", async () => {
    const { payload } = fakePayload(pgResult([{ id: "c1" }, { id: "c2" }]));

    expect(await getReportedCommentIdsForNews(payload, "u1", "n1")).toEqual([
      "c1",
      "c2",
    ]);
  });

  it("reads ids when the driver returns a bare array", async () => {
    const { payload } = fakePayload([{ id: "c1" }]);

    expect(await getReportedCommentIdsForNews(payload, "u1", "n1")).toEqual([
      "c1",
    ]);
  });

  it("returns an empty list when nothing matches", async () => {
    const { payload } = fakePayload(pgResult([]));

    expect(await getReportedCommentIdsForNews(payload, "u1", "n1")).toEqual([]);
  });

  it("drops null and non-string ids rather than passing them into a query", async () => {
    // A polymorphic rels row can carry a null comments_id when the report
    // targets news instead; feeding that into `not_in` would break the filter.
    const { payload } = fakePayload(
      pgResult([{ id: "c1" }, { id: null }, { id: 42 }])
    );

    expect(await getReportedCommentIdsForNews(payload, "u1", "n1")).toEqual([
      "c1",
    ]);
  });

  it("tolerates a malformed driver response", async () => {
    for (const bad of [null, undefined, {}, { rows: null }]) {
      const { payload } = fakePayload(bad);
      expect(await getReportedCommentIdsForNews(payload, "u1", "n1")).toEqual(
        []
      );
    }
  });
});

describe("getBlockedUserIdsForNews", () => {
  it("reads ids from a pg QueryResult", async () => {
    const { payload } = fakePayload(pgResult([{ id: "u2" }]));

    expect(await getBlockedUserIdsForNews(payload, "u1", "n1")).toEqual(["u2"]);
  });

  it("returns an empty list when the viewer has blocked nobody here", async () => {
    const { payload } = fakePayload(pgResult([]));

    expect(await getBlockedUserIdsForNews(payload, "u1", "n1")).toEqual([]);
  });
});

describe("existence checks", () => {
  it("hasReportedComment reflects whether a row came back", async () => {
    const hit = fakePayload(pgResult([{ id: 1 }]));
    const miss = fakePayload(pgResult([]));

    expect(await hasReportedComment(hit.payload, "u1", "c1")).toBe(true);
    expect(await hasReportedComment(miss.payload, "u1", "c1")).toBe(false);
  });

  it("hasBlockedUser reflects whether a row came back", async () => {
    const hit = fakePayload(pgResult([{ id: 1 }]));
    const miss = fakePayload(pgResult([]));

    expect(await hasBlockedUser(hit.payload, "u1", "u2")).toBe(true);
    expect(await hasBlockedUser(miss.payload, "u1", "u2")).toBe(false);
  });

  it("issues one query per check", async () => {
    const { payload, execute } = fakePayload(pgResult([]));

    await hasBlockedUser(payload, "u1", "u2");

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
