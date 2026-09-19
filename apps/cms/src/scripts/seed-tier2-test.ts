/**
 * A giveaway that can only ever award Tier 2.
 *
 * Tier 2 is the one tier no draw has ever awarded, anywhere. Tier 1 was proven
 * with a dedicated fixture and Tier 3 by every other test; Tier 2 sat between
 * them, its eligibility path (11) never once walked end to end.
 *
 * TIERS 1 AND 3 ARE SET TO ZERO, which is what makes this a test of Tier 2
 * rather than a draw that happens to include it. A tier at 0% is skipped
 * entirely and needs no prize pool, so the only prize that can leave this
 * giveaway is the Tier 2 one; if anything else is awarded, the tier routing
 * is wrong, and that is worth knowing.
 *
 * Tier 2 at 100% because the point is to reach the tier deterministically with
 * a couple of participants, not to sample. At the specification's 0.5% a draw
 * would need 200 entrants to award a single prize.
 *
 * WHAT IT CANNOT DO FOR YOU. Eligibility is earned in the app and nowhere
 * else: 4 valid tickets, 2 boosts and 1 Featured Offer conversion, all within
 * this giveaway. Seeding those directly would prove only that rows can be
 * written. The whole value of the test is that the counters are driven by real
 * engagement, so the draw is reading what the app actually recorded.
 *
 * Usage, from apps/cms:
 *
 *   railway run -e staging -s CMS -- bash -c \
 *     'DATABASE_URI="$DATABASE_PUBLIC_URL" NODE_ENV=production \
 *      bun run src/scripts/seed-tier2-test.ts --write'
 */

import { getPayload } from "@news-spend-media/payload";

const WRITE = process.argv.includes("--write");
const PRIZE_NAME = "1,500 Dream Points";

async function main() {
  const payload = await getPayload();

  console.log(`\n${WRITE ? "WRITE" : "DRY RUN: nothing will be changed"}\n`);

  const active = await payload.find({
    collection: "giveaways",
    where: { status: { equals: "active" } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  if (active.docs[0]) {
    console.log(
      `  refused  "${active.docs[0].name}" is already active. Only one giveaway may be active at a time.\n`
    );
    return;
  }

  const found = await payload.find({
    collection: "prize-catalogue",
    where: { name: { equals: PRIZE_NAME } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  const prize = found.docs[0];
  if (!prize) {
    console.log(
      `  MISSING  ${PRIZE_NAME} is not in the catalogue; run seed-giveaway-fixtures first.\n`
    );
    return;
  }

  if (!WRITE) {
    console.log(
      "  create   giveaway   Tier 2 test, tier2 100%, tiers 1 and 3 off"
    );
    console.log(`  add      pool       ${PRIZE_NAME} (tier2) x5`);
    console.log("\nRe-run with --write to apply.\n");
    return;
  }

  const now = Date.now();
  const giveaway = await payload.create({
    collection: "giveaways",
    data: {
      name: `Tier 2 test: ${new Date().toISOString().slice(0, 10)}`,
      status: "active",
      startDate: new Date(now - HOUR).toISOString(),
      endDate: new Date(now + 7 * 24 * HOUR).toISOString(),
      ticketPrice: 50,
      minTicketsRequired: 1,
      tier1WinnerPercentage: 0,
      tier2WinnerPercentage: 100,
      tier3WinnerPercentage: 0,
      budgetUtilizationPct: 100,
    },
  });

  await payload.create({
    collection: "giveaway-prizes",
    data: {
      giveaway: giveaway.id,
      prize: prize.id,
      tier: "tier2",
      maxUnits: 5,
    },
  });

  console.log(`  created  giveaway   ${giveaway.name}`);
  console.log(`  added    pool       ${PRIZE_NAME} (tier2) x5`);
  console.log(`\n  id: ${giveaway.id}`);
  console.log(
    "\n  Tier 2 needs, in this giveaway: 4 valid tickets, 2 boosts, 1 Featured Offer.\n"
  );
}

const HOUR = 3_600_000;

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
