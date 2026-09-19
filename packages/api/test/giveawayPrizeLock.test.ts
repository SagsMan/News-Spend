import { describe, expect, it } from "bun:test";
import { GiveawayPrizes } from "@news-spend-media/payload/collections/giveaway";

type Row = Record<string, any>;

/**
 * The prize-pool lock, exercised directly against the collection hook.
 *
 * The engine's own tests run on a fake Payload that never invokes collection
 * hooks, so the engine and this lock had never met until a real draw ran on a
 * real database, where the lock stopped the engine one write after the first
 * winner, and the draw could not complete. These tests put the two together.
 */
const hook = (GiveawayPrizes.hooks?.beforeValidate as any[])[0];

const PRIZE = { id: "p1", name: "500 Dream Points", tier: "tier3" };

function createReq({
  status,
  engine = false,
}: {
  status: string;
  engine?: boolean;
}) {
  return {
    context: engine ? { giveawayEngine: true } : {},
    payload: {
      findByID: async ({ collection, id }: Row) => {
        if (collection === "giveaways") {
          return { id, status };
        }
        if (collection === "prize-catalogue") {
          return PRIZE;
        }
        return null;
      },
      find: async () => ({ docs: [] }),
    },
  };
}

const args = (req: Row) => ({
  req,
  data: { giveaway: "g1", prize: "p1", unitsAwarded: 1 },
  originalDoc: { id: "row1", giveaway: "g1", prize: "p1" },
  operation: "update" as const,
});

/**
 * A Payload ValidationError says only "The following field is invalid: x" at
 * the top level; the sentence an administrator actually reads is inside its
 * errors array. Assert on that, or a test passes on the wrong refusal.
 */
async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const errors = (error as Row)?.data?.errors as Row[] | undefined;
    return errors?.[0]?.message ?? (error as Error).message;
  }
  throw new Error("expected the hook to refuse, but it resolved");
}

describe("giveaway-prizes pool lock", () => {
  it("refuses an administrator edit once the draw is running", async () => {
    const req = createReq({ status: "draw_in_progress" });

    expect(await refusal(hook(args(req)))).toBe(
      'The prize pool is locked because the giveaway is "draw_in_progress".'
    );
  });

  it("lets the engine record an allocation during that same draw", async () => {
    // A draw is `draw_in_progress` by definition while it awards prizes. If
    // the lock applied here too, no draw could ever get past its first winner.
    const req = createReq({ status: "draw_in_progress", engine: true });

    await expect(hook(args(req))).resolves.toBeDefined();
  });

  it("still refuses an administrator on every other locked status", async () => {
    for (const status of [
      "pool_building",
      "pool_locked",
      "interrupted",
      "resumption_authorized",
      "completed",
    ]) {
      const req = createReq({ status });
      expect(await refusal(hook(args(req)))).toContain(
        "The prize pool is locked"
      );
    }
  });

  it("allows an administrator to edit the pool before the draw begins", async () => {
    const req = createReq({ status: "active" });

    await expect(hook(args(req))).resolves.toBeDefined();
  });

  it("does not let the engine flag bypass the catalogue tier rule", async () => {
    // The exemption is for the lock alone. Everything section 4 enforces about which
    // tier a prize may be selected under still applies.
    const req = createReq({ status: "draw_in_progress", engine: true });

    const message = await refusal(
      hook({
        ...args(req),
        data: { giveaway: "g1", prize: "p1", tier: "tier1" },
      })
    );

    expect(message).toContain("cannot be selected under tier1");
  });
});
