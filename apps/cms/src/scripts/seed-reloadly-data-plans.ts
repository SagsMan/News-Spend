/**
 * Seed the Reloadly data plans on the Master Prize Catalogue (spec 15).
 *
 * A data bundle is provisioned by one network for that network's own SIMs, so
 * a data prize needs one row per network it should cover; see
 * `PrizeCatalogue.reloadlyDataPlans`. At fulfilment the winner's real network
 * is detected from their phone number and matched against these rows; a
 * network with no row here holds the prize for review rather than sending a
 * bundle that would not deliver.
 *
 * Until this script existed the plans were entered by hand into one developer's
 * database, which meant production had none at all and every data winner would
 * have gone to the hold queue. Keeping them here makes the mapping reviewable
 * in a diff and reproducible on any environment.
 *
 * HOW THE AMOUNTS WERE CHOSEN
 *
 * Each is a real fixed denomination from Reloadly's operator list, read from
 * `localFixedAmountsDescriptions` (naira, the local currency), not converted
 * from the account's CAD denomination and not inferred from the prize's
 * `valueNaira`. Data plans are fixed SKUs: a network sells 2.5GB for ₦600 or
 * 3GB for ₦800 and nothing in between, so an arbitrary amount is rejected.
 *
 * The rule is the cheapest bundle that delivers AT LEAST the promised volume.
 * Winners are told "2GB", so under-delivering to save a few naira breaks the
 * promise; over-delivering is merely generous. Where a network's closest plan
 * overshoots substantially that is the network's own pricing, not a mistake.
 *
 * Airtime prizes are deliberately absent. Airtime operators take a range
 * rather than fixed denominations, so `fulfilPrizes` falls back to the prize's
 * `valueNaira` and a ₦500 airtime prize sends exactly ₦500; nothing to map.
 *
 * Usage, from apps/cms:
 *
 *   bun run src/scripts/seed-reloadly-data-plans.ts
 *       Report what would change. Touches nothing.
 *
 *   bun run src/scripts/seed-reloadly-data-plans.ts --write
 *       Apply the plans.
 */

import { getPayload } from "@news-spend-media/payload";

type Network = "mtn" | "airtel" | "glo" | "t2";

type Plan = {
  network: Network;
  reloadlyOperatorId: number;
  reloadlyLocalAmount: number;
  /** The operator's own description of what this denomination buys. */
  buys: string;
};

/** Reloadly's DATA operator per network, not the airtime one. */
const OPERATOR: Record<Network, number> = {
  mtn: 345,
  airtel: 646,
  glo: 647,
  t2: 645,
};

const PLANS: { prize: string; promisedGb: number; plans: Plan[] }[] = [
  {
    prize: "2GB Data",
    promisedGb: 2,
    plans: [
      {
        network: "mtn",
        reloadlyOperatorId: OPERATOR.mtn,
        reloadlyLocalAmount: 600,
        buys: "2.5GB 2-day",
      },
      {
        network: "airtel",
        reloadlyOperatorId: OPERATOR.airtel,
        reloadlyLocalAmount: 599.91,
        buys: "2GB 2-day",
      },
      {
        network: "glo",
        reloadlyOperatorId: OPERATOR.glo,
        reloadlyLocalAmount: 1000,
        buys: "3.9GB 30-day",
      },
      {
        network: "t2",
        reloadlyOperatorId: OPERATOR.t2,
        reloadlyLocalAmount: 1000,
        buys: "2GB 30-day",
      },
    ],
  },
  {
    prize: "5GB Data",
    promisedGb: 5,
    plans: [
      {
        network: "mtn",
        reloadlyOperatorId: OPERATOR.mtn,
        reloadlyLocalAmount: 1500,
        buys: "5GB weekly",
      },
      {
        network: "airtel",
        reloadlyOperatorId: OPERATOR.airtel,
        reloadlyLocalAmount: 2999.92,
        buys: "8GB 30-day",
      },
      {
        network: "glo",
        reloadlyOperatorId: OPERATOR.glo,
        reloadlyLocalAmount: 1500,
        buys: "7.5GB 30-day",
      },
      {
        network: "t2",
        reloadlyOperatorId: OPERATOR.t2,
        reloadlyLocalAmount: 2500,
        buys: "5.2GB 30-day",
      },
    ],
  },
  {
    prize: "10GB Data",
    promisedGb: 10,
    plans: [
      {
        network: "mtn",
        reloadlyOperatorId: OPERATOR.mtn,
        reloadlyLocalAmount: 3500,
        buys: "10GB 30-day",
      },
      {
        network: "airtel",
        reloadlyOperatorId: OPERATOR.airtel,
        reloadlyLocalAmount: 3999.91,
        buys: "10GB 30-day",
      },
      {
        network: "glo",
        reloadlyOperatorId: OPERATOR.glo,
        reloadlyLocalAmount: 2500,
        buys: "10.8GB 30-day",
      },
      {
        network: "t2",
        reloadlyOperatorId: OPERATOR.t2,
        reloadlyLocalAmount: 5000,
        buys: "11.4GB 30-day",
      },
    ],
  },
  {
    prize: "20GB Data",
    promisedGb: 20,
    plans: [
      {
        network: "mtn",
        reloadlyOperatorId: OPERATOR.mtn,
        reloadlyLocalAmount: 5500,
        buys: "20GB 30-day",
      },
      {
        network: "airtel",
        reloadlyOperatorId: OPERATOR.airtel,
        reloadlyLocalAmount: 7999.91,
        buys: "25GB 30-day",
      },
      {
        network: "glo",
        reloadlyOperatorId: OPERATOR.glo,
        reloadlyLocalAmount: 5000,
        buys: "24GB 30-day",
      },
      // T2 (9mobile) is deliberately absent: its data plans stop at ₦5,000 for
      // 11.4GB, so it sells nothing that covers a 20GB promise. A T2 winner of
      // this prize is held for review, which is the right outcome; the
      // alternative is quietly sending half the advertised bundle.
    ],
  },
];

const write = process.argv.includes("--write");
const payload = await getPayload();

let updated = 0;
let failed = 0;

for (const entry of PLANS) {
  const { docs } = await payload.find({
    collection: "prize-catalogue",
    where: { name: { equals: entry.prize } },
    limit: 1,
    pagination: false,
    depth: 0,
  });

  const prize = docs[0] as any;

  if (!prize) {
    console.log(`\n${entry.prize}: NOT FOUND in the catalogue, skipped.`);
    failed += 1;
    continue;
  }

  const existing = (prize.reloadlyDataPlans ?? []) as {
    network: string;
    reloadlyLocalAmount: number;
  }[];

  console.log(`\n${entry.prize} (promises ${entry.promisedGb}GB)`);
  for (const plan of entry.plans) {
    const before = existing.find((p) => p.network === plan.network);
    const mark =
      before === undefined
        ? "add "
        : before.reloadlyLocalAmount === plan.reloadlyLocalAmount
          ? "same"
          : "CHANGE";
    const from =
      mark === "CHANGE" ? ` (was ₦${before?.reloadlyLocalAmount})` : "";
    console.log(
      `  ${mark}  ${plan.network.padEnd(6)} ₦${plan.reloadlyLocalAmount} → ${plan.buys}${from}`
    );
  }

  const missing = (["mtn", "airtel", "glo", "t2"] as Network[]).filter(
    (n) => !entry.plans.some((p) => p.network === n)
  );
  if (missing.length) {
    console.log(
      `  none  ${missing.join(", ")}: no plan covers ${entry.promisedGb}GB; winners on these networks are held for review`
    );
  }

  if (!write) {
    continue;
  }

  try {
    await payload.update({
      collection: "prize-catalogue",
      id: prize.id,
      data: {
        reloadlyDataPlans: entry.plans.map((p) => ({
          network: p.network,
          reloadlyOperatorId: p.reloadlyOperatorId,
          reloadlyLocalAmount: p.reloadlyLocalAmount,
        })),
      },
    });
    updated += 1;
  } catch (error) {
    failed += 1;
    console.error(
      `  failed: ${error instanceof Error ? error.message : error}`
    );
  }
}

if (!write) {
  console.log("\nDry run. Pass --write to apply.");
  process.exit(0);
}

console.log(
  `\nUpdated ${updated} prize(s).${failed ? ` ${failed} failed.` : ""}`
);
process.exit(failed > 0 ? 1 : 0);
