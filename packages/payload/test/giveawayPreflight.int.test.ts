import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { BasePayload } from "payload";

import { GiveawayEngine } from "../src/lib/giveaway/GiveawayEngine";
import { getTestPayload, resetGiveawayTables } from "./helpers/testPayload";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const DRAW_REFUSED = /Draw cannot start/;
const SLOT_HOLDER = "Holder of the slot";
const NAMES_SLOT_HOLDER = new RegExp(SLOT_HOLDER);
const ONLY_ONE_ACTIVE = /only one giveaway may be active/i;

let payload: BasePayload;

const engine = () =>
  new GiveawayEngine(payload, {
    // No draw here ever gets far enough to report. Injected anyway: a
    // regression that let one through would otherwise hold a live sender.
    reportSender: async () => ({ id: null }),
  });

// The first boot pushes the whole schema, which takes far longer than the
// default hook timeout allows.
beforeAll(async () => {
  payload = await getTestPayload();
}, 180_000);

beforeEach(async () => {
  await resetGiveawayTables(payload);
});

let userCount = 0;

async function createUser(): Promise<string> {
  userCount += 1;
  const doc = await payload.create({
    collection: "users",
    data: {
      name: `Preflight Participant ${userCount}`,
      username: `preflight_${Date.now()}_${userCount}`,
      email: `preflight_${Date.now()}_${userCount}@example.invalid`,
      wish: "A draw that refuses cleanly",
      phone: `081000000${userCount.toString().padStart(2, "0")}`,
    },
  });

  return String(doc.id);
}

/**
 * A giveaway an administrator opened and then never gave a prize pool to.
 *
 * This is the exact shape that wedged production: `active`, its countdown
 * already over so the scheduled task selects it, a tier enabled, and nothing
 * in `giveaway-prizes` for the engine to award. A participant and a valid
 * ticket are present so the empty pool is the only thing left to object to.
 */
async function createGiveawayWithoutPrizes(name?: string) {
  const giveaway = await payload.create({
    collection: "giveaways",
    data: {
      name: name ?? `Preflight giveaway ${Date.now()}`,
      status: "active",
      startDate: new Date(Date.now() - 8 * DAY).toISOString(),
      endDate: new Date(Date.now() - HOUR).toISOString(),
      ticketPrice: 50,
      minTicketsRequired: 1,
      tier1WinnerPercentage: 0,
      tier2WinnerPercentage: 0,
      tier3WinnerPercentage: 100,
      budgetUtilizationPct: 100,
    },
  });

  const userId = await createUser();
  await payload.create({
    collection: "giveaway-tickets",
    data: {
      giveaway: giveaway.id,
      user: userId,
      quantity: 1,
      unitPrice: 50,
      purchasedAt: new Date(Date.now() - DAY).toISOString(),
      status: "valid",
    },
  });

  return String(giveaway.id);
}

const readGiveaway = (id: string) =>
  payload.findByID({ collection: "giveaways", id, depth: 0 });

describe("a draw refused before it starts", () => {
  /**
   * The assertion this file exists for.
   *
   * The refusal is thrown before `beginAttempt`, so the try/catch that calls
   * `stopAttempt` never runs. Before the fix nothing was written at all: the
   * giveaway stayed `active`, the scheduled task re-selected it on the next
   * run and failed identically, and `drawError` stayed empty so the CMS showed
   * no reason. "August Test" sat that way for five days.
   */
  test("moves the giveaway to failed and records why", async () => {
    const giveawayId = await createGiveawayWithoutPrizes();

    await expect(engine().runDraw(giveawayId)).rejects.toThrow(DRAW_REFUSED);

    const giveaway = await readGiveaway(giveawayId);
    expect(giveaway.status).toBe("failed");
    expect(giveaway.drawError).toContain("Prize Pool is empty");
  }, 120_000);

  /**
   * The consequence that actually hurt: `processGiveaway` selects on `active`
   * plus a passed `endDate`, so a giveaway left `active` is picked up for ever.
   * This asserts against that query rather than the status alone, because the
   * query is what the loop was made of.
   */
  test("is no longer selected by the scheduled task", async () => {
    const giveawayId = await createGiveawayWithoutPrizes();

    await expect(engine().runDraw(giveawayId)).rejects.toThrow();

    const due = await payload.find({
      collection: "giveaways",
      where: {
        and: [
          { status: { equals: "active" } },
          { endDate: { less_than_equal: new Date().toISOString() } },
        ],
      },
      pagination: false,
      depth: 0,
    });

    expect(due.docs.map((d) => String(d.id))).not.toContain(giveawayId);
  }, 120_000);

  /**
   * `failed` is not in `LOCKED_GIVEAWAY_STATUSES`, which is the whole reason it
   * was chosen over `interrupted`: the administrator has to be able to add the
   * prizes that were missing and open the giveaway again. If a future change
   * locks `failed`, that recovery path closes and the fix stops being one.
   */
  test("leaves the giveaway editable so it can be reopened", async () => {
    const giveawayId = await createGiveawayWithoutPrizes();

    await expect(engine().runDraw(giveawayId)).rejects.toThrow();

    const reopened = await payload.update({
      collection: "giveaways",
      id: giveawayId,
      data: { status: "active", ticketPrice: 75 },
    });

    expect(reopened.status).toBe("active");
    expect(reopened.ticketPrice).toBe(75);
  }, 120_000);

  /**
   * The manual Run Draw button passes `recordValidationFailure: false`. An
   * administrator pressing it reads the refusal in the response, so flipping
   * the giveaway to `failed` would only make them reopen it before they could
   * fix the pool and press it again.
   */
  test("leaves the status alone when the caller opts out", async () => {
    const giveawayId = await createGiveawayWithoutPrizes();

    await expect(
      engine().runDraw(giveawayId, { recordValidationFailure: false })
    ).rejects.toThrow(DRAW_REFUSED);

    const giveaway = await readGiveaway(giveawayId);
    expect(giveaway.status).toBe("active");
    expect(giveaway.drawError).toBeFalsy();
  }, 120_000);
});

describe("activating a second giveaway", () => {
  /**
   * The refusal itself is old; what it said was the problem.
   * `ValidationError` composes its message from the field path and drops the
   * per-error text, so the administrator got "The following field is invalid:
   * status" and no way to tell which giveaway held the slot. The name is the
   * one fact that resolves the situation, so it is what this asserts on.
   */
  test("names the giveaway already holding the slot", async () => {
    await createGiveawayWithoutPrizes(SLOT_HOLDER);

    const attempt = payload.create({
      collection: "giveaways",
      data: {
        name: "The one that cannot start yet",
        status: "active",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + DAY).toISOString(),
        ticketPrice: 50,
        minTicketsRequired: 1,
        tier1WinnerPercentage: 0,
        tier2WinnerPercentage: 0,
        tier3WinnerPercentage: 100,
        budgetUtilizationPct: 100,
      },
    });

    await expect(attempt).rejects.toThrow(NAMES_SLOT_HOLDER);
    await expect(attempt).rejects.toThrow(ONLY_ONE_ACTIVE);
  }, 120_000);

  /**
   * The clash check is scoped to a transition *into* `active`. A giveaway that
   * is already active must stay editable, or an administrator could not
   * correct a typo without first standing the draw down.
   */
  test("does not block edits to the giveaway that already holds it", async () => {
    const giveawayId = await createGiveawayWithoutPrizes("Already active");

    const updated = await payload.update({
      collection: "giveaways",
      id: giveawayId,
      data: { description: "Edited while active" },
    });

    expect(updated.status).toBe("active");
    expect(updated.description).toBe("Edited while active");
  }, 120_000);
});
