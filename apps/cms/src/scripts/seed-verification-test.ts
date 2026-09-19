/**
 * Set up the one part of the claim flow that has never run: identity
 * verification before dispatch (spec 15).
 *
 * Nothing anywhere (dev, staging or production) has ever had a prize with
 * `requiresVerification` set, so no winner has ever reached
 * `awaiting_verification` and the Didit hand-off has only ever been exercised
 * by unit tests. The tier 1 fixture deliberately uses points to keep the tier
 * eligibility test free of an address step, which was right for that test and
 * left this half uncovered.
 *
 * A PHYSICAL prize, because that is the combination the flag is actually for:
 * the catalogue's own guidance is "high-value items, not airtime or points",
 * and because it exercises the address step at the same time, which is the
 * other untested half of a physical claim.
 *
 * TIER 3 on purpose. The section 22 cooldowns bar only tiers 1 and 2, so a tester who
 * has already won recently stays eligible here; at tier 1 they would be
 * excluded by 22.2 and the draw would award nothing.
 *
 * Usage, from apps/cms. Note this needs the DIDIT_* variables, because the
 * catalogue refuses `requiresVerification` when no provider is configured:
 *
 *   railway run -e staging -s cms -- \
 *     bash -c 'DATABASE_URI="$DATABASE_PUBLIC_URL" NODE_ENV=production \
 *       bun run src/scripts/seed-verification-test.ts --write'
 */

import { getPayload } from "@news-spend-media/payload";

const WRITE = process.argv.includes("--write");

const PRIZE_NAME = "Test Physical Prize: Verification";

async function main() {
  const payload = await getPayload();

  console.log(`\n${WRITE ? "WRITE" : "DRY RUN: nothing will be changed"}\n`);

  // --- The prize ---------------------------------------------------------

  const existing = await payload.find({
    collection: "prize-catalogue",
    where: { name: { equals: PRIZE_NAME } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  let prizeId = existing.docs[0]?.id ? String(existing.docs[0].id) : null;

  if (prizeId) {
    console.log(`  exists   prize      ${PRIZE_NAME}`);
  } else if (WRITE) {
    const created = await payload.create({
      collection: "prize-catalogue",
      data: {
        name: PRIZE_NAME,
        tier: "tier3",
        fulfilmentType: "physical",
        description:
          "A stand-in for a high-value item. Exists to exercise the address step and the identity check before dispatch.",
        valueNaira: 25_000,
        requiresVerification: true,
        active: true,
      },
    });
    prizeId = String(created.id);
    console.log(`  created  prize      ${PRIZE_NAME} (physical, verified)`);
  } else {
    console.log(`  create   prize      ${PRIZE_NAME} (physical, verified)`);
  }

  // --- The giveaway it goes into ----------------------------------------

  const active = await payload.find({
    collection: "giveaways",
    where: { status: { equals: "active" } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  const giveaway = active.docs[0];
  if (!giveaway) {
    console.log("\n  No active giveaway. Create one first.\n");
    return;
  }

  console.log(`\n  target   giveaway   ${giveaway.name}`);

  const pool = await payload.find({
    collection: "giveaway-prizes",
    where: { giveaway: { equals: giveaway.id } },
    pagination: false,
    depth: 0,
  });

  const pooled = new Set(
    pool.docs.map((row) =>
      typeof row.prize === "string" ? row.prize : String(row.prize?.id)
    )
  );

  /**
   * Tiers 1 and 2 are stocked only so the draw can start at all. It refuses
   * any enabled tier with an empty pool. At 0.1% and 0.5% neither awards
   * anything with a handful of participants, which is the intent: this test is
   * about tier 3.
   */
  for (const [tier, name] of [
    ["tier1", "5,000 Dream Points"],
    ["tier2", "1,500 Dream Points"],
  ] as const) {
    const found = await payload.find({
      collection: "prize-catalogue",
      where: { name: { equals: name } },
      limit: 1,
      pagination: false,
      depth: 0,
    });
    const id = found.docs[0]?.id ? String(found.docs[0].id) : null;
    if (!id) {
      console.log(
        `  MISSING  prize      ${name}. Run seed-giveaway-fixtures first.`
      );
      continue;
    }
    if (pooled.has(id)) {
      console.log(`  exists   pool       ${name} (${tier})`);
      continue;
    }
    if (!WRITE) {
      console.log(`  add      pool       ${name} (${tier})`);
      continue;
    }
    await payload.create({
      collection: "giveaway-prizes",
      data: { giveaway: giveaway.id, prize: id, tier, maxUnits: 5 },
    });
    console.log(`  added    pool       ${name} (${tier})`);
  }

  // Tier 3 holds ONLY the verification prize, so the draw cannot award
  // something else instead and leave the flag untested again.
  if (prizeId && !pooled.has(prizeId)) {
    if (WRITE) {
      await payload.create({
        collection: "giveaway-prizes",
        data: {
          giveaway: giveaway.id,
          prize: prizeId,
          tier: "tier3",
          maxUnits: 5,
        },
      });
      console.log(`  added    pool       ${PRIZE_NAME} (tier3) ×5`);
    } else {
      console.log(`  add      pool       ${PRIZE_NAME} (tier3) ×5`);
    }
  }

  /**
   * 100% so every eligible entrant wins one.
   *
   * Wrong for a real giveaway and right for this: the point is to reach the
   * verification flow deterministically, not to sample. At the default 5% a
   * two-person draw awards nothing at all.
   */
  if (Number(giveaway.tier3WinnerPercentage) !== 100) {
    if (WRITE) {
      await payload.update({
        collection: "giveaways",
        id: giveaway.id,
        data: { tier3WinnerPercentage: 100 },
      });
      console.log(
        `  set      tier3      100% (was ${giveaway.tier3WinnerPercentage}%)`
      );
    } else {
      console.log(
        `  set      tier3      100% (currently ${giveaway.tier3WinnerPercentage}%)`
      );
    }
  }

  if (WRITE) {
    console.log("\n  Ready. Run the draw, then claim in the app.\n");
  } else {
    console.log("\nRe-run with --write to apply.\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
